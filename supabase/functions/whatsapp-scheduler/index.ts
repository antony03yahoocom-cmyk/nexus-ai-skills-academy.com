/**
 * whatsapp-scheduler/index.ts
 *
 * Processes the whatsapp_scheduled queue: picks every row that is `queued`
 * and due (scheduled_at <= now), sends the approved template to each recipient
 * through the Nexus WhatsApp Gateway, and records the outcome.
 *
 * Invoked by:
 *  - pg_cron every minute (x-whatsapp-internal-key header), and
 *  - the admin UI ("Run now" / scheduling) with an admin JWT, optionally
 *    passing { id } to force one specific queue row.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  extractWamid,
  gatewayConfigured,
  optInContact,
  sendWhatsAppTemplate,
  toDigits,
} from "../_shared/nexusGateway.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-whatsapp-internal-key",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

type Recipient = { user_id?: string | null; phone: string; name?: string | null };

function buildVariables(template: Record<string, any>, vars: Record<string, string>): string[] {
  const keys = (template.body_variables as string[] ?? []);
  const count = keys.length
    ? keys.length
    : Object.keys(vars ?? {}).filter((k) => /^\d+$/.test(k)).length;
  const out: string[] = [];
  for (let i = 1; i <= count; i++) out.push(vars[String(i)] ?? "");
  return out;
}

async function ensureConversation(
  sb: any,
  phone: string,
  displayName: string | null,
  userId: string | null,
): Promise<string | null> {
  const { data: existing } = await sb
    .from("whatsapp_conversations")
    .select("id")
    .eq("phone_number", phone)
    .maybeSingle();
  if (existing) return existing.id;
  const { data: created } = await sb
    .from("whatsapp_conversations")
    .insert({ phone_number: phone, display_name: displayName, student_user_id: userId })
    .select("id")
    .single();
  return created?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Auth: internal key (cron) OR admin JWT
  const internalKey = req.headers.get("x-whatsapp-internal-key") ?? "";
  const triggerKey = (Deno.env.get("WHATSAPP_TRIGGER_KEY") ?? "").trim();
  const legacyKey = (Deno.env.get("WHATSAPP_INTERNAL_KEY") ?? "").trim();
  let isInternal = (triggerKey && internalKey === triggerKey) || (legacyKey && internalKey === legacyKey);

  if (!isInternal && internalKey) {
    // Fall back to the key stored in the backend-only config row.
    const { data: cfg } = await sb.from("wa_admin_config").select("internal_key").eq("id", true).maybeSingle();
    if ((cfg as any)?.internal_key && internalKey === (cfg as any).internal_key) isInternal = true;
  }

  if (!isInternal) {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userSb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userSb.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { data: roleRow } = await sb
      .from("user_roles").select("role")
      .eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Forbidden — admin only" }, 403);
  }

  if (!(await gatewayConfigured())) {
    return json({ error: "Nexus Gateway is not configured — open Admin → WhatsApp → Overview and connect it." }, 500);
  }

  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const forcedId = (body as any)?.id ? String((body as any).id) : null;

  let query = sb
    .from("whatsapp_scheduled")
    .select("*")
    .eq("status", "queued")
    .order("scheduled_at", { ascending: true })
    .limit(20);
  if (forcedId) query = sb.from("whatsapp_scheduled").select("*").eq("id", forcedId).limit(1);
  else query = query.lte("scheduled_at", new Date().toISOString());

  const { data: due, error: dueErr } = await query;
  if (dueErr) return json({ error: dueErr.message }, 500);
  if (!due?.length) return json({ success: true, processed: 0, message: "Nothing due" });

  let processed = 0;
  let totalSent = 0;
  let totalFailed = 0;

  for (const row of due as any[]) {
    // Claim the row so overlapping cron ticks can't double-send.
    const { data: claimed } = await sb
      .from("whatsapp_scheduled")
      .update({ status: "processing" })
      .eq("id", row.id)
      .in("status", ["queued", "processing"])
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    const { data: tpl } = await sb
      .from("whatsapp_templates")
      .select("*")
      .eq("id", row.template_id)
      .eq("status", "APPROVED")
      .maybeSingle();

    if (!tpl) {
      await sb.from("whatsapp_scheduled").update({
        status: "failed",
        last_error: "Template missing or no longer approved",
        processed_at: new Date().toISOString(),
      }).eq("id", row.id);
      continue;
    }

    const recipients: Recipient[] = Array.isArray(row.recipients) ? row.recipients : [];
    let sent = 0;
    let failed = 0;
    let lastError: string | null = null;

    for (const r of recipients) {
      const phone = toDigits(r.phone ?? "");
      if (!phone) { failed++; lastError = `Invalid phone: ${r.phone}`; continue; }

      const personalVars: Record<string, string> = {};
      for (const [k, v] of Object.entries((row.template_vars ?? {}) as Record<string, string>)) {
        personalVars[k] = String(v)
          .replace("{{student_name}}", r.name ?? "Student")
          .replace("{{phone}}", phone);
      }

      const convId = await ensureConversation(sb, phone, r.name ?? null, r.user_id ?? null);

      try {
        await optInContact(phone, r.name ?? "Student");
        const res = await sendWhatsAppTemplate(
          phone,
          (tpl as any).name,
          (tpl as any).language,
          buildVariables(tpl as any, personalVars),
        );
        if (!res.success) throw new Error(res.error ?? "Gateway send failed");
        const wamid = extractWamid(res.data);
        if (convId) {
          await sb.from("whatsapp_messages").insert({
            conversation_id: convId,
            wamid,
            direction: "outbound",
            message_type: "template",
            body: (tpl as any).body_text ?? null,
            template_name: (tpl as any).name,
            template_vars: personalVars,
            status: "sent",
          });
        }
        sent++;
      } catch (err: any) {
        const msg = (err?.message ?? String(err)).slice(0, 500);
        lastError = msg;
        if (convId) {
          await sb.from("whatsapp_messages").insert({
            conversation_id: convId,
            direction: "outbound",
            message_type: "template",
            body: (tpl as any).body_text ?? null,
            template_name: (tpl as any).name,
            template_vars: personalVars,
            status: "failed",
            error_message: msg,
          });
        }
        failed++;
      }
    }

    await sb.from("whatsapp_scheduled").update({
      status: failed && !sent ? "failed" : "sent",
      sent_count: sent,
      failed_count: failed,
      last_error: lastError,
      processed_at: new Date().toISOString(),
    }).eq("id", row.id);

    processed++;
    totalSent += sent;
    totalFailed += failed;
  }

  console.log(`[whatsapp-scheduler] processed=${processed} sent=${totalSent} failed=${totalFailed}`);
  return json({ success: true, processed, sent: totalSent, failed: totalFailed });
});
