// Sends psychological-trigger follow-up in-app messages to inactive students.
// Triggerable manually by admin or via cron.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Nudge { key: string; daysSince: number; title: string; body: string; }

const NUDGES: Nudge[] = [
  {
    key: "day2_20pct",
    daysSince: 2,
    title: "🚀 You're 20% done — don't stop now",
    body: "You started something most people never do. The momentum you built is still there — open your next lesson and keep going. Future you will thank you.",
  },
  {
    key: "day4_first_client",
    daysSince: 4,
    title: "💼 You're closer to your first paying client than you think",
    body: "Every lesson you complete is one step closer to skills you can charge for. Don't waste what you started — pick up where you left off.",
  },
  {
    key: "day7_committed",
    daysSince: 7,
    title: "🎯 Only committed students succeed — are you one?",
    body: "Most people quit here. The ones who push through become the ones companies hire. Don't be average. Open your course and prove it to yourself.",
  },
  {
    key: "day14_last_call",
    daysSince: 14,
    title: "⏰ You're 2 lessons away from a real breakthrough",
    body: "Your skills don't pause when you do — they fade. Come back today and reclaim what you started. One lesson is all it takes to restart momentum.",
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: callerAdmin } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!callerAdmin) {
      return new Response(JSON.stringify({ error: "Admins only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find admin (sender)
    const { data: adminRow } = await supabase
      .from("user_roles").select("user_id").eq("role", "admin").limit(1).single();
    if (!adminRow) return new Response(JSON.stringify({ error: "no admin" }), { status: 200, headers: corsHeaders });
    const adminId = adminRow.user_id;

    // All enrolled students with their last completion
    const { data: enrollments } = await supabase
      .from("enrollments").select("user_id, course_id, enrolled_at");
    if (!enrollments) return new Response(JSON.stringify({ sent: 0 }), { headers: corsHeaders });

    let sent = 0;
    const now = Date.now();

    // Group: per user, find latest completion across all lessons
    const userIds = [...new Set(enrollments.map((e) => e.user_id))];
    const { data: completions } = await supabase
      .from("lesson_completions").select("user_id, completed_at").in("user_id", userIds);
    const lastByUser: Record<string, number> = {};
    for (const u of userIds) {
      const enr = enrollments.find((e) => e.user_id === u);
      lastByUser[u] = enr ? new Date(enr.enrolled_at).getTime() : now;
    }
    for (const c of completions ?? []) {
      const t = new Date(c.completed_at as string).getTime();
      if (!lastByUser[c.user_id] || t > lastByUser[c.user_id]) lastByUser[c.user_id] = t;
    }

    // Existing log entries
    const { data: logs } = await supabase.from("followup_log").select("user_id, nudge_key");
    const sentSet = new Set((logs ?? []).map((l) => `${l.user_id}::${l.nudge_key}`));

    for (const userId of userIds) {
      if (userId === adminId) continue;
      const daysInactive = Math.floor((now - lastByUser[userId]) / 86400000);
      // Pick the LARGEST eligible nudge that hasn't been sent yet
      const eligible = NUDGES.filter((n) => daysInactive >= n.daysSince).reverse();
      for (const n of eligible) {
        if (sentSet.has(`${userId}::${n.key}`)) continue;
        // Send message
        const { error: msgErr } = await supabase.from("private_messages").insert({
          sender_id: adminId, receiver_id: userId,
          content: `${n.title}\n\n${n.body}`, is_read: false,
        });
        if (!msgErr) {
          await supabase.from("followup_log").insert({ user_id: userId, nudge_key: n.key });
          sent++;
        }
        break; // one nudge per run per user
      }
    }

    return new Response(JSON.stringify({ sent, totalUsers: userIds.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-followups error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: corsHeaders });
  }
});
