import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Link, useSearchParams } from "react-router-dom";
import { Check, CreditCard, Shield, Crown } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { toast } from "sonner";
import { useEffect, useState } from "react";

const SubscribePage = () => {
  const { profile, user, session, refreshProfile, trialActive, trialDaysLeft } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const verify = searchParams.get("verify");
    const reference = searchParams.get("reference");

    if (verify === "true" && reference && session) {
      const key = `paystack-verified-${reference}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      verifyPayment(reference);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, session]);

  const verifyPayment = async (reference: string) => {
    setLoading(true);
    const loadingToast = toast.loading("Verifying your payment…");
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paystack?action=verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ reference }),
        }
      );
      const result = await resp.json();
      toast.dismiss(loadingToast);
      if (result.success) {
        toast.success(result.message || "Payment successful! You now have full access.");
        await refreshProfile();
      } else {
        toast.error(result.message || result.error || "Payment verification failed. Please contact support.");
      }
      // Clean URL regardless of outcome
      window.history.replaceState({}, "", "/subscribe");
    } catch {
      toast.dismiss(loadingToast);
      toast.error("Failed to verify payment. Please refresh or contact support.");
    } finally {
      setLoading(false);
    }
  };

  const handlePremium = async () => {
    if (!user || !session) {
      toast.error("Please log in first");
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paystack?action=initialize`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            amount: 500000, // KES 5,000 in kobo/cents
            plan_type: "premium",
            /*
             * FIX: was `?verify=true&reference=` — the trailing `&reference=` caused
             * Paystack to append its own `?reference=XXXX` making the URL have TWO
             * `reference` params. URLSearchParams.get("reference") returned "" (the
             * first, empty one), so verification always silently failed.
             *
             * Correct pattern: just `?verify=true`. Paystack automatically appends
             * `?trxref=…&reference=…` to whatever callback_url you provide.
             */
            callback_url: `${window.location.origin}/subscribe?verify=true`,
          }),
        }
      );
      const data = await resp.json();
      if (data.data?.authorization_url) {
        window.location.href = data.data.authorization_url;
      } else {
        toast.error(data.error || "Failed to initialize payment");
      }
    } catch {
      toast.error("Payment initialization failed");
    } finally {
      setLoading(false);
    }
  };

  // ── Already premium ──────────────────────────────────────────────
  if (profile?.is_premium) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-16 flex items-center justify-center px-4">
          <div className="glass-card p-12 text-center max-w-md w-full">
            <Crown className="w-16 h-16 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">You're a Premium Member!</h1>
            <p className="text-muted-foreground mb-6">
              You have full access to all courses, assignments, and mentorship.
            </p>
            <Button variant="hero" asChild>
              <Link to="/dashboard">Go to Dashboard</Link>
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // ── Subscribe page ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Get <span className="gradient-text">Premium Access</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              {trialActive
                ? `Your trial has ${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} left (1 course, first 5 lessons).`
                : "Unlock all courses with a single payment."}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Or purchase individual courses from the course page.
            </p>
          </div>

          <div className="max-w-lg mx-auto">
            <div className="glass-card p-8 text-center glow-primary relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                  ALL ACCESS
                </span>
              </div>

              <Crown className="w-10 h-10 mx-auto mb-3 text-primary" />
              <h2 className="text-2xl font-bold mb-1">Premium Plan</h2>
              <div className="text-4xl sm:text-5xl font-bold gradient-text mb-1">KES 5,000</div>
              <p className="text-sm text-muted-foreground mb-6">one-time payment · lifetime access</p>

              <ul className="text-left space-y-3 mb-8 max-w-xs mx-auto">
                {[
                  "All courses (current + future)",
                  "All lessons unlocked",
                  "Video, PDF, image & text content",
                  "Assignments & certificates",
                  "Mentorship access",
                  "Priority support",
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-success shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                variant="hero"
                size="lg"
                className="w-full"
                onClick={handlePremium}
                disabled={loading || !user}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                {loading ? "Processing…" : user ? "Pay KES 5,000 via M-Pesa" : "Log in to Subscribe"}
              </Button>
            </div>

            <div className="text-center mt-6">
              <p className="text-sm text-muted-foreground mb-2">Want just one course?</p>
              <Button variant="outline" asChild>
                <Link to="/courses">Browse & Buy Individual Courses</Link>
              </Button>
            </div>

            <div className="flex items-center justify-center gap-2 mt-8 text-xs text-muted-foreground">
              <Shield className="w-3 h-3" />
              Secured by Paystack · M-Pesa Mobile Money
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default SubscribePage;
