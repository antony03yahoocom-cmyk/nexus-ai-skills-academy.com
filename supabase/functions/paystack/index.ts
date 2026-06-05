import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PREMIUM_PRICE_KES = 500000; // 5000 KES in kobo/cents

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) {
      return new Response(JSON.stringify({ error: "Paystack not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const userId = user.id;
    const email = user.email;
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "initialize") {
      const { callback_url, course_id, plan_type } = await req.json();

      const isPremium = plan_type === "premium";
      let finalAmount: number;

      if (isPremium) {
        finalAmount = PREMIUM_PRICE_KES;
      } else if (course_id) {
        // Look up course price server-side
        const { data: course, error: courseError } = await adminClient
          .from("courses")
          .select("price")
          .eq("id", course_id)
          .single();
        if (courseError || !course) {
          return new Response(JSON.stringify({ error: "Course not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        finalAmount = course.price * 100; // KES to smallest unit
        if (finalAmount <= 0) {
          return new Response(JSON.stringify({ error: "Course has no price set" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        return new Response(JSON.stringify({ error: "course_id or premium plan required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: finalAmount,
          currency: "KES",
          callback_url: callback_url || `${req.headers.get("origin")}/subscribe?verify=true`,
          channels: ["mobile_money"],
          metadata: {
            user_id: userId,
            course_id: course_id || null,
            plan_type: isPremium ? "premium" : "course",
            expected_amount: finalAmount,
            custom_fields: [
              {
                display_name: "Plan Type",
                variable_name: "plan_type",
                value: isPremium ? "Premium (All Courses)" : "Single Course",
              },
            ],
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error("Paystack init error:", JSON.stringify(data));
        return new Response(JSON.stringify({ error: "Payment initialization failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      const { reference } = await req.json();

      const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
      });

      const data = await response.json();
      if (!response.ok) {
        console.error("Paystack verify error:", JSON.stringify(data));
        return new Response(JSON.stringify({ error: "Payment verification failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (data.data?.status === "success") {
        const metadata = data.data?.metadata || {};
        const planType = metadata.plan_type;
        const courseId = metadata.course_id;
        const expectedAmount = metadata.expected_amount;
        const paidAmount = data.data.amount;
        const metaUserId = metadata.user_id;

        // SECURITY: Ensure the payment reference belongs to the authenticated user
        if (metaUserId && metaUserId !== userId) {
          return new Response(JSON.stringify({ error: "Payment reference does not belong to this account" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Verify the paid amount matches expected
        if (expectedAmount && paidAmount < expectedAmount) {
          console.error(`Amount mismatch: paid ${paidAmount}, expected ${expectedAmount}`);
          return new Response(JSON.stringify({ error: "Payment amount mismatch" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (planType === "premium") {
          await adminClient
            .from("profiles")
            .update({ is_premium: true, subscription_status: "paid" })
            .eq("user_id", userId);
        } else if (courseId) {
          await adminClient
            .from("course_purchases")
            .upsert({
              user_id: userId,
              course_id: courseId,
              amount: paidAmount,
              reference: reference,
              status: "paid",
              purchased_at: new Date().toISOString(),
            }, { onConflict: "user_id,course_id" });

          // Auto-enroll user if not already enrolled
          const { data: existingEnrollment } = await adminClient
            .from("enrollments")
            .select("id")
            .eq("user_id", userId)
            .eq("course_id", courseId)
            .maybeSingle();
          
          if (!existingEnrollment) {
            await adminClient
              .from("enrollments")
              .insert({ user_id: userId, course_id: courseId });
          }

          await adminClient
            .from("profiles")
            .update({ subscription_status: "paid" })
            .eq("user_id", userId);
        }

        return new Response(JSON.stringify({ success: true, plan_type: planType, course_id: courseId }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: false, status: data.data?.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Paystack error:", error);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
