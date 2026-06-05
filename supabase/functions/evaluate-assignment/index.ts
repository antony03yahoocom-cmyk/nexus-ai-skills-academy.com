import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Get the first admin's user_id ─────────────────────────────────
async function getAdminId(adminClient: ReturnType<typeof createClient>): Promise<string | null> {
  try {
    const { data } = await adminClient
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .single();
    return data?.user_id ?? null;
  } catch {
    return null;
  }
}

// ── Send an immediate acknowledgment when any submission is received ──
async function sendSubmissionAcknowledgment(
  adminClient: ReturnType<typeof createClient>,
  studentId: string,
  assignmentTitle: string,
  courseName: string
) {
  try {
    const adminId = await getAdminId(adminClient);
    if (!adminId) return;

    const content =
      `🎉 Assignment Received — "${assignmentTitle}"\n\n` +
      `Hi! Your assignment has been successfully submitted for the course "${courseName}".\n\n` +
      `📬 What happens next?\n` +
      `• Your submission is now being processed\n` +
      `• Check back here in Messages regularly — you'll receive feedback and approval status here\n` +
      `• Don't wait around! Keep moving forward on your course while you wait\n\n` +
      `💡 Pro tip: The more lessons you complete, the closer you are to earning your certificate! 🏆\n\n` +
      `Questions or concerns? Reply to this message anytime — we're here to help.`;

    await adminClient.from("private_messages").insert({
      sender_id: adminId,
      receiver_id: studentId,
      content,
      is_read: false,
    });
  } catch (_err) {
    // Non-fatal
  }
}

