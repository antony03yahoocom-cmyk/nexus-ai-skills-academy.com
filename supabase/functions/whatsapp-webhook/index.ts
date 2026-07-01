/**
 * whatsapp-webhook/index.ts — Meta WhatsApp Cloud API webhook
 *
 * GET  → Webhook verification challenge
 * POST → Delivery receipts, read receipts, inbound messages
 *
 * Stores everything in whatsapp_messages / whatsapp_conversations.
 * Also fires the pg trigger for in-app notifications on inbound messages.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalisePhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.startsWith("254") && d.length === 12) return d;
  if (d.startsWith("0") && d.length === 10) return "254" + d.slice(1);
  return d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  // ── GET: Verification ──────────────────────────────────────────
  if (req.method === "GET") {
    const url       = new URL(req.url);
    const mode      = url.searchParams.get("hub.mode");
    const token     = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const expected  = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN") ?? "";

    if (mode === "subscribe" && token === expected && challenge) {
      console.log("[whatsapp-webhook] ✅ Verified by Meta");
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // ── POST: Events ───────────────────────────────────────────────
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let payload: any;
  try { payload = await req.json(); }
  catch { return new Response("Bad Request", { status: 400 }); }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const entry   = payload?.entry?.[0];
  const changes = entry?.changes?.[0];
  const value   = changes?.value;

  if (!value) {
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // ── Delivery / read status updates ────────────────────────────
  for (const status of value?.statuses ?? []) {
    if (!status.id) continue;
    const newStatus = status.status as string; // sent|delivered|read|failed

    await sb
      .from("whatsapp_messages" as any)
      .update({ status: newStatus })
      .eq("wamid", status.id);
  }

  // ── Inbound messages ──────────────────────────────────────────
  for (const msg of value?.messages ?? []) {
    const fromPhone  = normalisePhone(msg.from as string ?? "");
    const msgType    = msg.type as string ?? "text";
    const body       = msg.text?.body as string
      ?? msg.image?.caption as string
      ?? msg.document?.caption as string
      ?? `[${msgType} message]`;
    const mediaUrl   = msg.image?.link ?? msg.video?.link ?? msg.document?.link ?? null;
    const wamid      = msg.id as string;

    // Upsert conversation
    const { data: existing } = await sb
      .from("whatsapp_conversations" as any)
      .select("id, student_user_id")
      .eq("phone_number", fromPhone)
      .maybeSingle();

    let convId: string;
    let studentUserId: string | null = null;

    if (existing) {
      convId       = (existing as any).id;
      studentUserId = (existing as any).student_user_id;
    } else {
      // Try to find student by WhatsApp number on profile
      const { data: profileRow } = await sb
        .from("profiles")
        .select("user_id, full_name")
        .eq("whatsapp_number", fromPhone)
        .maybeSingle();

      studentUserId = (profileRow as any)?.user_id ?? null;
      const displayName = value?.contacts?.[0]?.profile?.name as string
        ?? (profileRow as any)?.full_name
        ?? null;

      const { data: newConv } = await sb
        .from("whatsapp_conversations" as any)
        .insert({
          phone_number:    fromPhone,
          display_name:    displayName,
          student_user_id: studentUserId,
        })
        .select("id")
        .single();
      convId = (newConv as any).id;
    }

    // Insert message (trigger fires to update conversation stats)
    await sb.from("whatsapp_messages" as any).insert({
      conversation_id: convId,
      wamid,
      direction:    "inbound",
      message_type: msgType,
      body,
      media_url:    mediaUrl,
      status:       "delivered",
    });

    // Also route as in-app notification to admin
    const { data: adminRole } = await sb
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .single();

    if (adminRole) {
      await sb.from("notifications" as any).insert({
        user_id:    adminRole.user_id,
        event_type: "new_message",
        title:      `WhatsApp reply from ${fromPhone}`,
        message:    body.slice(0, 200),
        metadata:   { conversation_id: convId, phone: fromPhone, student_user_id: studentUserId },
      });
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
