/**
 * Nexus WhatsApp Gateway client.
 *
 * Single place where the Academy talks to the gateway. NEVER import this from
 * frontend code — NEXUS_GATEWAY_API_KEY is server-side only.
 *
 * Base URL: NEXUS_GATEWAY_URL   (e.g. https://nexus-whatsapp-gateway.vercel.app)
 * Auth:     x-api-key: NEXUS_GATEWAY_API_KEY
 */

export type GatewayResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
};

function baseUrl(): string {
  return (Deno.env.get("NEXUS_GATEWAY_URL") ?? "").trim().replace(/\/+$/, "");
}

function apiKey(): string {
  return (Deno.env.get("NEXUS_GATEWAY_API_KEY") ?? "").trim();
}

export function gatewayConfigured(): boolean {
  return !!baseUrl() && !!apiKey();
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
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<GatewayResult<T>> {
  const url = `${baseUrl()}${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: init.method,
      headers: {
        "x-api-key": apiKey(),
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
): Promise<GatewayResult<T>> {
  if (!gatewayConfigured()) {
    return { success: false, error: "NEXUS_GATEWAY_URL or NEXUS_GATEWAY_API_KEY not configured" };
  }
  const first = await attempt<T>(path, init);
  if (first.success) return first;
  const retryable = first.status === undefined || first.status >= 500;
  if (!retryable) return first;
  return await attempt<T>(path, init);
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

// ── Public API ─────────────────────────────────────────────────────

/** TASK 2.1 — register/refresh consent for a contact. */
export function optInContact(phone: string, displayName: string): Promise<GatewayResult> {
  const e164 = toE164(phone);
  if (!e164) return Promise.resolve({ success: false, error: `Invalid phone: ${phone}` });
  return request("/api/v1/contacts", {
    method: "POST",
    body: {
      phone: e164,
      displayName: displayName || "Student",
      optIn: true,
      optInSource: "academy",
    },
  });
}

/** TASK 2.2 — free-form text message (24h customer-service window). */
export function sendWhatsAppText(phone: string, body: string): Promise<GatewayResult> {
  const e164 = toE164(phone);
  if (!e164) return Promise.resolve({ success: false, error: `Invalid phone: ${phone}` });
  if (!body?.trim()) return Promise.resolve({ success: false, error: "Message body is empty" });
  return request("/api/v1/messages/send", {
    method: "POST",
    body: { to: e164, channel: "whatsapp", body },
  });
}

/** TASK 2.3 — approved template message. */
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

/** TASK 6 helper — opt in, then send text. */
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

/** Register the inbound webhook URL with the gateway (TASK 3). */
export function registerWebhook(webhookUrl: string): Promise<GatewayResult> {
  if (!webhookUrl) return Promise.resolve({ success: false, error: "webhook url is required" });
  return request("/api/v1/webhooks/register", { method: "POST", body: { url: webhookUrl } });
}

/** List templates known to the gateway (used by the admin template sync). */
export function listTemplates(): Promise<GatewayResult> {
  return request("/api/v1/templates", { method: "GET" });
}

/** Gateway connection / business info — used by the admin Settings card. */
export function getSettings(): Promise<GatewayResult> {
  return request("/api/v1/settings", { method: "GET" });
}
