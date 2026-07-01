/**
 * whatsapp-admin/index.ts
 *
 * Secure admin-only edge function for all WhatsApp Business operations.
 * Called from the AdminWhatsAppPage — never exposed to students.
 *
 * Actions (passed as ?action=xxx):
 *   sync_templates  — Pull approved templates from Meta WABA
 *   send_template   — Send a template to one or many recipients
 *   send_freeform   — Send a free-form text (within 24h window)
 *   get_analytics   — Return WhatsApp analytics
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ── Meta API helpers ───────────────────────────────────────────────

async function metaGet(path: string, token: string) {
  const res = await fetch(`https://graph.facebook.com/v20.0${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Meta API ${res.status}: ${JSON.stringify(err)}`);
  }
  return res.json();
}

async function metaPost(path: string, body: object, token: string) {
  const res = await fetch(`https://graph.facebook.com/v20.0${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Meta API ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

// Phone normaliser (Kenya-aware)
function normalisePhone(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.startsWith("254") && d.length === 12) return d;
  if (d.startsWith("0") && d.length === 10) return "254" + d.slice(1);
  if (d.startsWith("7") && d.length === 9) return "254" + d;
  if (d.length >= 10) return d;
  return null;
}

// ── Build template component payload ──────────────────────────────
function buildComponents(
  template: Record<string, any>,
  vars: Record<string, string>,
): object[] {
  const components: object[] = [];

  // Header
  if (template.header_type === "TEXT" && template.header_text) {
    const headerVars = Object.keys(vars).filter((k) => k.startsWith("header_"));
    if (headerVars.length) {
      components.push({
        type: "header",
        parameters: headerVars.map((k) => ({ type: "text", text: vars[k] })),
      });
    }
  }

  // Body variables
  const bodyVarKeys = (template.body_variables as string[] ?? []);
  if (bodyVarKeys.length) {
    components.push({
      type: "body",
      parameters: bodyVarKeys.map((_, i) => ({
        type: "text",
        text: vars[String(i + 1)] ?? `{{${i + 1}}}`,
      })),
    });
  }

  return components;
}

// ── SYNC TEMPLATES ─────────────────────────────────────────────────

async function syncTemplates(sb: ReturnType<typeof createClient>, wabaId: string, token: string) {
  const data = await metaGet(
    `/${wabaId}/message_templates?fields=id,name,category,language,status,components&limit=100`,
    token,
  );

  const templates = (data.data ?? []) as any[];
  let upserted = 0;

  for (const tpl of templates) {
    const comps: any[] = tpl.components ?? [];

    const header = comps.find((c: any) => c.type === "HEADER");
    const body   = comps.find((c: any) => c.type === "BODY");
    const footer = comps.find((c: any) => c.type === "FOOTER");
    const buttons = comps.filter((c: any) => c.type === "BUTTONS");

    // Extract body variables {{1}} {{2}} etc.
    const bodyText: string = body?.text ?? "";
    const bodyVars = [...bodyText.matchAll(/\{\{(\d+)\}\}/g)].map((m) => `{{${m[1]}}}`);

    await sb.from("whatsapp_templates" as any).upsert(
      {
        meta_id:        tpl.id,
        name:           tpl.name,
        category:       tpl.category,
        language:       tpl.language,
        status:         tpl.status,
        header_type:    header?.format ?? null,
        header_text:    header?.text ?? null,
        body_text:      bodyText,
        body_variables: bodyVars,
        footer_text:    footer?.text ?? null,
        buttons:        buttons,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "meta_id" },
    );
    upserted++;
  }

  return { synced: upserted, total: templates.length };
}

// ── SEND TEMPLATE ──────────────────────────────────────────────────

async function sendTemplate(
  sb: ReturnType<typeof createClient>,
  phoneNumberId: string,
  token: string,
  templateName: string,
  templateLanguage: string,
  recipients: { user_id?: string; phone: string; name?: string }[],
  vars: Record<string, string>,
  template: Record<string, any>,
  sentByUserId: string,
) {
  const results: { phone: string; status: string; wamid?: string; error?: string }[] = [];

  // Rate limit: 80 messages / second (batch with small delays)
  const BATCH = 20;
  const batches: typeof recipients[] = [];
  for (let i = 0; i < recipients.length; i += BATCH) {
    batches.push(recipients.slice(i, i + BATCH));
  }

  for (const batch of batches) {
    await Promise.all(
      batch.map(async (r) => {
        const phone = normalisePhone(r.phone);
        if (!phone) {
          results.push({ phone: r.phone, status: "failed", error: "Invalid phone number" });
          return;
        }

        // Personalise vars (replace {{student_name}} tokens)
        const personalVars: Record<string, string> = {};
        for (const [k, v] of Object.entries(vars)) {
          personalVars[k] = v
            .replace("{{student_name}}", r.name ?? "Student")
            .replace("{{phone}}", phone);
        }

        try {
          const components = buildComponents(template, personalVars);
          const metaData = await metaPost(`/${phoneNumberId}/messages`, {
            messaging_product: "whatsapp",
            to: phone,
            type: "template",
            template: {
              name: templateName,
              language: { code: templateLanguage },
              components,
            },
          }, token);

          const wamid = metaData?.messages?.[0]?.id ?? null;

          // Ensure conversation exists
          let convId: string | null = null;
          const { data: existing } = await sb
            .from("whatsapp_conversations" as any)
            .select("id")
            .eq("phone_number", phone)
            .maybeSingle();

          if (existing) {
            convId = (existing as any).id;
          } else {
            const { data: newConv } = await sb
              .from("whatsapp_conversations" as any)
              .insert({
                phone_number:    phone,
                display_name:    r.name ?? null,
                student_user_id: r.user_id ?? null,
              })
              .select("id")
              .single();
            convId = (newConv as any)?.id ?? null;
          }

          // Log message
          if (convId) {
            await sb.from("whatsapp_messages" as any).insert({
              conversation_id: convId,
              wamid,
              direction:     "outbound",
              message_type:  "template",
              body:          template.body_text ?? null,
              template_name: templateName,
              template_vars: personalVars,
              status:        wamid ? "sent" : "failed",
              sent_by_user_id: sentByUserId,
            });
          }

          results.push({ phone, status: wamid ? "sent" : "failed", wamid });
        } catch (err: any) {
          results.push({ phone, status: "failed", error: err.message });
        }
      }),
    );

    // Small delay between batches to respect rate limits
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return results;
}

// ── SEND FREE-FORM ─────────────────────────────────────────────────

async function sendFreeform(
  sb: ReturnType<typeof createClient>,
  phoneNumberId: string,
  token: string,
  phone: string,
  text: string,
  conversationId: string,
  sentByUserId: string,
) {
  const normPhone = normalisePhone(phone);
  if (!normPhone) throw new Error("Invalid phone number");

  const metaData = await metaPost(`/${phoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    to: normPhone,
    type: "text",
    text: { body: text },
  }, token);

  const wamid = metaData?.messages?.[0]?.id ?? null;

  await sb.from("whatsapp_messages" as any).insert({
    conversation_id: conversationId,
    wamid,
    direction:       "outbound",
    message_type:    "text",
    body:            text,
    status:          wamid ? "sent" : "failed",
    sent_by_user_id: sentByUserId,
  });

  return { wamid, status: wamid ? "sent" : "failed" };
}

// ── Main handler ───────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  // Auth — admin only
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const userSb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await userSb.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Check admin role
  const { data: roleRow } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) return json({ error: "Forbidden — admin only" }, 403);

  // Credentials from env
  const TOKEN        = Deno.env.get("WHATSAPP_PERMANENT_TOKEN") ?? "";
  const PHONE_ID     = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
  const WABA_ID      = Deno.env.get("WHATSAPP_BUSINESS_ACCOUNT_ID") ?? "";

  if (!TOKEN || !PHONE_ID) return json({ error: "WhatsApp credentials not configured" }, 500);

  const url    = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    // ── sync_templates ───────────────────────────────────────────
    if (action === "sync_templates") {
      if (!WABA_ID) return json({ error: "WHATSAPP_BUSINESS_ACCOUNT_ID not set" }, 500);
      const result = await syncTemplates(sb, WABA_ID, TOKEN);
      return json({ success: true, ...result });
    }

    // ── send_template ────────────────────────────────────────────
    if (action === "send_template") {
      const { template_id, recipients, vars } = body;
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
        sb, PHONE_ID, TOKEN,
        (tpl as any).name, (tpl as any).language,
        recipients, vars ?? {},
        tpl as any, user.id,
      );

      const sent   = results.filter((r) => r.status === "sent").length;
      const failed = results.filter((r) => r.status === "failed").length;
      return json({ success: true, sent, failed, results });
    }

    // ── send_freeform ─────────────────────────────────────────────
    if (action === "send_freeform") {
      const { phone, text, conversation_id } = body;
      if (!phone || !text || !conversation_id) {
        return json({ error: "phone, text, conversation_id required" }, 400);
      }
      const result = await sendFreeform(sb, PHONE_ID, TOKEN, phone, text, conversation_id, user.id);
      return json({ success: true, ...result });
    }

    // ── get_analytics ─────────────────────────────────────────────
    if (action === "get_analytics") {
      const { data } = await sb.rpc("get_whatsapp_analytics" as any);
      return json({ success: true, analytics: data });
    }

    return json({ error: `Unknown action: ${action}` }, 400);

  } catch (err: any) {
    console.error("[whatsapp-admin] Error:", err);
    return json({ error: err.message ?? "Unexpected error" }, 500);
  }
});
