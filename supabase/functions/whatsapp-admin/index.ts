/**
 * whatsapp-admin/index.ts
 *
 * Secure admin edge function for all WhatsApp Business operations.
 * Auth: admin JWT OR x-whatsapp-internal-key header (used by DB automation triggers).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  extractWamid,
  gatewayConfigured,
  getSettings,
  listTemplates,
  optInContact,
  registerWebhook,
  sendWhatsAppTemplate,
  sendWhatsAppText,
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

// All provider traffic now goes through the Nexus WhatsApp Gateway.
// Phone numbers are stored digits-only for inbox continuity; the gateway
// client converts to E.164 before sending.
function normalisePhone(raw: string): string | null {
  return toDigits(raw);
}


/**
 * The gateway takes an ordered variable array instead of Meta components.
 * vars are keyed "1", "2", … (matching the {{n}} placeholders in the body).
 */
function buildVariables(template: Record<string, any>, vars: Record<string, string>): string[] {
  const bodyVarKeys = (template.body_variables as string[] ?? []);
  const count = bodyVarKeys.length
    ? bodyVarKeys.length
    : Object.keys(vars ?? {}).filter((k) => /^\d+$/.test(k)).length;
  const out: string[] = [];
  for (let i = 1; i <= count; i++) out.push(vars[String(i)] ?? "");
  return out;
}


// Ensure a conversation exists for this phone, return its id.
async function ensureConversation(
  sb: ReturnType<typeof createClient>,
  phone: string,
  displayName: string | null,
  userId: string | null,
): Promise<string | null> {
  const { data: existing } = await sb
    .from("whatsapp_conversations" as any)
    .select("id")
    .eq("phone_number", phone)
    .maybeSingle();
  if (existing) return (existing as any).id;
  const { data: newConv } = await sb
    .from("whatsapp_conversations" as any)
    .insert({
      phone_number: phone,
      display_name: displayName,
      student_user_id: userId,
    })
    .select("id")
    .single();
  return (newConv as any)?.id ?? null;
}

// ── SYNC TEMPLATES ─────────────────────────────────────────────────

async function syncTemplates(sb: ReturnType<typeof createClient>) {
  const res = await listTemplates();
  if (!res.success) throw new Error(res.error ?? "Gateway template fetch failed");

  const raw = res.data as any;
  const templates: any[] = Array.isArray(raw)
    ? raw
    : (raw?.data ?? raw?.templates ?? raw?.result ?? []);

  let upserted = 0;
  for (const tpl of templates) {
    const comps: any[] = tpl.components ?? [];
    const header = comps.find((c: any) => String(c.type).toUpperCase() === "HEADER");
    const body = comps.find((c: any) => String(c.type).toUpperCase() === "BODY");
    const footer = comps.find((c: any) => String(c.type).toUpperCase() === "FOOTER");
    const buttons = comps.filter((c: any) => String(c.type).toUpperCase() === "BUTTONS");
    const bodyText: string = body?.text ?? tpl.body_text ?? tpl.bodyText ?? "";
    const bodyVars = [...String(bodyText).matchAll(/\{\{(\d+)\}\}/g)].map((m) => `{{${m[1]}}}`);
    const id = String(tpl.id ?? tpl.meta_id ?? tpl.templateId ?? tpl.name);

    await sb.from("whatsapp_templates" as any).upsert({
      meta_id:        id,
      name:           tpl.name ?? tpl.templateName,
      category:       tpl.category ?? "UTILITY",
      language:       tpl.language ?? tpl.languageCode ?? "en",
      status:         String(tpl.status ?? "APPROVED").toUpperCase(),
      header_type:    header?.format ?? tpl.header_type ?? null,
      header_text:    header?.text ?? tpl.header_text ?? null,
      body_text:      bodyText,
      body_variables: bodyVars,
      footer_text:    footer?.text ?? tpl.footer_text ?? null,
      buttons:        buttons,
      last_synced_at: new Date().toISOString(),
    }, { onConflict: "meta_id" });
    upserted++;
  }
  return { synced: upserted, total: templates.length };
}


// ── SEND TEMPLATE ──────────────────────────────────────────────────

