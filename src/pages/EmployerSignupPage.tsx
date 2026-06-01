import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const EmployerSignupPage = () => {
  const { user } = useAuth();
  const nav = useNavigate();
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [about, setAbout] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [loading, setLoading] = useState(false);

  if (!user) return (
    <div className="p-8 text-center">
      <p className="mb-4">Please sign in to continue as an employer.</p>
      <Button asChild><Link to="/login">Sign In</Link></Button>
    </div>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // upsert employer profile
      const { error: upsertErr } = await supabase.from("marketplace_employer_profiles").upsert({
        user_id: user.id,
        company_name: companyName,
        industry,
        website,
        about,
        contact_email: contactEmail,
        contact_phone: contactPhone,
      }, { onConflict: "user_id" });
      if (upsertErr) throw upsertErr;

      // ensure user_roles contains employer
      const { error: roleErr } = await supabase.from("user_roles").upsert({ user_id: user.id, role: "employer" as any }, { onConflict: "user_id_role" } as any);
      if (roleErr) {
        // try insert fallback
        await supabase.from("user_roles").insert({ user_id: user.id, role: "employer" as any });
      }

      toast.success("Employer profile created");
      nav("/employer/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Failed to create employer profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 bg-background flex items-start justify-center">
      <div className="max-w-2xl w-full space-y-4">
        <h1 className="text-2xl font-bold">Employer Sign Up</h1>
        <p className="text-sm text-muted-foreground">Create an employer profile to browse student projects and contact candidates.</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input placeholder="Company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
          <Input placeholder="Industry" value={industry} onChange={(e) => setIndustry(e.target.value)} />
          <Input placeholder="Website" value={website} onChange={(e) => setWebsite(e.target.value)} />
          <Textarea placeholder="About your company" value={about} onChange={(e) => setAbout(e.target.value)} />
          <Input placeholder="Contact email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          <Input placeholder="Contact phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          <div className="flex gap-2">
            <Button type="submit" variant="hero" disabled={loading}>{loading ? "Saving..." : "Create Profile"}</Button>
            <Button variant="outline" asChild><Link to="/">Cancel</Link></Button>
          </div>
        </form>
      </div>
    </main>
  );
};

export default EmployerSignupPage;