// ── Send feedback/result message after evaluation ─────────────────
async function sendFeedbackMessage(
  adminClient: ReturnType<typeof createClient>,
  studentId: string,
  assignmentTitle: string,
  status: string,
  feedback: string,
  adminId: string | null
) {
  try {
    const sender = adminId ?? await getAdminId(adminClient);
    if (!sender) return;

    const statusLabel = status === "Approved" ? "✅ Approved" : status === "Rejected" ? "❌ Needs Revision" : "⏳ Under Review";
    const content =
      `📝 Assignment Update — "${assignmentTitle}"\n\n` +
      `Status: ${statusLabel}\n\n` +
      `Feedback:\n${feedback}`;

    await adminClient.from("private_messages").insert({
      sender_id: sender,
      receiver_id: studentId,
      content,
      is_read: false,
    });
  } catch (_err) {
    // Non-fatal
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { submission_id } = await req.json();
    if (!submission_id) {
      return new Response(JSON.stringify({ error: "submission_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: submission, error: subErr } = await adminClient
      .from("submissions")
      .select("*, assignments(*, lessons(*, modules(*, courses(*))))")
      .eq("id", submission_id)
      .single();

    if (subErr || !submission) {
      return new Response(JSON.stringify({ error: "Submission not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((submission as any).user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const assignment = (submission as any).assignments;
    const course = assignment?.lessons?.modules?.courses;
    const approvalMode = course?.approval_mode || "manual";
    const courseName = course?.title || "your course";

    // ✅ Send submission acknowledgment immediately, regardless of approval mode
    await sendSubmissionAcknowledgment(adminClient, user.id, assignment.title, courseName);

    // Cache admin ID so we don't query it twice
    const adminId = await getAdminId(adminClient);

    // ── MANUAL MODE ───────────────────────────────────────────────
    if (approvalMode === "manual") {
      return new Response(
        JSON.stringify({
          status: "Pending",
          mode: "manual",
          feedback: "Your submission has been received and is under review by an instructor. Check your Messages for updates.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── AUTO BASIC MODE ───────────────────────────────────────────
    if (approvalMode === "auto_basic") {
      const feedbackMsg =
        "All submissions are now auto-approved, so you can continue your lessons without delay. 🚀\n" +
        "⚠️ Note: Your work will be reviewed later by the admin, and only quality submissions will be officially approved.\n" +
        "👉 Always submit your best and correct work.";

      await adminClient.from("submissions").update({
        status: "Approved",
        feedback: feedbackMsg,
      }).eq("id", submission_id);

      await adminClient.from("lesson_completions").upsert({
        user_id: user.id,
        lesson_id: assignment.lesson_id,
      }, { onConflict: "user_id,lesson_id" });

      await sendFeedbackMessage(adminClient, user.id, assignment.title, "Approved", feedbackMsg, adminId);

      return new Response(
        JSON.stringify({ status: "Approved", mode: "auto_basic", feedback: feedbackMsg }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── AUTO SMART MODE ───────────────────────────────────────────
    if (approvalMode === "auto_smart") {
      const textSubmission = submission.text_submission || "";
      const hasFiles = submission.submission_files && (submission.submission_files as string[]).length > 0;
      const wordCount = textSubmission.trim().split(/\s+/).filter(Boolean).length;

      let validationPassed = true;
      let validationMessage = "";

      if (textSubmission && wordCount < 50) {
        validationPassed = false;
        validationMessage = `Your submission is too short (${wordCount} words). Please write at least 50 words and resubmit.`;
      }

      if (assignment.deliverable && assignment.deliverable.toLowerCase().includes("file") && !hasFiles) {
        validationPassed = false;
        validationMessage = "This assignment requires a file upload. Please attach your work and resubmit.";
      }

      if (!textSubmission && !hasFiles) {
        validationPassed = false;
        validationMessage = "Please provide a text submission or upload files and resubmit.";
      }

      if (!validationPassed) {
        await adminClient.from("submissions").update({
          status: "Rejected",
          feedback: validationMessage,
        }).eq("id", submission_id);

        await sendFeedbackMessage(adminClient, user.id, assignment.title, "Rejected", validationMessage, adminId);

        return new Response(
          JSON.stringify({ status: "Rejected", mode: "auto_smart", feedback: validationMessage, validation_passed: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Try AI evaluation
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        // No AI key — auto approve
        const feedbackMsg = "Great work! Your submission passed validation and has been approved. Keep it up! 🎉";
        await adminClient.from("submissions").update({ status: "Approved", feedback: feedbackMsg }).eq("id", submission_id);
        await adminClient.from("lesson_completions").upsert({ user_id: user.id, lesson_id: assignment.lesson_id }, { onConflict: "user_id,lesson_id" });
        await sendFeedbackMessage(adminClient, user.id, assignment.title, "Approved", feedbackMsg, adminId);
        return new Response(
          JSON.stringify({ status: "Approved", mode: "auto_smart", feedback: feedbackMsg, validation_passed: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content: `You are an assignment evaluator for an online academy in Africa. Evaluate the student's submission against the assignment requirements. Return a JSON object with: {"approved": true/false, "feedback": "detailed, encouraging feedback message"}. Be encouraging but honest. Approve if the student has made a genuine effort and addressed the core requirements.`,
              },
              {
                role: "user",
                content: `Assignment Title: ${assignment.title}\nObjective: ${assignment.objective || "N/A"}\nTask: ${assignment.task || "N/A"}\nDeliverable: ${assignment.deliverable || "N/A"}\nDescription: ${assignment.description || "N/A"}\n\nStudent Submission:\n${textSubmission || "(Files submitted)"}\n\nFiles attached: ${hasFiles ? "Yes" : "No"}`,
              },
            ],
            tools: [{
              type: "function",
              function: {
                name: "evaluate_assignment",
                description: "Evaluate the student assignment submission",
                parameters: {
                  type: "object",
                  properties: {
                    approved: { type: "boolean" },
                    feedback: { type: "string" },
                  },
                  required: ["approved", "feedback"],
                  additionalProperties: false,
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "evaluate_assignment" } },
          }),
        });

        let evaluation = { approved: true, feedback: "Great submission! Your work has been approved. Keep learning! 🎉" };

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            try { evaluation = JSON.parse(toolCall.function.arguments); } catch { /* use default */ }
          }
        }

        const finalStatus = evaluation.approved ? "Approved" : "Rejected";
        await adminClient.from("submissions").update({ status: finalStatus, feedback: evaluation.feedback }).eq("id", submission_id);

        if (evaluation.approved) {
          await adminClient.from("lesson_completions").upsert({ user_id: user.id, lesson_id: assignment.lesson_id }, { onConflict: "user_id,lesson_id" });
        }

        await sendFeedbackMessage(adminClient, user.id, assignment.title, finalStatus, evaluation.feedback, adminId);

        return new Response(
          JSON.stringify({ status: finalStatus, mode: "auto_smart", feedback: evaluation.feedback, validation_passed: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (aiErr) {
        console.error("AI evaluation error:", aiErr);
        // Fallback: approve
        const feedbackMsg = "Your submission has been received and approved. Well done for completing this assignment! 🌟";
        await adminClient.from("submissions").update({ status: "Approved", feedback: feedbackMsg }).eq("id", submission_id);
        await adminClient.from("lesson_completions").upsert({ user_id: user.id, lesson_id: assignment.lesson_id }, { onConflict: "user_id,lesson_id" });
        await sendFeedbackMessage(adminClient, user.id, assignment.title, "Approved", feedbackMsg, adminId);
        return new Response(
          JSON.stringify({ status: "Approved", mode: "auto_smart", feedback: feedbackMsg, validation_passed: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fallback for unknown modes
    return new Response(
      JSON.stringify({ status: "Pending", mode: approvalMode, feedback: "Submission received. Check your Messages for updates." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Evaluate assignment error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});