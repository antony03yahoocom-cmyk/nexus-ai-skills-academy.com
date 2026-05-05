// Promotes an existing user (by email) to admin. Caller must be admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roleRow } = await admin.from("user_roles")
      .select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return new Response(JSON.stringify({ error: "Admins only" }), { status: 403, headers: corsHeaders });

    const { email } = await req.json();
    const targetEmail = String(email ?? "").trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes("@")) {
      return new Response(JSON.stringify({ error: "Valid email required" }), { status: 400, headers: corsHeaders });
    }

    // Find user by email via auth admin API
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listErr) throw listErr;
    const target = list.users.find((u) => (u.email ?? "").toLowerCase() === targetEmail);
    if (!target) return new Response(JSON.stringify({ error: "User with that email not found. They must sign up first." }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const { error: insErr } = await admin.from("user_roles")
      .insert({ user_id: target.id, role: "admin" });
    if (insErr && !String(insErr.message).includes("duplicate")) throw insErr;

    return new Response(JSON.stringify({ success: true, user_id: target.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
