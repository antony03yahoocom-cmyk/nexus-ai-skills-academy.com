/**
 * nexus-webhook — inbound receiver for the Nexus WhatsApp Gateway (TASK 4).
 *
 * The gateway forwards Meta's raw payload here. We:
 *   1. extract from / wamid / body / timestamp
 *   2. normalise phone to E.164
 *   3. deduplicate on wamid
 *   4. upsert conversation + insert into whatsapp_messages (direction 'inbound')
 *   5. notify the admin (Supabase Realtime picks up the inserts for the UI)
 *   6. answer 200 quickly
 *
 * verify_jwt = false (public endpoint). Optional shared-secret check via
 * NEXUS_WEBHOOK_SECRET when the header x-nexus-secret is configured.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { toDigits, toE164 } from "../_shared/nexusGateway.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-nexus-secret, x-api-key",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const MessageSchema = z.object({
  from: z.string().min(5),
  id: z.string().min(1),
  timestamp: z.union([z.string(), z.number()]).optional(),
  type: z.string().optional(),
  text: z.object({ body: z.string() }).partial().optional(),
  image: z.object({ caption: z.string().optional(), link: z.string().optional() }).partial().optional(),
  video: z.object({ caption: z.string().optional(), link: z.string().optional() }).partial().optional(),
  document: z.object({ caption: z.string().optional(), link: z.string().optional() }).partial().optional(),
}).passthrough();

const PayloadSchema = z.object({
  entry: z.array(z.object({
    changes: z.array(z.object({
      value: z.object({
        messages: z.array(MessageSchema).optional(),
        statuses: z.array(z.object({ id: z.string(), status: z.string() }).passthrough()).optional(),
        contacts: z.array(z.object({ profile: z.object({ name: z.string().optional() }).partial().optional() }).passthrough()).optional(),
      }).passthrough(),
    }).passthrough()).optional(),
  }).passthrough()).optional(),
  // Some gateways wrap the Meta payload; accept a flat single message too.
  message: MessageSchema.optional(),
}).passthrough();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  // Health / registration probe.
  if (req.method === "GET") return json({ success: true, service: "nexus-webhook" });
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  const expectedSecret = (Deno.env.get("NEXUS_WEBHOOK_SECRET") ?? "").trim();
  if (expectedSecret) {
    const provided = req.headers.get("x-nexus-secret") ?? req.headers.get("x-api-key") ?? "";
    if (provided !== expectedSecret) return json({ error: "Forbidden" }, 403);
  }

  const raw = await req.json().catch(() => null);
  const parsed = PayloadSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[nexus-webhook] invalid payload", JSON.stringify(parsed.error.flatten().fieldErrors));
    // Still 200 so the gateway does not retry an unparseable payload forever.
    return json({ success: true, ignored: "invalid payload" });
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const value = parsed.data.entry?.[0]?.changes?.[0]?.value;
  const messages = value?.messages ?? (parsed.data.message ? [parsed.data.message] : []);
  const statuses = value?.statuses ?? [];
  const contactName = value?.contacts?.[0]?.profile?.name ?? null;

  // ── Delivery / read receipts ────────────────────────────────────
  for (const st of statuses) {
    if (!st.id || !st.status) continue;
    await sb.from("whatsapp_messages" as any)
      .update({ status: st.status })
      .eq("wamid", st.id);
  }

  let saved = 0;
  let duplicates = 0;

  for (const msg of messages) {
    const e164 = toE164(msg.from);
    const digits = toDigits(msg.from);
    if (!e164 || !digits) {
      console.error(`[nexus-webhook] unparseable phone: ${msg.from}`);
      continue;
    }
    const wamid = msg.id;
    const msgType = msg.type ?? "text";
    const body =
      msg.text?.body ??
      msg.image?.caption ??
      msg.video?.caption ??
      msg.document?.caption ??
      `[${msgType} message]`;
    const mediaUrl = msg.image?.link ?? msg.video?.link ?? msg.document?.link ?? null;

    // 3 — dedupe on wamid
    const { data: dupe } = await sb
      .from("whatsapp_messages" as any)
      .select("id")
      .eq("wamid", wamid)
      .maybeSingle();
    if (dupe) { duplicates++; continue; }

    // conversation upsert (keyed on digits form for inbox continuity)
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
          display_name: contactName ?? (profileRow as any)?.full_name ?? null,
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

    const createdAt = msg.timestamp
      ? new Date(Number(msg.timestamp) * 1000).toISOString()
      : new Date().toISOString();

    const { error: msgErr } = await sb.from("whatsapp_messages" as any).insert({
      conversation_id: convId,
      wamid,
      direction: "inbound",
      message_type: msgType,
      body,
      media_url: mediaUrl,
      status: "delivered",
      created_at: createdAt,
    });
    if (msgErr) {
      console.error("[nexus-webhook] message insert failed:", msgErr.message);
      continue;
    }
    saved++;

    // 5 — in-app notification for the admin (drives Realtime badge)
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
        message: String(body).slice(0, 200),
        metadata: { conversation_id: convId, phone: e164, student_user_id: studentUserId },
      });
    }
  }

  return json({ success: true, saved, duplicates, statuses: statuses.length });
});
