/**
 * nexus-register — one-shot integration setup (TASK 3).
 *
 * POST (admin JWT or x-whatsapp-internal-key) → registers NEXUS_APP_WEBHOOK_URL
 * with the Nexus WhatsApp Gateway so inbound messages are forwarded to us.
 *
 * Call it once after deploy (or any time the webhook URL changes).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { registerWebhook, gatewayConfigured, defaultWebhookUrl, extractWebhookSecret, saveWebhookInfo } from "../_shared/nexusGateway.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Auth: internal key (deploy hook / DB) or admin JWT.
  const internalKey = req.headers.get("x-whatsapp-internal-key") ?? "";
  const triggerKey = (Deno.env.get("WHATSAPP_TRIGGER_KEY") ?? "").trim();
  const legacyKey = (Deno.env.get("WHATSAPP_INTERNAL_KEY") ?? "").trim();
  const isInternal = (triggerKey && internalKey === triggerKey) || (legacyKey && internalKey === legacyKey);

  if (!isInternal) {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userSb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userSb.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { data: roleRow } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Forbidden — admin only" }, 403);
  }

  if (!(await gatewayConfigured())) {
    return json({ error: "Nexus Gateway not configured — connect it in Admin → WhatsApp → Settings" }, 500);
  }

  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const webhookUrl =
    (body as Record<string, string>)?.url?.trim() || (await defaultWebhookUrl());

  if (!webhookUrl) return json({ error: "Could not determine this app's public webhook URL" }, 500);

  const result = await registerWebhook(webhookUrl);
  if (!result.success) {
    return json({ success: false, url: webhookUrl, error: result.error }, result.status ?? 502);
  }
  const secret = extractWebhookSecret(result.data);
  await saveWebhookInfo(webhookUrl, secret);
  return json({ success: true, url: webhookUrl, receiving_live: !!secret });
});