async function sendTemplate(
  sb: ReturnType<typeof createClient>,
  templateName: string,
  templateLanguage: string,
  recipients: { user_id?: string; phone: string; name?: string }[],
  vars: Record<string, string>,
  template: Record<string, any>,
  sentByUserId: string | null,
  automationId: string | null,
) {

  const results: { phone: string; status: string; wamid?: string; error?: string }[] = [];
  const BATCH = 20;
  const batches: typeof recipients[] = [];
  for (let i = 0; i < recipients.length; i += BATCH) batches.push(recipients.slice(i, i + BATCH));

  for (const batch of batches) {
    await Promise.all(batch.map(async (r) => {
      const phone = normalisePhone(r.phone);
      if (!phone) {
        results.push({ phone: r.phone, status: "failed", error: "Invalid phone number" });
        return;
      }

      // Personalise vars
      const personalVars: Record<string, string> = {};
      for (const [k, v] of Object.entries(vars ?? {})) {
        personalVars[k] = String(v)
          .replace("{{student_name}}", r.name ?? "Student")
          .replace("{{phone}}", phone);
      }

      // Ensure conversation exists BEFORE attempting send so failures still surface in inbox/analytics.
      const convId = await ensureConversation(sb, phone, r.name ?? null, r.user_id ?? null);

      try {
        // Register/refresh consent, then send through the Nexus Gateway.
        await optInContact(phone, r.name ?? "Student");
        const variables = buildVariables(template, personalVars);
        const res = await sendWhatsAppTemplate(phone, templateName, templateLanguage, variables);
        if (!res.success) throw new Error(res.error ?? "Gateway send failed");
        const wamid = extractWamid(res.data);


        if (convId) {
          await sb.from("whatsapp_messages" as any).insert({
            conversation_id: convId,
            wamid,
            direction:     "outbound",
            message_type:  "template",
            body:          template.body_text ?? null,
            template_name: templateName,
            template_vars: personalVars,
            status:        "sent",
            sent_by_user_id: sentByUserId,
            automation_id: automationId,
          });
        }
        results.push({ phone, status: "sent", wamid: wamid ?? undefined });

      } catch (err: any) {
        const errMsg = err?.message ?? String(err);
        // Log failed attempt so failure count and inbox history stay accurate.
        if (convId) {
          await sb.from("whatsapp_messages" as any).insert({
            conversation_id: convId,
            direction:     "outbound",
            message_type:  "template",
            body:          template.body_text ?? null,
            template_name: templateName,
            template_vars: personalVars,
            status:        "failed",
            error_message: errMsg.slice(0, 500),
            sent_by_user_id: sentByUserId,
            automation_id: automationId,
          });
        }
        if (automationId) {
          await sb.from("whatsapp_automation_logs" as any).insert({
            automation_id: automationId,
            event_trigger: "manual_send",
            student_user_id: r.user_id ?? null,
            phone_number: phone,
            template_name: templateName,
            status: "failed",
            error_message: errMsg.slice(0, 500),
          });
        }
        results.push({ phone, status: "failed", error: errMsg });
      }
    }));
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  return results;
}

// ── SEND FREE-FORM ─────────────────────────────────────────────────

async function sendFreeform(
  sb: ReturnType<typeof createClient>,
  phone: string,
  text: string,
  conversationId: string,
  sentByUserId: string | null,
) {
  const normPhone = normalisePhone(phone);
  if (!normPhone) throw new Error("Invalid phone number");
  try {
    const res = await sendWhatsAppText(normPhone, text);
    if (!res.success) throw new Error(res.error ?? "Gateway send failed");
    const wamid = extractWamid(res.data);
    await sb.from("whatsapp_messages" as any).insert({
      conversation_id: conversationId,
      wamid,
      direction:       "outbound",
      message_type:    "text",
      body:            text,
      status:          "sent",
      sent_by_user_id: sentByUserId,
    });
    return { wamid, status: "sent" };

  } catch (err: any) {
    await sb.from("whatsapp_messages" as any).insert({
      conversation_id: conversationId,
      direction:       "outbound",
      message_type:    "text",
      body:            text,
      status:          "failed",
      error_message:   (err?.message ?? String(err)).slice(0, 500),
      sent_by_user_id: sentByUserId,
    });
    throw err;
  }
}

// ── Main handler ───────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Auth: allow admin JWT OR internal key from DB trigger
  let user: { id: string } | null = null;
  const internalKey = req.headers.get("x-whatsapp-internal-key") ?? "";
  const triggerKey  = Deno.env.get("WHATSAPP_TRIGGER_KEY") ?? "";
  const legacyKey   = Deno.env.get("WHATSAPP_INTERNAL_KEY") ?? "";
  const isInternal  = (triggerKey && internalKey === triggerKey) || (legacyKey && internalKey === legacyKey);

  if (!isInternal) {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userSb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user: authedUser } } = await userSb.auth.getUser();
    if (!authedUser) return json({ error: "Unauthorized" }, 401);
    const { data: roleRow } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", authedUser.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Forbidden — admin only" }, 403);
    user = { id: authedUser.id };
  }

  // All provider traffic goes through the Nexus WhatsApp Gateway now —
  // no Meta token or phone-number id is needed here.
  if (!gatewayConfigured()) {
    return json({ error: "Nexus Gateway not configured (NEXUS_GATEWAY_URL / NEXUS_GATEWAY_API_KEY)" }, 500);
  }

  const url = new URL(req.url);
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = url.searchParams.get("action") ?? (body as any)?.action ?? null;

    if (action === "sync_templates") {
      const result = await syncTemplates(sb);
      return json({ success: true, ...result });
    }

    if (action === "send_template") {
      const { template_id, recipients, vars, automation_id } = body;
      if (!template_id || !recipients?.length) {
        return json({ error: "template_id and recipients required" }, 400);
      }
      const { data: tpl } = await sb
        .from("whatsapp_templates" as any)
        .select("*")
        .eq("id", template_id)
        .eq("status", "APPROVED")
        .single();
      if (!tpl) return json({ error: "Template not found or not approved" }, 404);

      const results = await sendTemplate(
        sb,
        (tpl as any).name, (tpl as any).language,
        recipients, vars ?? {}, tpl as any,
        user?.id ?? null,
        automation_id ?? null,
      );
      const sent   = results.filter((r) => r.status === "sent").length;
      const failed = results.filter((r) => r.status === "failed").length;
      return json({ success: true, sent, failed, results });
    }

    if (action === "send_freeform") {
      const { phone, text, conversation_id } = body;
      if (!phone || !text || !conversation_id) {
        return json({ error: "phone, text, conversation_id required" }, 400);
      }
      const result = await sendFreeform(sb, phone, text, conversation_id, user?.id ?? null);
      return json({ success: true, ...result });
    }


    if (action === "get_analytics") {
      const { data } = await sb.rpc("get_whatsapp_analytics" as any);
      return json({ success: true, analytics: data });
    }

    // Settings → WhatsApp Integration: "Save & Test"
    if (action === "gateway_status") {
      const res = await getSettings();
      if (!res.success) {
        return json({ success: false, error: res.error, status: res.status ?? null });
      }
      const d = (res.data ?? {}) as Record<string, any>;
      const info = (d.data ?? d) as Record<string, any>;
      return json({
        success: true,
        business_name: info.businessName ?? info.business_name ?? info.name ?? null,
        version: info.version ?? info.gatewayVersion ?? info.gateway_version ?? null,
        whatsapp_connected:
          info.whatsappConnected ?? info.whatsapp_connected ?? info.connected ?? null,
        raw: info,
      });
    }

    // Settings → register the inbound webhook with the gateway
    if (action === "register_webhook") {
      const target = String((body as any)?.url ?? "").trim() ||
        (Deno.env.get("NEXUS_APP_WEBHOOK_URL") ?? "").trim();
      if (!target) return json({ error: "NEXUS_APP_WEBHOOK_URL not configured" }, 400);
      const res = await registerWebhook(target);
      if (!res.success) return json({ success: false, url: target, error: res.error }, res.status ?? 502);
      const d = (res.data ?? {}) as Record<string, any>;
      const secret = d.webhookSecret ?? d.secret ?? d.data?.webhookSecret ?? null;
      return json({ success: true, url: target, webhook_secret_returned: !!secret, gateway: d });
    }


    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err: any) {
    console.error("[whatsapp-admin] Error:", err);
    return json({ error: err.message ?? "Unexpected error" }, 500);
  }
});
