// whatsapp-webhook/index.ts
// Handles Meta's WhatsApp Cloud API webhook.
//
// Two roles:
//   GET  → Webhook verification (Meta sends a challenge, we echo it back)
//   POST → Incoming events: delivery receipts, read receipts, inbound messages
//
// Webhook URL to paste into Meta Dashboard:
//   https://YOUR_PROJECT_REF.supabase.co/functions/v1/whatsapp-webhook

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  // ── GET: Meta webhook verification ────────────────────────────────
  if (req.method === "GET") {
    const url    = new URL(req.url);
    const mode      = url.searchParams.get("hub.mode");
    const token     = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const verifyToken = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN") ?? "";

    if (mode === "subscribe" && token === verifyToken && challenge) {
      console.log("[whatsapp-webhook] Webhook verified by Meta ✅");
      // Meta expects the challenge echoed back as plain text with 200
      return new Response(challenge, { status: 200 });
    }

    console.warn("[whatsapp-webhook] Verification failed — wrong verify_token or missing params");
    return new Response("Forbidden", { status: 403 });
  }

  // ── POST: Incoming events from Meta ──────────────────────────────
  if (req.method === "POST") {
    // Read raw body FIRST so we can verify Meta's HMAC signature
    const rawBody = await req.arrayBuffer();

    // Verify X-Hub-Signature-256 (fail closed if secret not configured)
    const appSecret = Deno.env.get("WHATSAPP_APP_SECRET") ?? "";
    if (!appSecret) {
      console.warn("[whatsapp-webhook] WHATSAPP_APP_SECRET not configured — rejecting");
      return new Response("Forbidden", { status: 403 });
    }
    const sigHeader = req.headers.get("x-hub-signature-256") ?? "";
    try {
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(appSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const mac = await crypto.subtle.sign("HMAC", key, rawBody);
      const expected = "sha256=" + Array.from(new Uint8Array(mac))
        .map((b) => b.toString(16).padStart(2, "0")).join("");
      // Constant-time-ish compare
      if (sigHeader.length !== expected.length) {
        return new Response("Forbidden", { status: 403 });
      }
      let diff = 0;
      for (let i = 0; i < expected.length; i++) {
        diff |= sigHeader.charCodeAt(i) ^ expected.charCodeAt(i);
      }
      if (diff !== 0) {
        return new Response("Forbidden", { status: 403 });
      }
    } catch (err) {
      console.error("[whatsapp-webhook] HMAC verification error:", err);
      return new Response("Forbidden", { status: 403 });
    }

    let payload: any;
    try {
      payload = JSON.parse(new TextDecoder().decode(rawBody));
    } catch {
      return new Response("Bad Request", { status: 400 });
    }


    // Extract the first entry + change
    const entry   = payload?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value   = changes?.value;

    if (!value) {
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Handle delivery/read status updates
    const statuses = value?.statuses ?? [];
    for (const status of statuses) {
      const wamid      = status.id;
      const newStatus  = status.status; // "sent" | "delivered" | "read" | "failed"
      if (!wamid) continue;

      await supabase
        .from("whatsapp_message_log" as any)
        .update({ status: newStatus === "read" ? "delivered" : newStatus })
        .eq("wamid", wamid);

      console.log(`[whatsapp-webhook] Status update: ${wamid} → ${newStatus}`);
    }

    // Handle inbound messages (students replying to WhatsApp)
    const messages = value?.messages ?? [];
    for (const msg of messages) {
      const from    = msg.from;   // phone number (e.g. 254712...)
      const text    = msg.text?.body ?? msg.type ?? "(non-text)";
      const type    = msg.type;

      console.log(`[whatsapp-webhook] Inbound from ${from}: "${text}" (${type})`);

      // Look up the student by their WhatsApp number
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("whatsapp_number", from)
        .maybeSingle();

      if (profile) {
        // Find admin to use as sender for the in-app reply
        const { data: adminRow } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin")
          .limit(1)
          .single();

        if (adminRow) {
          // Route the inbound WhatsApp message as a private message in the platform
          await supabase.from("private_messages").insert({
            sender_id:   profile.user_id,
            receiver_id: adminRow.user_id,
            content:     `[WhatsApp reply from ${profile.full_name ?? from}]: ${text}`,
            is_read:     false,
          });
          console.log(`[whatsapp-webhook] Inbound message saved for user ${profile.user_id}`);
        }
      }
    }

    // Always return 200 quickly so Meta doesn't retry
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  return new Response("Method Not Allowed", { status: 405 });
});
