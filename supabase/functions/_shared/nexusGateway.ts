/**
 * Nexus WhatsApp Gateway client.
 *
 * Single place where the Academy talks to the gateway. NEVER import this from
 * frontend code — the gateway API key is server-side only.
 *
 * Credentials come from the backend-only table public.wa_admin_config
 * (columns gateway_base_url / gateway_api_key), written once from the
 * admin Settings screen. Environment variables are used only as a fallback
 * for legacy deployments.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type GatewayResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
};

export type GatewayConfig = {
  baseUrl: string;
  apiKey: string;
  webhookSecret: string | null;
  webhookUrl: string | null;
};

function svc() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function envBaseUrl(): string {
  return (Deno.env.get("NEXUS_GATEWAY_URL") ?? "").trim().replace(/\/+$/, "");
}

function envApiKey(): string {
  return (
    Deno.env.get("NEXUS_GATEWAY_API_KEY") ??
    Deno.env.get("NEXUS_GATEWAY_APPLICATION_KEY") ??
    ""
  ).trim();
}

let cached: GatewayConfig | null = null;

/** Read the stored gateway config (DB first, env fallback). Cached per isolate. */
export async function loadConfig(force = false): Promise<GatewayConfig> {
  if (cached && !force) return cached;
  let baseUrl = "";
  let apiKey = "";
  let webhookSecret: string | null = null;
  let webhookUrl: string | null = null;
  try {
    const { data } = await svc()
      .from("wa_admin_config" as any)
      .select("gateway_base_url, gateway_api_key, webhook_secret, webhook_url")
      .eq("id", true)
      .maybeSingle();
    const row = data as Record<string, string | null> | null;
    baseUrl = (row?.gateway_base_url ?? "").trim().replace(/\/+$/, "");
    apiKey = (row?.gateway_api_key ?? "").trim();
    webhookSecret = (row?.webhook_secret ?? "")?.trim() || null;
    webhookUrl = (row?.webhook_url ?? "")?.trim() || null;
  } catch (err) {
    console.error("[nexusGateway] config read failed:", err instanceof Error ? err.message : String(err));
  }
  if (!baseUrl) baseUrl = envBaseUrl();
  if (!apiKey) apiKey = envApiKey();
  if (!webhookSecret) webhookSecret = (Deno.env.get("NEXUS_WEBHOOK_SECRET") ?? "").trim() || null;
  if (!webhookUrl) webhookUrl = (Deno.env.get("NEXUS_APP_WEBHOOK_URL") ?? "").trim() || null;
  cached = { baseUrl, apiKey, webhookSecret, webhookUrl };
  return cached;
}

