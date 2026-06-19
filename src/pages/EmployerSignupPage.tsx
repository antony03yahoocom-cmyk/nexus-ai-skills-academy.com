import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Building2, Globe, Mail, Phone, Briefcase, ArrowRight, ArrowLeft, CheckCircle,
} from "lucide-react";

const INDUSTRIES = [
  "Technology & Software", "Telecommunications", "Finance & Banking",
  "E-Commerce & Retail", "Media & Marketing", "Education & EdTech",
  "Healthcare", "Agriculture & AgriTech", "Logistics & Transport",
  "Energy & Utilities", "NGO / Non-Profit", "Government", "Other",
];

const EmployerSignupPage = () => {
  const { user } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    company_name:  "",
    industry:      "",
    website:       "",
    about:         "",
    contact_email: "",
    contact_phone: "",
  });

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="glass-card p-10 max-w-md w-full text-center">
          <Building2 className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Sign in to continue</h2>
          <p className="text-muted-foreground mb-6 text-sm">You need an account to create an employer profile.</p>
          <Button variant="hero" asChild><Link to="/login">Sign In <ArrowRight className="w-4 h-4 ml-1" /></Link></Button>
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!form.company_name.trim()) { toast.error("Company name is required"); return; }
    setLoading(true);
    try {
      const { error: upsertErr } = await supabase
        .from("marketplace_employer_profiles" as any)
        .upsert({
          user_id:       user.id,
          company_name:  form.company_name.trim(),
          industry:      form.industry,
          website:       form.website.trim(),
          about:         form.about.trim(),
          contact_email: form.contact_email.trim(),
          contact_phone: form.contact_phone.trim(),
        }, { onConflict: "user_id" });
      if (upsertErr) throw upsertErr;

      // ensure employer role
      await supabase
        .from("user_roles")
        .upsert({ user_id: user.id, role: "employer" as any }, { onConflict: "user_id_role" } as any)
        .then(({ error }) => {
          if (error) supabase.from("user_roles").insert({ user_id: user.id, role: "employer" as any });
        });

      toast.success("Employer profile created!");
      nav("/employer/dashboard");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
            <Building2 className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-1">Create Employer Profile</h1>
          <p className="text-sm text-muted-foreground">Connect with Africa's best AI & tech talent from NEXUS AI Academy</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2].map(s => (
            <div key={s} className={`flex-1 h-1 rounded-full transition-all ${s <= step ? "bg-primary" : "bg-muted/40"}`} />
          ))}
        </div>

        <div className="glass-card p-6">
          {/* ─ Step 1: Company basics ─ */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-semibold mb-4">Company Details</h2>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Company Name *</label>
                <Input value={form.company_name} onChange={set("company_name")} placeholder="e.g. Safaricom PLC" />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Industry</label>
                <select value={form.industry} onChange={set("industry")}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground">
                  <option value="">Select industry…</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Website</label>
                <div className="relative">
                  <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" value={form.website} onChange={set("website")} placeholder="https://example.com" />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">About Company</label>
                <Textarea rows={4} value={form.about} onChange={set("about")}
                  placeholder="Describe what your company does, your culture, and what you look for in candidates…" />
              </div>

              <Button variant="hero" className="w-full" onClick={() => setStep(2)}
                disabled={!form.company_name.trim()}>
                Continue <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}

          {/* ─ Step 2: Contact info ─ */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-semibold mb-4">Contact Information</h2>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Contact Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" type="email" value={form.contact_email} onChange={set("contact_email")} placeholder="hr@company.com" />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Contact Phone</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" value={form.contact_phone} onChange={set("contact_phone")} placeholder="+254 700 000 000" />
                </div>
              </div>

              {/* What you get */}
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-2">
                <p className="text-sm font-semibold text-primary">What you get as an employer:</p>
                {[
                  "Post unlimited job, internship & freelance opportunities",
                  "Search and filter students by skill, availability, and rank",
                  "View student portfolios and certificates",
                  "Shortlist candidates and contact them directly",
                  "Track applications through a full pipeline",
                  "NEXUS-verified employer badge after review",
                ].map(item => (
                  <div key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                    {item}
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <Button variant="hero" onClick={handleSubmit} disabled={loading} className="flex-1">
                  {loading ? "Creating…" : "Create Profile"}
                </Button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Already have a profile?{" "}
          <Link to="/employer/dashboard" className="text-primary hover:underline">Go to dashboard</Link>
        </p>
      </div>
    </div>
  );
};

export default EmployerSignupPage;
