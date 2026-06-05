import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Fetch submission with assignment details
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

    const assignment = (submission as any).assignments;
    const course = assignment?.lessons?.modules?.courses;
    const approvalMode = course?.approval_mode || "manual";

    // If manual mode, just return — admin will handle
    if (approvalMode === "manual") {
      return new Response(JSON.stringify({ status: "Pending", mode: "manual", feedback: "Your submission is under review by an instructor." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // AUTO BASIC: approve instantly
    if (approvalMode === "auto_basic") {
      await adminClient.from("submissions").update({
        status: "Approved",
        feedback: "Auto-approved. Great work!",
      }).eq("id", submission_id);

      // Mark lesson complete
      const lessonId = assignment.lesson_id;
      await adminClient.from("lesson_completions").upsert({
        user_id: user.id,
        lesson_id: lessonId,
      }, { onConflict: "user_id,lesson_id" });

      return new Response(JSON.stringify({ status: "Approved", mode: "auto_basic", feedback: "Great work! Your assignment has been approved." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // AUTO SMART: rule-based validation + AI evaluation
    if (approvalMode === "auto_smart") {
      const textSubmission = submission.text_submission || "";
      const hasFiles = submission.submission_files && (submission.submission_files as string[]).length > 0;
      const wordCount = textSubmission.trim().split(/\s+/).filter(Boolean).length;

      // Rule-based validation
      let validationPassed = true;
      let validationMessage = "";

      if (textSubmission && wordCount < 50) {
        validationPassed = false;
        validationMessage = `Your submission is too short (${wordCount} words). Please write at least 50 words.`;
      }

      if (assignment.deliverable && assignment.deliverable.toLowerCase().includes("file") && !hasFiles) {
        validationPassed = false;
        validationMessage = "This assignment requires a file upload. Please attach your work.";
      }

      if (!textSubmission && !hasFiles) {
        validationPassed = false;
        validationMessage = "Please provide a text submission or upload files.";
      }

      if (!validationPassed) {
        await adminClient.from("submissions").update({
          status: "Rejected",
          feedback: validationMessage,
        }).eq("id", submission_id);

        return new Response(JSON.stringify({ status: "Rejected", mode: "auto_smart", feedback: validationMessage, validation_passed: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // AI evaluation
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        // Fallback to auto-approve if no AI key
        await adminClient.from("submissions").update({
          status: "Approved",
          feedback: "Validation passed. Auto-approved.",
        }).eq("id", submission_id);

        const lessonId = assignment.lesson_id;
        await adminClient.from("lesson_completions").upsert({
          user_id: user.id,
          lesson_id: lessonId,
        }, { onConflict: "user_id,lesson_id" });

        return new Response(JSON.stringify({ status: "Approved", mode: "auto_smart", feedback: "Validation passed. Auto-approved.", validation_passed: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content: `You are an assignment evaluator for an online academy. Evaluate the student's submission against the assignment requirements. Return a JSON object with: {"approved": true/false, "feedback": "detailed feedback message"}. Be encouraging but honest. Approve if the student has made a genuine effort and addressed the core requirements.`,
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
                    approved: { type: "boolean", description: "Whether the assignment is approved" },
                    feedback: { type: "string", description: "Detailed feedback for the student" },
                  },
                  required: ["approved", "feedback"],
                  additionalProperties: false,
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "evaluate_assignment" } },
          }),
        });

        if (!aiResponse.ok) {
          // Fallback: approve on AI failure
          await adminClient.from("submissions").update({
            status: "Approved",
            feedback: "Validation passed. Auto-approved (AI evaluation unavailable).",
          }).eq("id", submission_id);

          const lessonId = assignment.lesson_id;
          await adminClient.from("lesson_completions").upsert({
            user_id: user.id,
            lesson_id: lessonId,
          }, { onConflict: "user_id,lesson_id" });

          return new Response(JSON.stringify({ status: "Approved", mode: "auto_smart", feedback: "Auto-approved.", validation_passed: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        let evaluation = { approved: true, feedback: "Auto-approved." };

        if (toolCall?.function?.arguments) {
          try {
            evaluation = JSON.parse(toolCall.function.arguments);
          } catch { /* use default */ }
        }

        const finalStatus = evaluation.approved ? "Approved" : "Rejected";
        await adminClient.from("submissions").update({
          status: finalStatus,
          feedback: evaluation.feedback,
        }).eq("id", submission_id);

        if (evaluation.approved) {
          const lessonId = assignment.lesson_id;
          await adminClient.from("lesson_completions").upsert({
            user_id: user.id,
            lesson_id: lessonId,
          }, { onConflict: "user_id,lesson_id" });
        }

        return new Response(JSON.stringify({ status: finalStatus, mode: "auto_smart", feedback: evaluation.feedback, validation_passed: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (aiErr) {
        console.error("AI evaluation error:", aiErr);
        // Fallback
        await adminClient.from("submissions").update({
          status: "Approved",
          feedback: "Validation passed. Auto-approved.",
        }).eq("id", submission_id);

        const lessonId = assignment.lesson_id;
        await adminClient.from("lesson_completions").upsert({
          user_id: user.id,
          lesson_id: lessonId,
        }, { onConflict: "user_id,lesson_id" });

        return new Response(JSON.stringify({ status: "Approved", mode: "auto_smart", feedback: "Auto-approved.", validation_passed: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ status: "Pending", mode: approvalMode, feedback: "Submission received." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Evaluate assignment error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