/** Persist Base URL + API Key (server-side only). Clears the cache. */
export async function saveConfig(baseUrl: string, apiKey: string): Promise<void> {
  const clean = baseUrl.trim().replace(/\/+$/, "");
  await svc().from("wa_admin_config" as any).upsert(
    { id: true, gateway_base_url: clean, gateway_api_key: apiKey.trim(), updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  cached = null;
}

/** Persist webhook registration results. */
export async function saveWebhookInfo(
  webhookUrl: string,
  webhookSecret: string | null,
): Promise<void> {
  const patch: Record<string, unknown> = {
    id: true,
    webhook_url: webhookUrl,
    updated_at: new Date().toISOString(),
  };
  if (webhookSecret) patch.webhook_secret = webhookSecret;
  await svc().from("wa_admin_config" as any).upsert(patch, { onConflict: "id" });
  cached = null;
}

/** Persist the last known connection state for the Settings screen. */
export async function saveConnectionState(
  businessName: string | null,
  whatsappConnected: boolean | null,
): Promise<void> {
  await svc().from("wa_admin_config" as any).upsert(
    {
      id: true,
      business_name: businessName,
      whatsapp_connected: whatsappConnected,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  cached = null;
}

export async function gatewayConfigured(): Promise<boolean> {
  const cfg = await loadConfig();
  return !!cfg.baseUrl && !!cfg.apiKey;
}

/** The webhook URL this app exposes (stored value, else derived from the project URL). */
export async function defaultWebhookUrl(): Promise<string> {
  const cfg = await loadConfig();
  if (cfg.webhookUrl) return cfg.webhookUrl;
  const base = (Deno.env.get("SUPABASE_URL") ?? "").trim().replace(/\/+$/, "");
  return base ? `${base}/functions/v1/nexus-webhook` : "";
}

/** Normalise to E.164 (with leading +). Accepts 07…, 2547…, +2547…, 7… */
export function toE164(raw: string): string | null {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("254") && d.length === 12) return `+${d}`;
  if (d.startsWith("0") && d.length === 10) return `+254${d.slice(1)}`;
  if (d.startsWith("7") && d.length === 9) return `+254${d}`;
  if (d.length >= 10) return `+${d}`;
  return null;
}

/** Digits-only form used as the DB/inbox key (matches historical rows). */
export function toDigits(raw: string): string | null {
  const e = toE164(raw);
  return e ? e.slice(1) : null;
}

const TIMEOUT_MS = 15_000;

async function attempt<T>(
  cfg: GatewayConfig,
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<GatewayResult<T>> {
  const url = `${cfg.baseUrl}${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: init.method,
      headers: {
        "x-api-key": cfg.apiKey,
        "Content-Type": "application/json",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: ctrl.signal,
    });

    const text = await res.text();
    let parsed: unknown = undefined;
    try { parsed = text ? JSON.parse(text) : undefined; } catch { parsed = text; }

    if (!res.ok) {
      console.error(`[nexusGateway] ${init.method} ${path} failed [${res.status}]: ${text}`);
      const detail = typeof parsed === "object" && parsed !== null
        ? ((parsed as Record<string, unknown>).error ?? (parsed as Record<string, unknown>).message ?? text)
        : text;
      return { success: false, error: `Gateway ${res.status}: ${String(detail).slice(0, 500)}`, status: res.status };
    }

    // Some gateways report failures inside a 2xx body.
    if (typeof parsed === "object" && parsed !== null && (parsed as Record<string, unknown>).success === false) {
      const detail = (parsed as Record<string, unknown>).error ?? "Gateway reported failure";
      console.error(`[nexusGateway] ${init.method} ${path} soft-failed: ${text}`);
      return { success: false, error: String(detail).slice(0, 500), status: res.status, data: parsed as T };
    }

    return { success: true, data: parsed as T, status: res.status };
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === "AbortError";
    const msg = aborted ? `Gateway request timed out after ${TIMEOUT_MS}ms` : (err instanceof Error ? err.message : String(err));
    console.error(`[nexusGateway] ${init.method} ${path} threw: ${msg}`);
    return { success: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

/** Single retry on network/timeout or 5xx — never throws. */
async function request<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
  overrideCfg?: { baseUrl: string; apiKey: string },
): Promise<GatewayResult<T>> {
  const cfg: GatewayConfig = overrideCfg
    ? { baseUrl: overrideCfg.baseUrl.trim().replace(/\/+$/, ""), apiKey: overrideCfg.apiKey.trim(), webhookSecret: null, webhookUrl: null }
    : await loadConfig();
  if (!cfg.baseUrl || !cfg.apiKey) {
    return { success: false, error: "Gateway Base URL / API Key not configured. Open Admin → WhatsApp → Settings and connect the gateway." };
  }
  const first = await attempt<T>(cfg, path, init);
  if (first.success) return first;
  const retryable = first.status === undefined || first.status >= 500;
  if (!retryable) return first;
  return await attempt<T>(cfg, path, init);
}

/** Extract a provider message id (wamid) from whatever shape the gateway returns. */
export function extractWamid(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, any>;
  return (
    d.wamid ??
    d.messageId ??
    d.message_id ??
    d.id ??
    d.data?.wamid ??
    d.data?.messageId ??
    d.data?.id ??
    d.messages?.[0]?.id ??
    null
  );
}

/** Extract the webhook secret from a registration response. */
export function extractWebhookSecret(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, any>;
  return d.webhookSecret ?? d.webhook_secret ?? d.secret ?? d.data?.webhookSecret ?? d.data?.secret ?? null;
}

// ── Public API ─────────────────────────────────────────────────────

/** Register/refresh consent for a contact. */
export function optInContact(
  phone: string,
  displayName: string,
  optIn = true,
  optInSource = "academy",
): Promise<GatewayResult> {
  const e164 = toE164(phone);
  if (!e164) return Promise.resolve({ success: false, error: `Invalid phone: ${phone}` });
  return request("/api/v1/contacts", {
    method: "POST",
    body: {
      phone: e164,
      displayName: displayName || "Student",
      optIn,
      optInSource,
    },
  });
}

/** Free-form text message (24h customer-service window). */
export function sendWhatsAppText(phone: string, body: string): Promise<GatewayResult> {
  const e164 = toE164(phone);
  if (!e164) return Promise.resolve({ success: false, error: `Invalid phone: ${phone}` });
  if (!body?.trim()) return Promise.resolve({ success: false, error: "Message body is empty" });
  return request("/api/v1/messages/send", {
    method: "POST",
    body: { to: e164, channel: "whatsapp", body },
  });
}

/** Approved template message. */
export function sendWhatsAppTemplate(
  phone: string,
  templateName: string,
  languageCode: string,
  variables: string[],
): Promise<GatewayResult> {
  const e164 = toE164(phone);
  if (!e164) return Promise.resolve({ success: false, error: `Invalid phone: ${phone}` });
  if (!templateName) return Promise.resolve({ success: false, error: "templateName is required" });
  return request("/api/v1/messages/send", {
    method: "POST",
    body: {
      to: e164,
      channel: "whatsapp",
      templateName,
      languageCode: languageCode || "en",
      variables: variables ?? [],
    },
  });
}

/** Media message (image / document / video) inside the 24h window. */
export function sendWhatsAppMedia(
  phone: string,
  mediaUrl: string,
  mediaType: "image" | "document" | "video" | "audio",
  caption?: string,
): Promise<GatewayResult> {
  const e164 = toE164(phone);
  if (!e164) return Promise.resolve({ success: false, error: `Invalid phone: ${phone}` });
  if (!mediaUrl) return Promise.resolve({ success: false, error: "mediaUrl is required" });
  return request("/api/v1/messages/send", {
    method: "POST",
    body: {
      to: e164,
      channel: "whatsapp",
      mediaUrl,
      mediaType,
      ...(caption ? { caption } : {}),
    },
  });
}

/** Opt in, then send text. */
export async function ensureOptInAndSendText(
  phone: string,
  displayName: string,
  body: string,
): Promise<GatewayResult> {
  const optIn = await optInContact(phone, displayName);
  if (!optIn.success) {
    console.warn(`[nexusGateway] opt-in warning for ${phone}: ${optIn.error}`);
  }
  return sendWhatsAppText(phone, body);
}

/**
 * Register the inbound webhook URL with the gateway.
 * The gateway's own connectivity probe to this URL is intentionally unsigned.
 */
export function registerWebhook(
  webhookUrl: string,
  overrideCfg?: { baseUrl: string; apiKey: string },
): Promise<GatewayResult> {
  if (!webhookUrl) return Promise.resolve({ success: false, error: "webhook url is required" });
  return request("/api/v1/webhooks/register", { method: "POST", body: { url: webhookUrl } }, overrideCfg);
}

/** List templates known to the gateway (used by the admin template sync). */
export function listTemplates(overrideCfg?: { baseUrl: string; apiKey: string }): Promise<GatewayResult> {
  return request("/api/v1/templates", { method: "GET" }, overrideCfg);
}

/** Gateway connection / business info — used by the admin Settings card. */
export function getSettings(overrideCfg?: { baseUrl: string; apiKey: string }): Promise<GatewayResult> {
  return request("/api/v1/settings", { method: "GET" }, overrideCfg);
}
