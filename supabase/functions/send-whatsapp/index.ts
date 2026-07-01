// send-whatsapp/index.ts
// Called by the Postgres pg_net trigger on every notification insert.
// Sends the appropriate WhatsApp template message via Meta Cloud API.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-whatsapp-internal-key",
};

// ── Template definitions ───────────────────────────────────────────
// These MUST match the names you register in Meta Business Manager.
// See WHATSAPP_TEMPLATES_GUIDE.md for the exact text to submit.

const PLATFORM_URL = "https://nexus-ai-skills-academy.lovable.app";

type TemplatePayload = {
  name: string;
  components: object[];
};

function buildTemplate(
  eventType: string,
  title: string,
  message: string,
  metadata: Record<string, string>,
  userName: string,
): TemplatePayload {
  const dashboard = `${PLATFORM_URL}/dashboard`;
  const link = metadata.link ? `${PLATFORM_URL}${metadata.link}` : dashboard;

  switch (eventType) {
    case "lesson_unlocked":
      return {
        name: "nexus_lesson_unlocked",
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: userName },
            { type: "text", text: title.replace("Lesson unlocked: ", "").replace("Next lesson unlocked: ", "") },
            { type: "text", text: metadata.course_title ?? "your course" },
            { type: "text", text: link },
          ],
        }],
      };

    case "trial_expiry":
      return {
        name: "nexus_trial_expiry_reminder",
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: userName },
            { type: "text", text: `${PLATFORM_URL}/subscribe` },
          ],
        }],
      };

    case "certificate_earned":
      return {
        name: "nexus_certificate_earned",
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: userName },
            { type: "text", text: metadata.course_name ?? "your course" },
            { type: "text", text: link },
          ],
        }],
      };

    case "payment_confirmed":
      return {
        name: "nexus_payment_confirmed",
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: userName },
            { type: "text", text: dashboard },
          ],
        }],
      };

    case "new_message":
      return {
        name: "nexus_new_message",
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: userName },
            { type: "text", text: metadata.sender_name ?? "Someone" },
            { type: "text", text: `${PLATFORM_URL}/dashboard/messages` },
          ],
        }],
      };

    case "new_opportunity":
    case "application_update":
    case "shortlisted":
    case "hired":
      return {
        name: "nexus_job_update",
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: userName },
            { type: "text", text: message || title },
            { type: "text", text: link },
          ],
        }],
      };

    case "announcement":
      return {
        name: "nexus_announcement",
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: title },
            { type: "text", text: userName },
            { type: "text", text: message || "See the latest update on the platform." },
            { type: "text", text: dashboard },
          ],
        }],
      };

    default:
      // Catch-all — works for comment, like, profile_view, etc.
      return {
        name: "nexus_general_update",
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: userName },
            { type: "text", text: title },
            { type: "text", text: message || "You have a new update." },
            { type: "text", text: link },
          ],
        }],
      };
  }
}

// ── Phone normaliser ───────────────────────────────────────────────
// Accepts: +254712…, 0712…, 254712…  → returns 254712…
function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return "254" + digits.slice(1);
  if (digits.startsWith("7") && digits.length === 9) return "254" + digits;
  if (digits.length >= 10) return digits; // other country codes
  return null;
}

// ── Main handler ───────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  // Validate internal key (shared secret between DB trigger and this function).
  // Fail closed: reject when the key is missing or does not match.
  const internalKey = req.headers.get("x-whatsapp-internal-key") ?? "";
  const expectedKey = Deno.env.get("WHATSAPP_INTERNAL_KEY") ?? "";
  if (!expectedKey || internalKey !== expectedKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const phoneNumberId  = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const permanentToken = Deno.env.get("WHATSAPP_PERMANENT_TOKEN");

  if (!phoneNumberId || !permanentToken) {
    return new Response(
      JSON.stringify({ error: "WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_PERMANENT_TOKEN not set in Supabase secrets" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();
    const { notification_id, user_id, event_type, title, message, metadata, phone_number } = body;

    if (!user_id) {
      return new Response(JSON.stringify({ error: "Missing user_id" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Use phone from trigger payload, fallback to DB lookup
    let rawPhone = phone_number;
    let userName = "Student";

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, whatsapp_number, whatsapp_opted_in")
      .eq("user_id", user_id)
      .maybeSingle();

    if (!rawPhone) rawPhone = profile?.whatsapp_number;
    if (profile?.full_name) userName = profile.full_name.split(" ")[0]; // first name only

    // Always require opt-in — never bypass based on request-supplied phone_number
    if (!profile?.whatsapp_opted_in) {
      return new Response(JSON.stringify({ skipped: "User not opted in" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    if (!rawPhone) {
      return new Response(JSON.stringify({ skipped: "No phone number" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const toPhone = normalisePhone(rawPhone);
    if (!toPhone) {
      return new Response(JSON.stringify({ error: `Invalid phone: ${rawPhone}` }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const template = buildTemplate(
      event_type ?? "general",
      title ?? "",
      message ?? "",
      (metadata as Record<string, string>) ?? {},
      userName,
    );

    // ── Send via Meta WhatsApp Cloud API ──────────────────────────
    const metaRes = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${permanentToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: toPhone,
          type: "template",
          template: {
            name: template.name,
            language: { code: "en" },
            components: template.components,
          },
        }),
      },
    );

    const metaData = await metaRes.json();
    const wamid = metaData?.messages?.[0]?.id ?? null;
    const success = metaRes.ok && !!wamid;

    // ── Log the attempt ───────────────────────────────────────────
    await supabase.from("whatsapp_message_log" as any).insert({
      user_id,
      phone_number: toPhone,
      template_name: template.name,
      event_type: event_type ?? "unknown",
      notification_id: notification_id ?? null,
      status: success ? "sent" : "failed",
      error_message: success ? null : JSON.stringify(metaData),
      wamid,
    });

    return new Response(
      JSON.stringify({ success, wamid, template: template.name }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[send-whatsapp] Error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
