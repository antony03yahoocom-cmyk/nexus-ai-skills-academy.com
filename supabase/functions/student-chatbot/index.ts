/**
 * student-chatbot/index.ts
 *
 * NEXUS AI — Context-Aware Platform Tutor
 *
 * Before: Generic system prompt with no knowledge of the student.
 *         The AI didn't know the student's name, their enrolled courses,
 *         their progress, pending assignments, skills, XP, or available jobs.
 *         It was a generic FAQ bot wearing an "AI tutor" hat.
 *
 * After:  On every request the function fetches the student's live platform
 *         data and injects it into the system prompt so the AI knows:
 *
 *   - Who they are (name, account type, trial days left)
 *   - Exactly which courses they're enrolled in and their progress %
 *   - How many lessons they've completed in total
 *   - Which assignments are Pending review or need revision (Rejected)
 *   - Their feedback on rejected submissions
 *   - Their skills, XP, rank from the marketplace profile
 *   - Certificates they've earned
 *   - Job/internship/freelance opportunities matching their skills
 *   - Recent platform announcements
 *   - Courses they haven't enrolled in yet (for recommendations)
 *   - The EXACT content of the lesson they're currently viewing (if any)
 *   - The assignment brief for that lesson (if any)
 *
 * This transforms the AI from a generic chatbot into a personal tutor that
 * can answer: "What should I do next?", "Help me with this assignment",
 * "How am I doing?", "What jobs match my skills?", "Explain what I just read"
 * — all with real, accurate, student-specific answers.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Helpers ────────────────────────────────────────────────────────

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function trialDaysLeft(trialStartDate: string | null): number {
  if (!trialStartDate) return 0;
  const elapsed = Math.floor(
    (Date.now() - new Date(trialStartDate).getTime()) / 86_400_000
  );
  return Math.max(0, 7 - elapsed);
}

// ── Build the system prompt with live student context ──────────────

function buildSystemPrompt(ctx: StudentContext): string {
  const now = new Date().toLocaleDateString("en-KE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  // ── Account status ─────────────────────────────────────────────
  let accountLine = "Free account";
  if (ctx.isPremium || ctx.subscriptionStatus === "paid") {
    accountLine = "✅ Premium member — full access to all courses";
  } else if (ctx.trialDaysLeft > 0) {
    accountLine = `⏰ Free trial — ${ctx.trialDaysLeft} day${ctx.trialDaysLeft !== 1 ? "s" : ""} remaining`;
  }

  // ── Enrolled courses ───────────────────────────────────────────
  const enrollmentLines = ctx.enrollments.length
    ? ctx.enrollments.map(e =>
        `  • "${e.courseTitle}" — ${e.progress}% complete` +
        (e.progress === 100 ? " 🎉" : e.progress === 0 ? " (not started)" : "")
      ).join("\n")
    : "  (not enrolled in any courses yet)";

  // ── Attention items ────────────────────────────────────────────
  const attentionItems: string[] = [];
  if (ctx.pendingSubmissions.length) {
    attentionItems.push(
      `📋 ${ctx.pendingSubmissions.length} assignment${ctx.pendingSubmissions.length > 1 ? "s" : ""} awaiting instructor review:\n` +
      ctx.pendingSubmissions.map(s => `    - "${s.assignmentTitle}" in "${s.courseTitle}"`).join("\n")
    );
  }
  if (ctx.rejectedSubmissions.length) {
    attentionItems.push(
      `🔄 ${ctx.rejectedSubmissions.length} assignment${ctx.rejectedSubmissions.length > 1 ? "s" : ""} sent back for revision:\n` +
      ctx.rejectedSubmissions.map(s =>
        `    - "${s.assignmentTitle}" in "${s.courseTitle}"` +
        (s.feedback ? `\n      Instructor feedback: "${s.feedback}"` : "")
      ).join("\n")
    );
  }
  const attentionBlock = attentionItems.length
    ? attentionItems.join("\n")
    : "  ✅ No pending items — well done!";

  // ── Skills & rank ──────────────────────────────────────────────
  const skillsLine = ctx.skills.length
    ? ctx.skills.join(", ")
    : "none listed yet (encourage them to update their profile)";

  // ── Certificates ───────────────────────────────────────────────
  const certsLine = ctx.certificates.length
    ? ctx.certificates.map(c => `"${c}"`).join(", ")
    : "none yet";

  // ── Job opportunities matching their skills ────────────────────
  const opportunitiesBlock = ctx.matchedOpportunities.length
    ? ctx.matchedOpportunities.map(o =>
        `  • [${o.type.replace("_", " ").toUpperCase()}] "${o.title}" — ${o.locationtype} | Budget: ${o.budget || "negotiable"} | Skills: ${o.skills.join(", ")}`
      ).join("\n")
    : "  No active opportunities matching their skills right now";

  // ── Unenrolled courses (recommendations) ──────────────────────
  const recommendBlock = ctx.unenrolledCourses.length
    ? ctx.unenrolledCourses.map(c => `  • "${c.title}" (${c.category}) — KES ${c.price.toLocaleString()}`).join("\n")
    : "  Student is enrolled in all available courses";

  // ── Announcements ──────────────────────────────────────────────
  const announcementsBlock = ctx.announcements.length
    ? ctx.announcements.map(a => `  • ${a.title}: ${a.content.slice(0, 120)}${a.content.length > 120 ? "…" : ""}`).join("\n")
    : "  No recent announcements";

  // ── Current lesson context ─────────────────────────────────────
  let currentLessonBlock = "";
  if (ctx.currentLesson) {
    const l = ctx.currentLesson;
    currentLessonBlock = `
## 📖 LESSON THE STUDENT IS CURRENTLY VIEWING
Course: "${l.courseName}" → Module: "${l.moduleName}" → Lesson: "${l.title}"
Content type: ${l.contentType}
${l.contentText
    ? `\nLesson text (use this to explain concepts in your own words — DO NOT copy-paste it):\n"""\n${l.contentText.slice(0, 2000)}${l.contentText.length > 2000 ? "\n[...content continues...]" : ""}\n"""`
    : "(lesson content is a video or file — you cannot read it but can discuss the topic based on its title)"}
${ctx.currentAssignment
    ? `\nAssignment for this lesson:
Title: "${ctx.currentAssignment.title}"
Objective: ${ctx.currentAssignment.objective || "not specified"}
Task: ${ctx.currentAssignment.task || ctx.currentAssignment.description || "not specified"}
Deliverable: ${ctx.currentAssignment.deliverable || "not specified"}
Note: NEVER give the student the answer directly. Guide them to discover it.`
    : "\n(This lesson has no assignment)"}`;
  }

  // ── Platform navigation ────────────────────────────────────────
  const platformNav = `
## 🗺️ PLATFORM NAVIGATION
When directing the student, use these exact URLs:
  /dashboard          — Student home: progress, quick stats, enrolled courses
  /courses            — Browse and enroll in courses
  /lesson/[id]        — Open a specific lesson (IDs come from enrollment data)
  /dashboard/projects — Submit and view projects
  /dashboard/certificates — View earned certificates
  /dashboard/messages — Private messaging with instructors/classmates
  /dashboard/settings / /dashboard/profile — Update name, photo, WhatsApp
  /community          — Community hub: posts, discussions, groups
  /discussions        — Discussion group chats
  /dashboard/classmates — Find and connect with other students
  /subscribe          — Upgrade to Premium (KES pricing, M-Pesa supported)
  /employer/signup    — Register as an employer to post opportunities
  /employer/dashboard — Employer portal: post jobs, search talent
  /portfolio          — Public portfolio / marketplace profile`;

  return `# NEXUS AI — Your Personal Learning Intelligence
Today: ${now}

You are **NEXUS AI**, the intelligent tutor built into NEXUS AI Skills Academy — an elite online learning platform in Kenya focused on AI, tech, and digital skills for Africa. You are not a generic chatbot. You are this student's personal academic guide, career advisor, and skill-building partner. You know them, their journey, their progress, and their potential.

---

## 👤 THIS STUDENT
Name: ${ctx.name}
Account: ${accountLine}
Total lessons completed across all courses: ${ctx.totalCompletions}
Rank: ${ctx.rank || "Beginner"} | XP: ${ctx.xp.toLocaleString()}
Skills on profile: ${skillsLine}
Certificates earned: ${certsLine}

## 📚 ENROLLED COURSES
${enrollmentLines}

## ⚡ WHAT NEEDS ATTENTION RIGHT NOW
${attentionBlock}

## 💼 JOB & FREELANCE OPPORTUNITIES (MATCHING THEIR SKILLS)
${opportunitiesBlock}

## 🎓 COURSES AVAILABLE TO ENROLL IN
${recommendBlock}

## 📢 RECENT PLATFORM ANNOUNCEMENTS
${announcementsBlock}
${currentLessonBlock}
${platformNav}

---

## 🎯 YOUR ROLE & TEACHING PHILOSOPHY

You are a brilliant, warm, and deeply knowledgeable tutor. Your mission is not just to answer questions — it is to build lasting understanding and career-ready skills in every student you teach.

### Teaching techniques you always use:

1. **Personal & Specific**: You know this student's name, courses, and progress. Use this. Don't give generic answers when you can give specific ones. "You're 45% through Digital Entrepreneurship — your next step is..." beats "Check your dashboard."

2. **Feynman Method**: When explaining a concept, start with the simplest possible explanation ("Imagine you run a *mkokoteni* business..."), then progressively add complexity only as needed.

3. **Africa-First Context**: Use Kenyan and East African analogies. Explain APIs using M-Pesa integration. Explain databases using matatu records. Explain machine learning using crop prediction for Kenyan farmers. Make tech feel local and achievable.

4. **Socratic for Assignments**: NEVER give direct answers to assignments. Instead, ask guiding questions: "What do you think the first step would be?" → "What happens if you apply X to Y?" → "How would you test that?" The learning is in the discovery.

5. **Assignment Feedback Coaching**: If a submission was rejected (you can see the instructor feedback above), help the student understand WHY and HOW to fix it — without doing it for them.

6. **Career Connection**: Always connect what the student is learning to real income opportunities in Kenya. "This Python skill you're building? There are ${ctx.matchedOpportunities.length} open opportunities on NEXUS right now that need it."

7. **Momentum Maintenance**: If the student seems stuck, acknowledge it, normalise it ("Every developer gets stuck here"), then break the problem into tiny solvable steps.

8. **Celebrate Progress**: When a student mentions completing something, celebrate it genuinely. Reference their actual XP and rank.

9. **Honest About Limits**: If you don't know something platform-specific (like a specific lesson's content when it's a video), say so honestly and offer to help in another way.

### Response style:
- Warm but intellectually sharp — like a brilliant Kenyan mentor who wants you to succeed
- Use markdown: **bold** for key terms, \`code\` for technical terms, numbered steps for processes
- Keep first responses focused (3-5 sentences is often enough). Don't write an essay unprompted.
- End responses with a specific next step OR a guiding question that deepens understanding
- When referencing their courses or progress, be specific — use actual numbers and course names from their data above

### What you NEVER do:
- Give assignment answers directly
- Make up platform features or URLs that don't exist
- Claim a student has completed something they haven't (you have their real data)
- Be generic when you have specific data to use
- Add disclaimers like "I'm just an AI" — you are their tutor, act like one
- Suggest they "contact support" for things you can clearly help with yourself`;
}

// ── Types ──────────────────────────────────────────────────────────

interface StudentContext {
  name: string;
  isPremium: boolean;
  subscriptionStatus: string;
  trialDaysLeft: number;
  totalCompletions: number;
  rank: string;
  xp: number;
  skills: string[];
  certificates: string[];
  enrollments: { courseTitle: string; progress: number }[];
  pendingSubmissions: { assignmentTitle: string; courseTitle: string }[];
  rejectedSubmissions: { assignmentTitle: string; courseTitle: string; feedback: string | null }[];
  matchedOpportunities: { title: string; type: string; locationtype: string; budget: string | null; skills: string[] }[];
  unenrolledCourses: { title: string; category: string; price: number }[];
  announcements: { title: string; content: string }[];
  currentLesson: {
    title: string; contentText: string | null; contentType: string;
    courseName: string; moduleName: string;
  } | null;
  currentAssignment: {
    title: string; objective: string | null; task: string | null;
    description: string | null; deliverable: string | null;
  } | null;
}

// ── Main handler ───────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  try {
    // ── Auth ────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    // ── Parse body ──────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const rawMessages: unknown[] = Array.isArray(body?.messages) ? body.messages : [];
    const clientContext: { current_lesson_id?: string; current_path?: string } = body?.context ?? {};

    if (!rawMessages.length || rawMessages.length > 40) {
      return json({ error: "Invalid messages payload" }, 400);
    }

    // Sanitize — reject non-user/assistant roles and oversized content (prompt-injection guard)
    const safeMessages = rawMessages.filter(
      (m: any) => (m?.role === "user" || m?.role === "assistant") &&
        typeof m?.content === "string" && m.content.length > 0 && m.content.length <= 6000
    );
    if (!safeMessages.length) return json({ error: "Invalid message format" }, 400);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // ── Fetch student context (service role for joins/cross-table access) ──
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const userId = user.id;
    const currentLessonId = clientContext.current_lesson_id ?? null;

    // All platform data in parallel
    const [
      profileRes,
      enrollmentsRes,
      completionsRes,
      submissionsRes,
      marketplaceRes,
      certsRes,
      announcementsRes,
      allPublishedCoursesRes,
      opportunitiesRes,
      currentLessonRes,
    ] = await Promise.all([
      sb.from("profiles")
        .select("full_name, is_premium, subscription_status, trial_start_date")
        .eq("user_id", userId).maybeSingle(),

      sb.from("enrollments")
        .select("progress, courses(id, title)")
        .eq("user_id", userId),

      sb.from("lesson_completions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),

      sb.from("submissions")
        .select("status, feedback, assignments(title, lesson_id)")
        .eq("user_id", userId)
        .in("status", ["Pending", "Rejected"])
        .limit(8),

      sb.from("marketplace_student_profiles")
        .select("skills, xp_points, rank_title")
        .eq("user_id", userId).maybeSingle(),

      sb.from("certificates")
        .select("courses(title)")
        .eq("student_id", userId)
        .eq("status", "issued" as any),

      sb.from("announcements")
        .select("title, content")
        .order("created_at", { ascending: false })
        .limit(4),

      sb.from("courses")
        .select("id, title, category, price")
        .eq("is_published", true),

      sb.from("marketplace_opportunities")
        .select("title, opportunity_type, location_type, budget_min, budget_max, currency, required_skills")
        .eq("status", "open")
        .limit(20),

      // If student is viewing a lesson, fetch its full content + assignment
      currentLessonId
        ? sb.from("lessons")
            .select("title, content_text, content_type, modules(title, courses(title))")
            .eq("id", currentLessonId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    // Fetch assignment for current lesson if there is one
    const currentAssignmentRes = currentLessonId
      ? await sb.from("assignments")
          .select("title, objective, task, description, deliverable")
          .eq("lesson_id", currentLessonId).maybeSingle()
      : { data: null };

    // ── Process enrollments ────────────────────────────────────────
    const enrolledCourseIds = new Set<string>();
    const enrollments: StudentContext["enrollments"] = (enrollmentsRes.data ?? []).map((e: any) => {
      enrolledCourseIds.add(e.courses?.id);
      return {
        courseTitle: e.courses?.title ?? "Unknown Course",
        progress:    Math.round(e.progress ?? 0),
      };
    });

    // Get course title lookup for submissions
    const courseIdToTitle: Record<string, string> = {};
    (enrollmentsRes.data ?? []).forEach((e: any) => {
      if (e.courses?.id) courseIdToTitle[e.courses.id] = e.courses.title;
    });

    // ── Process submissions — need to join to get courseTitle ────────
    // submissions → assignments (lesson_id) → lessons → modules → courses
    // We already have lesson_id from the join; do a batch lookup if needed.
    const submissionRows = (submissionsRes.data ?? []) as any[];
    // Quick lookup: fetch course names for lessons referenced by submissions
    const lessonIdsInSubs = [...new Set(submissionRows.map((s) => s.assignments?.lesson_id).filter(Boolean))];
    const lessonCourseLookup: Record<string, string> = {};
    if (lessonIdsInSubs.length) {
      const { data: lessonMods } = await sb
        .from("lessons")
        .select("id, modules(courses(id, title))")
        .in("id", lessonIdsInSubs);
      (lessonMods ?? []).forEach((l: any) => {
        lessonCourseLookup[l.id] = l.modules?.courses?.title ?? "Unknown Course";
      });
    }

    const pendingSubmissions: StudentContext["pendingSubmissions"] = [];
    const rejectedSubmissions: StudentContext["rejectedSubmissions"] = [];
    submissionRows.forEach((s) => {
      const assignmentTitle = s.assignments?.title ?? "Assignment";
      const lessonId = s.assignments?.lesson_id;
      const courseTitle = lessonId ? (lessonCourseLookup[lessonId] ?? "your course") : "your course";
      if (s.status === "Pending") {
        pendingSubmissions.push({ assignmentTitle, courseTitle });
      } else if (s.status === "Rejected") {
        rejectedSubmissions.push({ assignmentTitle, courseTitle, feedback: s.feedback ?? null });
      }
    });

    // ── Skills for opportunity matching ───────────────────────────
    const skills: string[] = marketplaceRes.data?.skills ?? [];
    const skillsLower = skills.map((s: string) => s.toLowerCase());

    const matchedOpportunities: StudentContext["matchedOpportunities"] = (opportunitiesRes.data ?? [])
      .filter((o: any) => {
        const reqSkills: string[] = o.required_skills ?? [];
        if (!reqSkills.length) return true; // no filter = open to all
        return reqSkills.some((rs: string) =>
          skillsLower.includes(rs.toLowerCase()) ||
          skillsLower.some((sk) => sk.includes(rs.toLowerCase()) || rs.toLowerCase().includes(sk))
        );
      })
      .slice(0, 6)
      .map((o: any) => ({
        title:        o.title,
        type:         o.opportunity_type ?? "opportunity",
        locationtype: o.location_type ?? "remote",
        budget:       o.budget_min && o.budget_max
          ? `${o.currency ?? "KES"} ${Number(o.budget_min).toLocaleString()} – ${Number(o.budget_max).toLocaleString()}`
          : o.budget_min ? `from ${o.currency ?? "KES"} ${Number(o.budget_min).toLocaleString()}`
          : null,
        skills: o.required_skills ?? [],
      }));

    // ── Unenrolled courses (for recommendations) ───────────────────
    const unenrolledCourses: StudentContext["unenrolledCourses"] = (allPublishedCoursesRes.data ?? [])
      .filter((c: any) => !enrolledCourseIds.has(c.id))
      .slice(0, 5)
      .map((c: any) => ({ title: c.title, category: c.category, price: c.price ?? 0 }));

    // ── Certificates ───────────────────────────────────────────────
    const certificates: string[] = (certsRes.data ?? [])
      .map((c: any) => c.courses?.title)
      .filter(Boolean);

    // ── Current lesson context ─────────────────────────────────────
    let currentLesson: StudentContext["currentLesson"] = null;
    if (currentLessonRes.data) {
      const l = currentLessonRes.data as any;
      currentLesson = {
        title:       l.title,
        contentText: l.content_text ?? null,
        contentType: l.content_type ?? "text",
        courseName:  l.modules?.courses?.title ?? "your course",
        moduleName:  l.modules?.title ?? "this module",
      };
    }

    const currentAssignment: StudentContext["currentAssignment"] =
      (currentAssignmentRes.data as any) ?? null;

    // ── Build context object ───────────────────────────────────────
    const profile = profileRes.data as any;
    const ctx: StudentContext = {
      name:               profile?.full_name?.split(" ")[0] ?? "there",
      isPremium:          !!(profile?.is_premium),
      subscriptionStatus: profile?.subscription_status ?? "free",
      trialDaysLeft:      trialDaysLeft(profile?.trial_start_date ?? null),
      totalCompletions:   completionsRes.count ?? 0,
      rank:               marketplaceRes.data?.rank_title ?? "Beginner",
      xp:                 marketplaceRes.data?.xp_points  ?? 0,
      skills,
      certificates,
      enrollments,
      pendingSubmissions,
      rejectedSubmissions,
      matchedOpportunities,
      unenrolledCourses,
      announcements:      (announcementsRes.data ?? []) as { title: string; content: string }[],
      currentLesson,
      currentAssignment,
    };

    const systemPrompt = buildSystemPrompt(ctx);

    // ── Call the AI ───────────────────────────────────────────────
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model:       "google/gemini-3-flash-preview",
        max_tokens:  1200,
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          ...safeMessages,
        ],
        stream: true,
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) return json({ error: "I'm a bit busy right now — please try again in a moment." }, 429);
      if (aiRes.status === 402) return json({ error: "AI service temporarily unavailable. Please try again shortly." }, 502);
      const errText = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, errText);
      return json({ error: "AI service error" }, 500);
    }

    return new Response(aiRes.body, {
      headers: { ...cors, "Content-Type": "text/event-stream" },
    });

  } catch (err) {
    console.error("[student-chatbot] Error:", err);
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
