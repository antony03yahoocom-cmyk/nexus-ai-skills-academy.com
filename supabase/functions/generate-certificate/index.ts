import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { course_id } = await req.json();
    if (!course_id) {
      return new Response(JSON.stringify({ error: "course_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify the user has paid for this course or is premium
    const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!profile.is_premium) {
      const { data: purchase } = await supabase
        .from("course_purchases")
        .select("id")
        .eq("user_id", user.id)
        .eq("course_id", course_id)
        .eq("status", "paid")
        .maybeSingle();

      if (!purchase) {
        return new Response(JSON.stringify({ error: "You must purchase this course before receiving a certificate" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Verify enrollment exists
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("id")
      .eq("user_id", user.id)
      .eq("course_id", course_id)
      .maybeSingle();

    if (!enrollment) {
      return new Response(JSON.stringify({ error: "You are not enrolled in this course" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch course
    const { data: course } = await supabase.from("courses").select("*").eq("id", course_id).single();
    if (!course) {
      return new Response(JSON.stringify({ error: "Course not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify all lessons completed
    const { data: modules } = await supabase.from("modules").select("id").eq("course_id", course_id);
    const moduleIds = modules?.map((m: any) => m.id) ?? [];
    
    if (moduleIds.length === 0) {
      return new Response(JSON.stringify({ error: "Course has no modules" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: allLessons } = await supabase.from("lessons").select("id").in("module_id", moduleIds);
    const { data: completions } = await supabase.from("lesson_completions").select("lesson_id").eq("user_id", user.id);

    const completedIds = new Set(completions?.map((c: any) => c.lesson_id) ?? []);
    const allCompleted = allLessons?.every((l: any) => completedIds.has(l.id)) ?? false;

    if (!allCompleted) {
      return new Response(JSON.stringify({ error: "Not all lessons completed", completed: completedIds.size, total: allLessons?.length }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check if certificate already exists
    const { data: existing } = await supabase.from("certificates").select("*").eq("student_id", user.id).eq("course_id", course_id).eq("status", "Issued").maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ certificate: existing }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const certId = crypto.randomUUID();
    const completionDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const escapeXml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

    const studentName = escapeXml(profile.full_name || "Student");
    const courseName = escapeXml(course.title);

    // Generate SVG certificate
    const svgCert = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg)"/>
  <rect x="20" y="20" width="760" height="560" rx="8" fill="none" stroke="url(#accent)" stroke-width="2"/>
  <rect x="30" y="30" width="740" height="540" rx="6" fill="none" stroke="#334155" stroke-width="1"/>
  <text x="400" y="100" text-anchor="middle" fill="#6366f1" font-family="Arial,sans-serif" font-size="14" letter-spacing="4">NEXUS AI ACADEMY</text>
  <text x="400" y="160" text-anchor="middle" fill="#f8fafc" font-family="Georgia,serif" font-size="36" font-weight="bold">Certificate of Completion</text>
  <line x1="250" y1="185" x2="550" y2="185" stroke="url(#accent)" stroke-width="2"/>
  <text x="400" y="230" text-anchor="middle" fill="#94a3b8" font-family="Arial,sans-serif" font-size="14">This is to certify that</text>
  <text x="400" y="280" text-anchor="middle" fill="#f8fafc" font-family="Georgia,serif" font-size="30">${studentName}</text>
  <text x="400" y="330" text-anchor="middle" fill="#94a3b8" font-family="Arial,sans-serif" font-size="14">has successfully completed the course</text>
  <text x="400" y="375" text-anchor="middle" fill="#06b6d4" font-family="Georgia,serif" font-size="24" font-weight="bold">${courseName}</text>
  <text x="400" y="430" text-anchor="middle" fill="#94a3b8" font-family="Arial,sans-serif" font-size="12">Issued on ${completionDate}</text>
  <text x="400" y="500" text-anchor="middle" fill="#475569" font-family="monospace" font-size="10">Certificate ID: ${certId}</text>
  <line x1="250" y1="530" x2="350" y2="530" stroke="#475569" stroke-width="1"/>
  <text x="300" y="550" text-anchor="middle" fill="#64748b" font-family="Arial,sans-serif" font-size="10">Academy Director</text>
  <line x1="450" y1="530" x2="550" y2="530" stroke="#475569" stroke-width="1"/>
  <text x="500" y="550" text-anchor="middle" fill="#64748b" font-family="Arial,sans-serif" font-size="10">Date: ${completionDate}</text>
</svg>`;

    const svgBlob = new Blob([svgCert], { type: "image/svg+xml" });
    const filePath = `${user.id}/${certId}.svg`;

    const { error: uploadError } = await supabase.storage.from("certificates").upload(filePath, svgBlob, { contentType: "image/svg+xml" });
    if (uploadError) {
      return new Response(JSON.stringify({ error: "Certificate generation failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: urlData } = await supabase.storage.from("certificates").createSignedUrl(filePath, 60 * 60 * 24 * 365);

    const { data: cert, error: insertError } = await supabase.from("certificates").insert({
      id: certId,
      student_id: user.id,
      course_id,
      certificate_link: urlData?.signedUrl || filePath,
      status: "Issued",
      issued_date: new Date().toISOString().split("T")[0],
    }).select().single();

    if (insertError) {
      return new Response(JSON.stringify({ error: "Certificate record creation failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ certificate: cert }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
