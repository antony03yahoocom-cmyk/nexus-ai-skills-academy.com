/**
 * nexus-webhook — inbound receiver for the Nexus WhatsApp Gateway.
 *
 * Accepts both gateway event envelopes ({ event, data }) and raw Meta-shaped
 * payloads forwarded by the gateway.
 *
 *  • event === "webhook.test"     → 200 immediately, no signature check
 *  • event === "message.inbound"  → store message, link conversation, realtime
 *  • event === "message.status"   → update delivery status by message id
 *
 * Signature: X-Gateway-Signature (HMAC-SHA256 of the raw body with
 * NEXUS_WEBHOOK_SECRET), timing-safe compare. Skipped when no secret is set.
 *
 * verify_jwt = false (public endpoint).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { toDigits, toE164 } from "../_shared/nexusGateway.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-gateway-signature, x-nexus-secret, x-api-key",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret: string, raw: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, raw);
  return Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type InboundMsg = {
  phone: string;
  wamid: string;
  type: string;
  body: string;
  mediaUrl: string | null;
  createdAt: string;
  displayName: string | null;
};

/** Extract inbound messages + statuses from either payload shape. */
function extractEvents(payload: any): { messages: InboundMsg[]; statuses: { id: string; status: string }[] } {
  const messages: InboundMsg[] = [];
  const statuses: { id: string; status: string }[] = [];

  const evt = String(payload?.event ?? payload?.type ?? "");
  const d = payload?.data ?? payload?.payload ?? payload;

  // ── Gateway envelope ──────────────────────────────────────────
  if (evt === "message.inbound" || (d && (d.from || d.phone) && (d.text || d.body) && !payload?.entry)) {
    const phone = String(d.from ?? d.phone ?? "");
    if (phone) {
      messages.push({
        phone,
        wamid: String(d.messageId ?? d.wamid ?? d.id ?? crypto.randomUUID()),
        type: String(d.type ?? "text"),
        body: String(d.text ?? d.body ?? d.caption ?? `[${d.type ?? "text"} message]`),
        mediaUrl: d.mediaUrl ?? d.media_url ?? null,
        createdAt: d.timestamp
          ? new Date(isNaN(Number(d.timestamp)) ? d.timestamp : Number(d.timestamp) * 1000).toISOString()
          : new Date().toISOString(),
        displayName: d.displayName ?? d.name ?? d.profileName ?? null,
      });
    }
    return { messages, statuses };
  }

  if (evt === "message.status") {
    const id = d?.messageId ?? d?.wamid ?? d?.id;
    const st = d?.status;
    if (id && st) statuses.push({ id: String(id), status: String(st) });
    return { messages, statuses };
  }

  // ── Raw Meta-shaped payload ───────────────────────────────────
  const value = payload?.entry?.[0]?.changes?.[0]?.value;
  const contactName = value?.contacts?.[0]?.profile?.name ?? null;
  for (const st of value?.statuses ?? []) {
    if (st?.id && st?.status) statuses.push({ id: String(st.id), status: String(st.status) });
  }
  for (const msg of value?.messages ?? []) {
    if (!msg?.from) continue;
    const msgType = String(msg.type ?? "text");
    messages.push({
      phone: String(msg.from),
      wamid: String(msg.id ?? crypto.randomUUID()),
      type: msgType,
      body: msg.text?.body ?? msg.image?.caption ?? msg.video?.caption ?? msg.document?.caption ??
        `[${msgType} message]`,
      mediaUrl: msg.image?.link ?? msg.video?.link ?? msg.document?.link ?? null,
      createdAt: msg.timestamp
        ? new Date(Number(msg.timestamp) * 1000).toISOString()
        : new Date().toISOString(),
      displayName: contactName,
    });
  }
  return { messages, statuses };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method === "GET") return json({ success: true, service: "nexus-webhook" });
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  // 1 — raw body first (needed for the HMAC)
  const rawBytes = new Uint8Array(await req.arrayBuffer());
  const rawText = new TextDecoder().decode(rawBytes);

  let payload: any;
  try { payload = JSON.parse(rawText); } catch {
    console.error("[nexus-webhook] non-JSON body");
    return json({ success: true, ignored: "invalid json" });
  }

  // 2 — registration / connectivity probe: accept unsigned, always 200
  const eventName = String(payload?.event ?? payload?.type ?? "");
  if (eventName === "webhook.test") {
    console.log("[nexus-webhook] webhook.test received — OK");
    return json({ success: true, event: "webhook.test" });
  }

  // 3 — signature verification for real events
  const secret = (Deno.env.get("NEXUS_WEBHOOK_SECRET") ?? "").trim();
  if (secret) {
    const provided = (req.headers.get("x-gateway-signature") ?? req.headers.get("x-nexus-secret") ?? "").trim();
    const bare = provided.replace(/^sha256=/i, "");
    const expected = await hmacHex(secret, rawBytes);
    // Accept either an HMAC signature or the shared secret sent verbatim.
    if (!timingSafeEqual(bare, expected) && !timingSafeEqual(provided, secret)) {
      console.error("[nexus-webhook] invalid signature — rejected");
      return json({ error: "Invalid signature" }, 401);
    }
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { messages, statuses } = extractEvents(payload);

  // ── Delivery / read receipts ────────────────────────────────────
  for (const st of statuses) {
    await sb.from("whatsapp_messages" as any).update({ status: st.status }).eq("wamid", st.id);
  }

  let saved = 0;
  let duplicates = 0;

  for (const msg of messages) {
    const e164 = toE164(msg.phone);
    const digits = toDigits(msg.phone);
    if (!e164 || !digits) {
      console.error(`[nexus-webhook] unparseable phone: ${msg.phone}`);
      continue;
    }

    // dedupe on provider message id
    const { data: dupe } = await sb
      .from("whatsapp_messages" as any)
      .select("id")
      .eq("wamid", msg.wamid)
      .maybeSingle();
    if (dupe) { duplicates++; continue; }

    // conversation upsert (digits form keeps inbox continuity)
    const { data: existing } = await sb
      .from("whatsapp_conversations" as any)
      .select("id, student_user_id")
      .eq("phone_number", digits)
      .maybeSingle();

    let convId: string | null = (existing as any)?.id ?? null;
    let studentUserId: string | null = (existing as any)?.student_user_id ?? null;

    if (!convId) {
      const { data: profileRow } = await sb
        .from("profiles")
        .select("user_id, full_name")
        .or(`whatsapp_number.eq.${digits},whatsapp_number.eq.${e164}`)
        .maybeSingle();
      studentUserId = (profileRow as any)?.user_id ?? null;
      const { data: newConv, error: convErr } = await sb
        .from("whatsapp_conversations" as any)
        .insert({
          phone_number: digits,
          // Unlinked senders still get a conversation — nothing is discarded.
          display_name: msg.displayName ?? (profileRow as any)?.full_name ?? `Unknown ${e164}`,
          student_user_id: studentUserId,
        })
        .select("id")
        .single();
      if (convErr) {
        console.error("[nexus-webhook] conversation insert failed:", convErr.message);
        continue;
      }
      convId = (newConv as any).id;
    }

    const { error: msgErr } = await sb.from("whatsapp_messages" as any).insert({
      conversation_id: convId,
      wamid: msg.wamid,
      direction: "inbound",
      message_type: msg.type,
      body: msg.body,
      media_url: msg.mediaUrl,
      status: "delivered",
      created_at: msg.createdAt,
    });
    if (msgErr) {
      console.error("[nexus-webhook] message insert failed:", msgErr.message);
      continue;
    }
    saved++;

    // in-app notification for the admin (drives the Realtime badge)
    const { data: adminRole } = await sb
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();
    if (adminRole) {
      await sb.from("notifications" as any).insert({
        user_id: (adminRole as any).user_id,
        event_type: "new_message",
        title: `WhatsApp reply from ${e164}`,
        message: String(msg.body).slice(0, 200),
        metadata: { conversation_id: convId, phone: e164, student_user_id: studentUserId },
      });
    }
  }

  return json({ success: true, saved, duplicates, statuses: statuses.length });
});
