// send-whatsapp/index.ts
// Called by the Postgres pg_net trigger on every notification insert.
// Sends the matching approved WhatsApp template through the Nexus WhatsApp Gateway.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  extractWamid,
  gatewayConfigured,
  optInContact,
  sendWhatsAppTemplate,
  toDigits,
} from "../_shared/nexusGateway.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-whatsapp-internal-key",
};

const PLATFORM_URL = "https://nexus-ai-skills-academy.lovable.app";

type TemplatePayload = { name: string; variables: string[] };

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
        variables: [
          userName,
          title.replace("Lesson unlocked: ", "").replace("Next lesson unlocked: ", ""),
          metadata.course_title ?? "your course",
          link,
        ],
      };

    case "trial_expiry":
      return { name: "nexus_trial_expiry_reminder", variables: [userName, `${PLATFORM_URL}/subscribe`] };

    case "certificate_earned":
      return {
        name: "nexus_certificate_earned",
        variables: [userName, metadata.course_name ?? "your course", link],
      };

    case "payment_confirmed":
      return { name: "nexus_payment_confirmed", variables: [userName, dashboard] };

    case "new_message":
      return {
        name: "nexus_new_message",
        variables: [userName, metadata.sender_name ?? "Someone", `${PLATFORM_URL}/dashboard/messages`],
      };

    case "new_opportunity":
    case "application_update":
    case "shortlisted":
    case "hired":
      return { name: "nexus_job_update", variables: [userName, message || title, link] };

    case "announcement":
      return {
        name: "nexus_announcement",
        variables: [title, userName, message || "See the latest update on the platform.", dashboard],
      };

    default:
      return {
        name: "nexus_general_update",
        variables: [userName, title, message || "You have a new update.", link],
      };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  // Validate internal key (shared secret between DB trigger and this function).
  // Fail closed: reject when the key is missing or does not match.
  const internalKey = req.headers.get("x-whatsapp-internal-key") ?? "";
  const expectedKey = (Deno.env.get("WHATSAPP_INTERNAL_KEY") ?? "").trim();
  const triggerKey = (Deno.env.get("WHATSAPP_TRIGGER_KEY") ?? "").trim();
  const validKey = (expectedKey && internalKey === expectedKey) || (triggerKey && internalKey === triggerKey);
  if (!validKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (!(await gatewayConfigured())) {
    return new Response(
      JSON.stringify({ error: "Nexus Gateway not configured — connect it in Admin → WhatsApp → Settings" }),
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

    let rawPhone = phone_number;
    let userName = "Student";

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, whatsapp_number, whatsapp_opted_in")
      .eq("user_id", user_id)
      .maybeSingle();

    if (!rawPhone) rawPhone = profile?.whatsapp_number;
    if (profile?.full_name) userName = profile.full_name.split(" ")[0];

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

    const toPhone = toDigits(rawPhone);
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

    // Register/refresh consent, then send via the gateway.
    await optInContact(toPhone, profile?.full_name ?? userName);
    const res = await sendWhatsAppTemplate(toPhone, template.name, "en", template.variables);
    const wamid = res.success ? extractWamid(res.data) : null;
    const success = res.success;

    await supabase.from("whatsapp_message_log" as any).insert({
      user_id,
      phone_number: toPhone,
      template_name: template.name,
      event_type: event_type ?? "unknown",
      notification_id: notification_id ?? null,
      status: success ? "sent" : "failed",
      error_message: success ? null : (res.error ?? "Unknown gateway error").slice(0, 500),
      wamid,
    });

    return new Response(
      JSON.stringify({ success, wamid, template: template.name, error: success ? undefined : res.error }),
      { status: success ? 200 : 502, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[send-whatsapp] Error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
