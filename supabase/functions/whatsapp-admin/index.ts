/**
 * whatsapp-admin/index.ts
 *
 * Secure admin edge function for all WhatsApp Business operations.
 * Auth: admin JWT OR x-whatsapp-internal-key header (used by DB automation triggers).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  defaultWebhookUrl,
  extractWamid,
  extractWebhookSecret,
  gatewayConfigured,
  getSettings,
  listTemplates,
  loadConfig,
  optInContact,
  registerWebhook,
  saveConfig,
  saveConnectionState,
  saveWebhookInfo,
  sendWhatsAppMedia,
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

  // Everything already stored, keyed by "name|language" — the identity the
  // academy actually cares about (gateway ids change between providers).
  const { data: existingRows } = await sb
    .from("whatsapp_templates" as any)
    .select("id, name, language");
  const existing = new Map<string, string>();
  for (const r of (existingRows ?? []) as any[]) {
    existing.set(`${String(r.name).toLowerCase()}|${String(r.language ?? "en").toLowerCase()}`, r.id);
  }

  let added = 0;
  let skipped = 0;
  const seen = new Set<string>();

  for (const tpl of templates) {
    const comps: any[] = tpl.components ?? [];
    const header = comps.find((c: any) => String(c.type).toUpperCase() === "HEADER");
    const body = comps.find((c: any) => String(c.type).toUpperCase() === "BODY");
    const footer = comps.find((c: any) => String(c.type).toUpperCase() === "FOOTER");
    const buttons = comps.filter((c: any) => String(c.type).toUpperCase() === "BUTTONS");
    const bodyText: string = body?.text ?? tpl.body_text ?? tpl.bodyText ?? "";
    const bodyVars = [...String(bodyText).matchAll(/\{\{(\d+)\}\}/g)].map((m) => `{{${m[1]}}}`);
    const id = String(tpl.id ?? tpl.meta_id ?? tpl.templateId ?? tpl.name);
    const name = tpl.name ?? tpl.templateName;
    const language = tpl.language ?? tpl.languageCode ?? "en";
    if (!name) continue;

    const key = `${String(name).toLowerCase()}|${String(language).toLowerCase()}`;
    // Guard against the gateway itself returning the same template twice.
    if (seen.has(key)) { skipped++; continue; }
    seen.add(key);

    const existingId = existing.get(key);
    if (existingId) {
      // Already saved — refresh only the volatile fields, never create a copy.
      await sb.from("whatsapp_templates" as any).update({
        status:         String(tpl.status ?? "APPROVED").toUpperCase(),
        last_synced_at: new Date().toISOString(),
      }).eq("id", existingId);
      skipped++;
      continue;
    }

    const { error: insErr } = await sb.from("whatsapp_templates" as any).insert({
      meta_id:        id,
      name,
      category:       tpl.category ?? "UTILITY",
      language,
      status:         String(tpl.status ?? "APPROVED").toUpperCase(),
      header_type:    header?.format ?? tpl.header_type ?? null,
      header_text:    header?.text ?? tpl.header_text ?? null,
      body_text:      bodyText,
      body_variables: bodyVars,
      footer_text:    footer?.text ?? tpl.footer_text ?? null,
      buttons:        buttons,
      last_synced_at: new Date().toISOString(),
    });
    if (insErr) {
      // Unique index tripped by a concurrent sync — treat as already saved.
      console.warn("[whatsapp-admin] template insert skipped:", insErr.message);
      skipped++;
      continue;
    }
    existing.set(key, id);
    added++;
  }
  return { synced: added, added, skipped, total: templates.length };
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

  const url = new URL(req.url);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const action = url.searchParams.get("action") ?? (body as any)?.action ?? null;

  // ── Settings: save Base URL + API Key, verify, register webhook, sync templates
  if (action === "save_gateway_config") {
    const baseUrl = String((body as any)?.base_url ?? "").trim().replace(/\/+$/, "");
    const apiKey = String((body as any)?.api_key ?? "").trim();
    if (!/^https?:\/\/.+/i.test(baseUrl)) {
      return json({ success: false, error: "Gateway Base URL must start with http:// or https://" }, 400);
    }
    if (!apiKey) return json({ success: false, error: "Gateway API Key is required" }, 400);

    // 1 — verify credentials before storing anything
    const probe = await getSettings({ baseUrl, apiKey });
    if (!probe.success) {
      return json({
        success: false,
        error: probe.status === 401 || probe.status === 403
          ? "Connection failed — check your Base URL and API Key"
          : (probe.error ?? "Connection failed — check your Base URL and API Key"),
      }, 400);
    }
    const info = ((probe.data as any)?.data ?? probe.data ?? {}) as Record<string, any>;
    const businessName = info.businessName ?? info.business_name ?? info.name ?? null;
    const waConnected =
      info.whatsapp?.connected ?? info.whatsappConnected ?? info.whatsapp_connected ?? info.connected ?? null;

    await saveConfig(baseUrl, apiKey);
    await saveConnectionState(businessName, typeof waConnected === "boolean" ? waConnected : null);

    // 2 — webhook registration (unsigned by design; failure must not block sending)
    const hookUrl = await defaultWebhookUrl();
    let webhook: { registered: boolean; url: string; error?: string; already_registered?: boolean } = {
      registered: false, url: hookUrl,
    };
    if (!hookUrl) {
      webhook.error = "Could not determine this app's public webhook URL";
    } else {
      const reg = await registerWebhook(hookUrl, { baseUrl, apiKey });
      if (reg.success) {
        await saveWebhookInfo(hookUrl, extractWebhookSecret(reg.data));
        webhook.registered = true;
      } else {
        const msg = reg.error ?? "Webhook registration failed";
        const conflict = /already|exist|conflict|registered|409/i.test(msg);
        webhook.error = conflict
          ? "This gateway account already has a different webhook registered — only one receiver is supported per account. Remove the existing webhook in the gateway, then try again. Sending still works; only receiving replies is affected."
          : `${msg} — sending still works; only receiving replies is affected.`;
        webhook.already_registered = conflict;
      }
    }

    // 3 — template cache
    let templates: { synced: number; total: number } | null = null;
    let templateError: string | null = null;
    try {
      templates = await syncTemplates(sb);
    } catch (err: any) {
      templateError = err?.message ?? String(err);
    }

    return json({
      success: true,
      base_url: baseUrl,
      business_name: businessName,
      version: info.version ?? info.gatewayVersion ?? null,
      whatsapp_connected: waConnected,
      webhook,
      templates,
      template_error: templateError,
    });
  }

  // Non-destructive status read for the Settings screen (never returns the API key)
  if (action === "gateway_config") {
    const cfg = await loadConfig(true);
    const { data: row } = await sb
      .from("wa_admin_config" as any)
      .select("business_name, whatsapp_connected, connected_at, webhook_url")
      .eq("id", true)
      .maybeSingle();
    return json({
      success: true,
      configured: !!cfg.baseUrl && !!cfg.apiKey,
      base_url: cfg.baseUrl || null,
      api_key_set: !!cfg.apiKey,
      webhook_url: cfg.webhookUrl ?? (row as any)?.webhook_url ?? null,
      receiving_live: !!cfg.webhookSecret,
      business_name: (row as any)?.business_name ?? null,
      whatsapp_connected: (row as any)?.whatsapp_connected ?? null,
      connected_at: (row as any)?.connected_at ?? null,
    });
  }

  // All provider traffic goes through the Nexus WhatsApp Gateway.
  if (!(await gatewayConfigured())) {
    return json({
      error: "Nexus Gateway is not configured. Open Admin → WhatsApp → Settings, enter the Gateway Base URL and API Key, then click Save & Connect.",
    }, 500);
  }

  try {


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


    if (action === "send_media") {
      const { phone, media_url, media_type, caption, conversation_id } = body as any;
      if (!phone || !media_url) return json({ error: "phone and media_url required" }, 400);
      const norm = normalisePhone(phone);
      if (!norm) return json({ error: `Invalid phone: ${phone}` }, 400);
      const convId = conversation_id ?? (await ensureConversation(sb, norm, null, null));
      const res = await sendWhatsAppMedia(norm, media_url, (media_type ?? "image"), caption);
      const wamid = res.success ? extractWamid(res.data) : null;
      if (convId) {
        await sb.from("whatsapp_messages" as any).insert({
          conversation_id: convId,
          wamid,
          direction: "outbound",
          message_type: media_type ?? "image",
          body: caption ?? null,
          media_url,
          media_caption: caption ?? null,
          status: res.success ? "sent" : "failed",
          error_message: res.success ? null : (res.error ?? "Gateway media send failed").slice(0, 500),
          sent_by_user_id: user?.id ?? null,
        });
      }
      if (!res.success) return json({ success: false, error: res.error ?? "Media send failed" }, 502);
      return json({ success: true, wamid });
    }

    if (action === "schedule_template") {
      const { template_id, recipients, vars, scheduled_at, timezone } = body as any;
      if (!template_id || !recipients?.length || !scheduled_at) {
        return json({ error: "template_id, recipients and scheduled_at required" }, 400);
      }
      const { data: row, error } = await sb.from("whatsapp_scheduled" as any).insert({
        template_id,
        template_vars: vars ?? {},
        recipients,
        schedule_type: "once",
        scheduled_at,
        timezone: timezone ?? "UTC",
        status: "queued",
        created_by: user?.id ?? null,
      }).select("id").single();
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, id: (row as any)?.id });
    }

    if (action === "get_analytics") {
      const { data } = await sb.rpc("get_whatsapp_analytics" as any);
      return json({ success: true, analytics: data });
    }

    // Settings → live connection probe
    if (action === "gateway_status") {
      const res = await getSettings();
      if (!res.success) {
        return json({ success: false, error: res.error, status: res.status ?? null });
      }
      const d = (res.data ?? {}) as Record<string, any>;
      const info = (d.data ?? d) as Record<string, any>;
      const waConnected =
        info.whatsapp?.connected ?? info.whatsappConnected ?? info.whatsapp_connected ?? info.connected ?? null;
      const businessName = info.businessName ?? info.business_name ?? info.name ?? null;
      await saveConnectionState(businessName, typeof waConnected === "boolean" ? waConnected : null);
      return json({
        success: true,
        business_name: businessName,
        version: info.version ?? info.gatewayVersion ?? info.gateway_version ?? null,
        whatsapp_connected: waConnected,
      });
    }

    // Settings → register the inbound webhook with the gateway
    if (action === "register_webhook") {
      const target = String((body as any)?.url ?? "").trim() || (await defaultWebhookUrl());
      if (!target) return json({ error: "Could not determine this app's public webhook URL" }, 400);
      const res = await registerWebhook(target);
      if (!res.success) {
        const msg = res.error ?? "Webhook registration failed";
        const conflict = /already|exist|conflict|registered|409/i.test(msg);
        return json({
          success: false,
          url: target,
          already_registered: conflict,
          error: conflict
            ? "This gateway account already has a different webhook registered — only one receiver is supported per account. Remove it in the gateway, then retry. Sending still works; only receiving replies is affected."
            : msg,
        }, res.status ?? 502);
      }
      const secret = extractWebhookSecret(res.data);
      await saveWebhookInfo(target, secret);
      return json({ success: true, url: target, receiving_live: !!secret });
    }



    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err: any) {
    console.error("[whatsapp-admin] Error:", err);
    return json({ error: err.message ?? "Unexpected error" }, 500);
  }
});
