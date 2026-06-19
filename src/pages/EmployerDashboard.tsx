import { useMemo, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardTopNav from "@/components/dashboard/DashboardTopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Building2, Plus, Briefcase, Users, Search,
  CheckCircle, Clock, XCircle, Star, Eye, TrendingUp, UserCheck,
  Globe, Mail, Phone, Upload, Image as ImageIcon, BadgeCheck,
  AlertCircle, ExternalLink, MessageCircle, Bookmark, BookmarkCheck,
  ChevronDown, ChevronUp, Filter, ArrowRight, Banknote, MapPin,
  CalendarDays, Trash2, Edit3, X, Target, PieChart,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────
type Tab = "overview" | "profile" | "post" | "opportunities" | "applications" | "talent";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview",      label: "Overview",        icon: LayoutDashboard },
  { id: "profile",       label: "Company Profile", icon: Building2 },
  { id: "post",          label: "Post Opportunity",icon: Plus },
  { id: "opportunities", label: "My Postings",     icon: Briefcase },
  { id: "applications",  label: "Applications",    icon: Users },
  { id: "talent",        label: "Talent Search",   icon: Search },
];

const OPP_TYPES   = ["job", "internship", "freelance", "remote_task", "collaboration", "ai_task"];
const LOCATION    = ["remote", "hybrid", "on_site"];
const LEVELS      = ["beginner", "intermediate", "advanced"];
const CATEGORIES  = ["AI & Machine Learning", "Web Development", "Data Science", "Design", "Marketing", "Writing", "Video & Animation", "Finance", "Customer Service", "Other"];

const STATUS_COLORS: Record<string, string> = {
  pending:     "bg-accent/10 text-accent border-accent/20",
  viewed:      "bg-primary/10 text-primary border-primary/20",
  shortlisted: "bg-success/10 text-success border-success/20",
  accepted:    "bg-success/20 text-success border-success/30 font-semibold",
  rejected:    "bg-destructive/10 text-destructive border-destructive/20",
};

const AVAIL_COLORS: Record<string, string> = {
  available_for_work:          "bg-success/10 text-success",
  available_for_internship:    "bg-primary/10 text-primary",
  available_for_collaboration: "bg-accent/10 text-accent",
  not_available:               "bg-muted/10 text-muted-foreground",
};

const AVAIL_LABELS: Record<string, string> = {
  available_for_work:          "Available for Work",
  available_for_internship:    "Available for Internship",
  available_for_collaboration: "Open to Collaboration",
  not_available:               "Not Available",
};

const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString();
const fmtKES = (n: number | null | undefined) => `KES ${(n ?? 0).toLocaleString()}`;

// ═══════════════════════════════════════════════════════════════════
const EmployerDashboard = () => {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [skillSearch, setSkillSearch] = useState("");
  const [filterOppId, setFilterOppId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const logoRef  = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo]    = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // ── Employer profile ────────────────────────────────────────────
  const { data: empProfile, isLoading: empLoading } = useQuery({
    queryKey: ["employer-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_employer_profiles" as any)
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as any | null;
    },
    enabled: !!user,
  });

  const [profileForm, setProfileForm] = useState({
    company_name: "", industry: "", website: "", about: "",
    contact_email: "", contact_phone: "",
  });

  // Sync form when profile loads
  useState(() => {
    if (empProfile) {
      setProfileForm({
        company_name:  empProfile.company_name  ?? "",
        industry:      empProfile.industry      ?? "",
        website:       empProfile.website       ?? "",
        about:         empProfile.about         ?? "",
        contact_email: empProfile.contact_email ?? "",
        contact_phone: empProfile.contact_phone ?? "",
      });
    }
  });

  // ── Analytics (via SECURITY DEFINER RPC) ───────────────────────
  const { data: analytics } = useQuery({
    queryKey: ["employer-analytics", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_employer_analytics" as any, { emp_user_id: user!.id });
      if (error) return null;
      return data as any;
    },
    enabled: !!user,
  });

  // ── Opportunities ───────────────────────────────────────────────
  const { data: opportunities = [] } = useQuery({
    queryKey: ["employer-opportunities", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_opportunities")
        .select("*")
        .eq("employer_user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const oppIds = useMemo(() => opportunities.map((o: any) => o.id), [opportunities]);

  // ── Applications ────────────────────────────────────────────────
  const { data: applications = [] } = useQuery({
    queryKey: ["employer-applications", oppIds.join(",")],
    queryFn: async () => {
      if (!oppIds.length) return [];
      const { data, error } = await supabase
        .from("marketplace_applications")
        .select("*")
        .in("opportunity_id", oppIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: oppIds.length > 0,
  });

  const studentIds = useMemo(
    () => [...new Set((applications as any[]).map((a: any) => a.student_user_id))],
    [applications],
  );

  // ── Student profiles for applicants ────────────────────────────
  const { data: studentProfiles = [] } = useQuery({
    queryKey: ["employer-student-profiles", studentIds.join(",")],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketplace_student_profiles")
        .select("user_id, headline, bio, skills, availability_status, rank_title, xp_points, certificates, social_links")
        .in("user_id", studentIds);
      return data ?? [];
    },
    enabled: studentIds.length > 0,
  });

  const { data: studentNames = [] } = useQuery({
    queryKey: ["employer-student-names", studentIds.join(",")],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles_public")
        .select("user_id, full_name, avatar_url")
        .in("user_id", studentIds);
      return data ?? [];
    },
    enabled: studentIds.length > 0,
  });

  const studentMap = useMemo(() => {
    const map: Record<string, any> = {};
    (studentNames as any[]).forEach((p: any) => { map[p.user_id] = { ...map[p.user_id], ...p }; });
    (studentProfiles as any[]).forEach((p: any) => { map[p.user_id] = { ...map[p.user_id], ...p }; });
    return map;
  }, [studentNames, studentProfiles]);

  const oppMap = useMemo(
    () => Object.fromEntries((opportunities as any[]).map((o: any) => [o.id, o])),
    [opportunities],
  );

  // ── Shortlists ──────────────────────────────────────────────────
  const { data: shortlists = [] } = useQuery({
    queryKey: ["employer-shortlists", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("employer_shortlists" as any)
        .select("*")
        .eq("employer_user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });
  const shortlistedIds = useMemo(
    () => new Set((shortlists as any[]).map((s: any) => s.student_user_id)),
    [shortlists],
  );

  // ── Talent search ───────────────────────────────────────────────
  const [talentFilters, setTalentFilters] = useState({
    skill: "", availability: "all", minXp: 0,
  });

  const { data: allStudents = [] } = useQuery({
    queryKey: ["talent-search"],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketplace_student_profiles")
        .select("user_id, headline, bio, skills, availability_status, rank_title, xp_points, certificates")
        .neq("availability_status", "not_available")
        .order("xp_points", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const { data: allStudentNames = [] } = useQuery({
    queryKey: ["talent-search-names"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles_public")
        .select("user_id, full_name, avatar_url");
      return data ?? [];
    },
  });

  const talentNameMap = useMemo(
    () => Object.fromEntries((allStudentNames as any[]).map((p: any) => [p.user_id, p])),
    [allStudentNames],
  );

  const filteredTalent = useMemo(() => {
    return (allStudents as any[]).filter((s: any) => {
      const skillMatch = !talentFilters.skill ||
        (s.skills ?? []).some((sk: string) => sk.toLowerCase().includes(talentFilters.skill.toLowerCase()));
      const availMatch = talentFilters.availability === "all" || s.availability_status === talentFilters.availability;
      const xpMatch = (s.xp_points ?? 0) >= talentFilters.minXp;
      return skillMatch && availMatch && xpMatch;
    });
  }, [allStudents, talentFilters]);

  // ── Post opportunity form ───────────────────────────────────────
  const [oppForm, setOppForm] = useState({
    title: "", description: "", category: CATEGORIES[0],
    opportunity_type: "freelance", location_type: "remote",
    experience_level: "beginner", budget_min: "", budget_max: "",
    currency: "KES", required_skills: "", duration: "", deadline: "",
  });

  // ── Mutations ───────────────────────────────────────────────────
  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const payload = {
        user_id: user.id,
        company_name: profileForm.company_name.trim(),
        industry: profileForm.industry.trim(),
        website: profileForm.website.trim(),
        about: profileForm.about.trim(),
        contact_email: profileForm.contact_email.trim(),
        contact_phone: profileForm.contact_phone.trim(),
      };
      const { error } = await supabase
        .from("marketplace_employer_profiles" as any)
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Company profile saved");
      qc.invalidateQueries({ queryKey: ["employer-profile", user?.id] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save profile"),
  });

  const uploadAsset = async (file: File, type: "logo" | "banner") => {
    if (!user) return;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${type}-${Date.now()}.${ext}`;
    type === "logo" ? setUploadingLogo(true) : setUploadingBanner(true);
    try {
      const { error: upErr } = await supabase.storage
        .from("employer-assets")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("employer-assets").getPublicUrl(path);
      const field = type === "logo" ? "logo_url" : "banner_url";
      const { error: dbErr } = await supabase
        .from("marketplace_employer_profiles" as any)
        .upsert({ user_id: user.id, company_name: empProfile?.company_name ?? "My Company", [field]: urlData.publicUrl }, { onConflict: "user_id" });
      if (dbErr) throw dbErr;
      toast.success(`${type === "logo" ? "Logo" : "Banner"} uploaded`);
      qc.invalidateQueries({ queryKey: ["employer-profile", user?.id] });
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      type === "logo" ? setUploadingLogo(false) : setUploadingBanner(false);
    }
  };

  const postOpportunity = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      if (!oppForm.title.trim() || !oppForm.description.trim()) throw new Error("Title and description required");
      const { error } = await supabase.from("marketplace_opportunities").insert({
        employer_user_id: user.id,
        title: oppForm.title.trim(),
        description: oppForm.description.trim(),
        category: oppForm.category,
        opportunity_type: oppForm.opportunity_type,
        location_type: oppForm.location_type,
        experience_level: oppForm.experience_level,
        budget_min: oppForm.budget_min ? Number(oppForm.budget_min) : null,
        budget_max: oppForm.budget_max ? Number(oppForm.budget_max) : null,
        currency: oppForm.currency,
        required_skills: oppForm.required_skills.split(",").map(s => s.trim()).filter(Boolean),
        duration: oppForm.duration.trim() || null,
        deadline: oppForm.deadline || null,
        status: "open",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Opportunity posted successfully!");
      setOppForm({ title: "", description: "", category: CATEGORIES[0], opportunity_type: "freelance", location_type: "remote", experience_level: "beginner", budget_min: "", budget_max: "", currency: "KES", required_skills: "", duration: "", deadline: "" });
      qc.invalidateQueries({ queryKey: ["employer-opportunities", user?.id] });
      qc.invalidateQueries({ queryKey: ["employer-analytics", user?.id] });
      setActiveTab("opportunities");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to post opportunity"),
  });

  const updateOppStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("marketplace_opportunities").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Opportunity updated");
      qc.invalidateQueries({ queryKey: ["employer-opportunities", user?.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteOpp = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketplace_opportunities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Opportunity deleted");
      qc.invalidateQueries({ queryKey: ["employer-opportunities", user?.id] });
      qc.invalidateQueries({ queryKey: ["employer-analytics", user?.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateAppStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("marketplace_applications").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      const labels: Record<string, string> = { shortlisted: "Shortlisted ✓", accepted: "Hired 🎉", rejected: "Rejected", viewed: "Marked as viewed" };
      toast.success(labels[vars.status] ?? "Updated");
      qc.invalidateQueries({ queryKey: ["employer-applications", oppIds.join(",")] });
      qc.invalidateQueries({ queryKey: ["employer-analytics", user?.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleShortlist = useMutation({
    mutationFn: async (studentId: string) => {
      if (shortlistedIds.has(studentId)) {
        const { error } = await supabase
          .from("employer_shortlists" as any)
          .delete()
          .eq("employer_user_id", user!.id)
          .eq("student_user_id", studentId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("employer_shortlists" as any)
          .insert({ employer_user_id: user!.id, student_user_id: studentId });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employer-shortlists", user?.id] }),
    onError: (e: any) => toast.error(e.message),
  });

  // ── Derived ─────────────────────────────────────────────────────
  const filteredApps = useMemo(() => {
    return (applications as any[]).filter((a: any) => {
      const oppMatch = filterOppId === "all" || a.opportunity_id === filterOppId;
      const statusMatch = filterStatus === "all" || a.status === filterStatus;
      return oppMatch && statusMatch;
    });
  }, [applications, filterOppId, filterStatus]);

  const hireRate = useMemo(() => {
    const total = analytics?.total_applicants ?? 0;
    const hired = analytics?.hired ?? 0;
    return total > 0 ? Math.round((hired / total) * 100) : 0;
  }, [analytics]);

  // ─────────────────────────────────────────────────────────────────
  // Redirect to signup if no profile
  if (!empLoading && !empProfile && user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="glass-card p-10 max-w-md w-full text-center">
          <Building2 className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Set Up Your Company Profile</h2>
          <p className="text-muted-foreground mb-6">Create your employer profile to start posting opportunities and finding talent.</p>
          <Button variant="hero" asChild><Link to="/employer/signup">Create Employer Profile <ArrowRight className="w-4 h-4 ml-1" /></Link></Button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // Render
  const isVerified = empProfile?.verification_status === "verified";

  return (
    <div className="min-h-screen bg-background">
      <DashboardTopNav />

      {/* Banner */}
      <div className="relative h-36 md:h-48 bg-gradient-to-r from-primary/20 via-accent/10 to-primary/5 overflow-hidden">
        {empProfile?.banner_url && (
          <img src={empProfile.banner_url} alt="Banner" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        <button
          onClick={() => bannerRef.current?.click()}
          className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background/70 backdrop-blur text-xs font-medium hover:bg-background/90 transition-colors"
        >
          {uploadingBanner ? <span>Uploading…</span> : <><ImageIcon className="w-3.5 h-3.5" /> Change Banner</>}
        </button>
        <input ref={bannerRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadAsset(f, "banner"); }} />
      </div>

      {/* Profile strip */}
      <div className="container mx-auto px-4 -mt-10 relative z-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 mb-6">
          <div className="relative">
            <Avatar className="w-20 h-20 border-4 border-background shadow-xl">
              <AvatarImage src={empProfile?.logo_url} alt={empProfile?.company_name} />
              <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                {(empProfile?.company_name ?? "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => logoRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
            >
              {uploadingLogo ? <span className="text-[9px] text-white">…</span> : <Upload className="w-3.5 h-3.5 text-white" />}
            </button>
            <input ref={logoRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadAsset(f, "logo"); }} />
          </div>
          <div className="flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-bold">{empProfile?.company_name ?? "My Company"}</h1>
              {isVerified && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success text-xs font-semibold border border-success/20">
                  <BadgeCheck className="w-3 h-3" /> Verified
                </span>
              )}
              {!isVerified && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs border border-accent/20">
                  <Clock className="w-3 h-3" /> Pending Verification
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {[empProfile?.industry, empProfile?.website].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setActiveTab("post")}>
              <Plus className="w-4 h-4 mr-1" /> Post Opportunity
            </Button>
            <Button variant="outline" size="sm" onClick={() => setActiveTab("profile")}>
              <Edit3 className="w-4 h-4 mr-1" /> Edit Profile
            </Button>
          </div>
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 overflow-x-auto pb-1 mb-6 border-b border-border/40 scrollbar-hide">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all rounded-t-lg border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.id === "applications" && (applications as any[]).filter(a => a.status === "pending").length > 0 && (
                <span className="ml-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {(applications as any[]).filter(a => a.status === "pending").length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="pb-12 space-y-6">
            {/* Analytics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total Applicants",     value: fmt(analytics?.total_applicants), icon: Users,     color: "text-primary",     bg: "bg-primary/10" },
                { label: "Opportunity Views",     value: fmt(analytics?.opportunity_views), icon: Eye,      color: "text-accent",      bg: "bg-accent/10" },
                { label: "Shortlisted Students", value: fmt(analytics?.shortlisted),       icon: UserCheck, color: "text-success",     bg: "bg-success/10" },
                { label: "Hire Conversion",      value: `${hireRate}%`,                   icon: TrendingUp, color: "text-foreground",  bg: "bg-muted/30" },
              ].map(stat => (
                <div key={stat.label} className="glass-card p-5">
                  <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <p className="text-2xl font-bold gradient-text">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Hire conversion bar */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">Hire Conversion Rate</span>
                </div>
                <span className="text-sm font-bold gradient-text">{hireRate}%</span>
              </div>
              <Progress value={hireRate} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>{fmt(analytics?.hired)} hired</span>
                <span>{fmt(analytics?.total_applicants)} total applicants</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Recent applications */}
              <div className="lg:col-span-2 glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Recent Applications</h3>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab("applications")}>View all <ArrowRight className="w-3 h-3 ml-1" /></Button>
                </div>
                {(applications as any[]).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No applications yet. Post an opportunity to start receiving talent.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(applications as any[]).slice(0, 5).map((app: any) => {
                      const s = studentMap[app.student_user_id];
                      return (
                        <div key={app.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/20 hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="w-8 h-8 shrink-0">
                              <AvatarImage src={s?.avatar_url} />
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                {(s?.full_name ?? "?").charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{s?.full_name ?? "Student"}</p>
                              <p className="text-xs text-muted-foreground truncate">{oppMap[app.opportunity_id]?.title ?? "Opportunity"}</p>
                            </div>
                          </div>
                          <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs border ${STATUS_COLORS[app.status] ?? "bg-muted/10 text-muted-foreground border-muted"}`}>
                            {app.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Quick stats */}
              <div className="space-y-4">
                <div className="glass-card p-5">
                  <h3 className="font-semibold mb-3 text-sm">Active Postings</h3>
                  <p className="text-3xl font-bold gradient-text">
                    {(opportunities as any[]).filter((o: any) => o.status === "open").length}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">of {(opportunities as any[]).length} total postings</p>
                  <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setActiveTab("post")}>
                    <Plus className="w-4 h-4 mr-1" /> Post New
                  </Button>
                </div>
                <div className="glass-card p-5">
                  <h3 className="font-semibold mb-3 text-sm">Shortlisted Students</h3>
                  <p className="text-3xl font-bold gradient-text">{shortlists.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">saved to your shortlist</p>
                  <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setActiveTab("talent")}>
                    <Search className="w-4 h-4 mr-1" /> Find Talent
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── COMPANY PROFILE ────────────────────────────────────── */}
        {activeTab === "profile" && (
          <div className="pb-12 max-w-2xl">
            <div className="glass-card p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold">Company Details</h2>
              </div>

              {/* Verification status callout */}
              <div className={`flex items-start gap-3 p-3 rounded-xl border ${isVerified ? "bg-success/5 border-success/20 text-success" : "bg-accent/5 border-accent/20 text-accent"}`}>
                {isVerified ? <BadgeCheck className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                <div>
                  <p className="text-sm font-semibold">{isVerified ? "Verified Employer" : "Verification Pending"}</p>
                  <p className="text-xs opacity-80">{isVerified ? "Your profile has been verified by NEXUS AI Academy." : "Our team will review and verify your profile within 2-3 business days."}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Company Name *</label>
                  <Input value={profileForm.company_name} onChange={e => setProfileForm(f => ({ ...f, company_name: e.target.value }))} placeholder="e.g. Safaricom PLC" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Industry</label>
                  <Input value={profileForm.industry} onChange={e => setProfileForm(f => ({ ...f, industry: e.target.value }))} placeholder="e.g. Telecommunications" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Website</label>
                  <div className="relative">
                    <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-9" value={profileForm.website} onChange={e => setProfileForm(f => ({ ...f, website: e.target.value }))} placeholder="https://example.com" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Contact Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-9" value={profileForm.contact_email} onChange={e => setProfileForm(f => ({ ...f, contact_email: e.target.value }))} placeholder="hr@company.com" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Contact Phone</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-9" value={profileForm.contact_phone} onChange={e => setProfileForm(f => ({ ...f, contact_phone: e.target.value }))} placeholder="+254 700 000 000" />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">About Company</label>
                  <Textarea rows={5} value={profileForm.about} onChange={e => setProfileForm(f => ({ ...f, about: e.target.value }))} placeholder="Describe what your company does, your culture, and what you look for in candidates..." />
                </div>
              </div>

              <Button variant="hero" onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending} className="w-full sm:w-auto">
                {saveProfile.isPending ? "Saving…" : "Save Profile"}
              </Button>
            </div>

            {/* Logo / Banner upload helpers */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="glass-card p-4 text-center cursor-pointer hover:border-primary/30 transition-colors" onClick={() => logoRef.current?.click()}>
                <Upload className="w-6 h-6 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium">Company Logo</p>
                <p className="text-xs text-muted-foreground">PNG, JPG · 500×500 ideal</p>
              </div>
              <div className="glass-card p-4 text-center cursor-pointer hover:border-primary/30 transition-colors" onClick={() => bannerRef.current?.click()}>
                <ImageIcon className="w-6 h-6 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium">Cover Banner</p>
                <p className="text-xs text-muted-foreground">PNG, JPG · 1200×400 ideal</p>
              </div>
            </div>
          </div>
        )}

        {/* ── POST OPPORTUNITY ───────────────────────────────────── */}
        {activeTab === "post" && (
          <div className="pb-12 max-w-2xl">
            <div className="glass-card p-6 space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <Plus className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold">Post an Opportunity</h2>
              </div>

              {/* Type selector */}
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Opportunity Type *</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "job",           label: "Full-Time Job" },
                    { value: "internship",    label: "Internship" },
                    { value: "freelance",     label: "Freelance Gig" },
                    { value: "remote_task",   label: "Remote Task" },
                    { value: "collaboration", label: "Collaboration" },
                    { value: "ai_task",       label: "AI Task" },
                  ].map(t => (
                    <button key={t.value}
                      onClick={() => setOppForm(f => ({ ...f, opportunity_type: t.value }))}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${oppForm.opportunity_type === t.value ? "bg-primary/10 border-primary/40 text-primary font-medium" : "border-border/40 text-muted-foreground hover:border-primary/20"}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Title *</label>
                  <Input value={oppForm.title} onChange={e => setOppForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. AI Chatbot Developer Needed" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Category</label>
                  <select value={oppForm.category} onChange={e => setOppForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Location</label>
                  <select value={oppForm.location_type} onChange={e => setOppForm(f => ({ ...f, location_type: e.target.value }))}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground">
                    {LOCATION.map(l => <option key={l} value={l}>{l.replace("_", " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Experience Level</label>
                  <select value={oppForm.experience_level} onChange={e => setOppForm(f => ({ ...f, experience_level: e.target.value }))}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground">
                    {LEVELS.map(l => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Duration</label>
                  <Input value={oppForm.duration} onChange={e => setOppForm(f => ({ ...f, duration: e.target.value }))} placeholder="e.g. 2 weeks, 3 months" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Budget Min (KES)</label>
                  <Input type="number" value={oppForm.budget_min} onChange={e => setOppForm(f => ({ ...f, budget_min: e.target.value }))} placeholder="5000" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Budget Max (KES)</label>
                  <Input type="number" value={oppForm.budget_max} onChange={e => setOppForm(f => ({ ...f, budget_max: e.target.value }))} placeholder="50000" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Application Deadline</label>
                  <Input type="date" value={oppForm.deadline} onChange={e => setOppForm(f => ({ ...f, deadline: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Required Skills (comma-separated)</label>
                  <Input value={oppForm.required_skills} onChange={e => setOppForm(f => ({ ...f, required_skills: e.target.value }))} placeholder="Python, ChatGPT, Data Analysis" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Description *</label>
                  <Textarea rows={6} value={oppForm.description} onChange={e => setOppForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Describe the role, deliverables, timeline, and what success looks like..." />
                </div>
              </div>

              <Button variant="hero" onClick={() => postOpportunity.mutate()} disabled={postOpportunity.isPending} className="w-full">
                {postOpportunity.isPending ? "Posting…" : "Post Opportunity"}
              </Button>
            </div>
          </div>
        )}

        {/* ── MY POSTINGS ────────────────────────────────────────── */}
        {activeTab === "opportunities" && (
          <div className="pb-12 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">My Postings <span className="text-muted-foreground font-normal text-base">({(opportunities as any[]).length})</span></h2>
              <Button variant="hero" size="sm" onClick={() => setActiveTab("post")}>
                <Plus className="w-4 h-4 mr-1" /> New Posting
              </Button>
            </div>
            {(opportunities as any[]).length === 0 ? (
              <div className="glass-card p-12 text-center">
                <Briefcase className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="font-medium mb-1">No opportunities posted yet</p>
                <p className="text-sm text-muted-foreground mb-4">Post your first opportunity to start finding talent from NEXUS AI Academy.</p>
                <Button variant="hero" onClick={() => setActiveTab("post")}><Plus className="w-4 h-4 mr-1" /> Post First Opportunity</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {(opportunities as any[]).map((opp: any) => {
                  const appCount = (applications as any[]).filter((a: any) => a.opportunity_id === opp.id).length;
                  const isOpen = opp.status === "open";
                  return (
                    <div key={opp.id} className={`glass-card p-5 flex flex-col gap-3 ${isOpen ? "border-primary/10" : "opacity-70"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold leading-tight truncate">{opp.title}</p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium border border-primary/20 capitalize">{opp.opportunity_type.replace("_", " ")}</span>
                            <span className="px-2 py-0.5 rounded-full bg-muted/30 text-muted-foreground text-[10px] capitalize">{opp.location_type.replace("_", " ")}</span>
                          </div>
                        </div>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${isOpen ? "bg-success/10 text-success border-success/20" : "bg-muted/20 text-muted-foreground border-muted"}`}>
                          {opp.status}
                        </span>
                      </div>

                      {(opp.required_skills ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {(opp.required_skills as string[]).slice(0, 4).map((sk: string) => (
                            <span key={sk} className="px-1.5 py-0.5 rounded bg-muted/30 text-[10px] text-muted-foreground">{sk}</span>
                          ))}
                          {(opp.required_skills as string[]).length > 4 && <span className="text-[10px] text-muted-foreground">+{(opp.required_skills as string[]).length - 4}</span>}
                        </div>
                      )}

                      {(opp.budget_min || opp.budget_max) && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Banknote className="w-3.5 h-3.5" />
                          {opp.budget_min && opp.budget_max ? `${fmtKES(opp.budget_min)} – ${fmtKES(opp.budget_max)}` : opp.budget_min ? `From ${fmtKES(opp.budget_min)}` : `Up to ${fmtKES(opp.budget_max)}`}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/30">
                        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {appCount} applicant{appCount !== 1 ? "s" : ""}</span>
                        <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {fmt(opp.views_count)} views</span>
                      </div>

                      <div className="flex gap-2 mt-auto">
                        <Button size="sm" variant="outline" className="flex-1"
                          onClick={() => updateOppStatus.mutate({ id: opp.id, status: isOpen ? "closed" : "open" })}>
                          {isOpen ? "Close" : "Reopen"}
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                          onClick={() => { if (confirm("Delete this opportunity?")) deleteOpp.mutate(opp.id); }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── APPLICATIONS ───────────────────────────────────────── */}
        {activeTab === "applications" && (
          <div className="pb-12 space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <select value={filterOppId} onChange={e => setFilterOppId(e.target.value)}
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground min-w-[180px]">
                  <option value="all">All Opportunities</option>
                  {(opportunities as any[]).map((o: any) => <option key={o.id} value={o.id}>{o.title}</option>)}
                </select>
              </div>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground">
                <option value="all">All Statuses</option>
                {["pending", "viewed", "shortlisted", "accepted", "rejected"].map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
              <span className="text-sm text-muted-foreground ml-auto">{filteredApps.length} application{filteredApps.length !== 1 ? "s" : ""}</span>
            </div>

            {filteredApps.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="font-medium mb-1">No applications yet</p>
                <p className="text-sm text-muted-foreground">Students will appear here once they apply to your opportunities.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredApps.map((app: any) => {
                  const s = studentMap[app.student_user_id] ?? {};
                  const opp = oppMap[app.opportunity_id];
                  const isExpanded = expandedApp === app.id;
                  return (
                    <div key={app.id} className="glass-card overflow-hidden">
                      <div className="p-4 flex flex-col sm:flex-row sm:items-start gap-4">
                        {/* Avatar + name */}
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <Avatar className="w-10 h-10 shrink-0">
                            <AvatarImage src={s?.avatar_url} />
                            <AvatarFallback className="text-sm bg-primary/10 text-primary">{(s?.full_name ?? "?").charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-0.5">
                              <p className="font-semibold text-sm">{s?.full_name ?? "Student"}</p>
                              {s?.rank_title && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">{s.rank_title}</span>}
                              <span className={`px-2 py-0.5 rounded-full text-[10px] border ${STATUS_COLORS[app.status] ?? ""}`}>{app.status}</span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">Applied to: {opp?.title ?? "Opportunity"}</p>
                            {s?.skills?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {(s.skills as string[]).slice(0, 5).map((sk: string) => (
                                  <span key={sk} className="px-1.5 py-0.5 rounded bg-muted/30 text-[10px] text-muted-foreground">{sk}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 shrink-0">
                          <Button size="sm" variant={app.status === "shortlisted" ? "hero" : "outline"}
                            onClick={() => updateAppStatus.mutate({ id: app.id, status: "shortlisted" })}
                            disabled={app.status === "shortlisted" || app.status === "accepted"}>
                            <UserCheck className="w-3.5 h-3.5 mr-1" /> Shortlist
                          </Button>
                          <Button size="sm" variant="hero"
                            onClick={() => updateAppStatus.mutate({ id: app.id, status: "accepted" })}
                            disabled={app.status === "accepted"}
                            className="bg-success/80 hover:bg-success/90">
                            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Hire
                          </Button>
                          <Button size="sm" variant="outline"
                            onClick={() => updateAppStatus.mutate({ id: app.id, status: "rejected" })}
                            disabled={app.status === "rejected"}
                            className="text-destructive border-destructive/30 hover:bg-destructive/5">
                            <X className="w-3.5 h-3.5 mr-1" /> Reject
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`/dashboard/messages?to=${app.student_user_id}`}><MessageCircle className="w-3.5 h-3.5" /></Link>
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setExpandedApp(isExpanded ? null : app.id)}>
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>

                      {/* Expanded: proposal */}
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-border/30 pt-3 space-y-3">
                          {app.proposal && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Proposal</p>
                              <p className="text-sm text-foreground/90 leading-relaxed">{app.proposal}</p>
                            </div>
                          )}
                          {app.cover_message && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Cover Message</p>
                              <p className="text-sm text-foreground/90 leading-relaxed">{app.cover_message}</p>
                            </div>
                          )}
                          {s?.bio && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">About Student</p>
                              <p className="text-sm text-muted-foreground line-clamp-3">{s.bio}</p>
                            </div>
                          )}
                          {s?.certificates?.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Certificates</p>
                              <div className="flex flex-wrap gap-1">
                                {(s.certificates as string[]).map((c: string) => (
                                  <span key={c} className="px-2 py-0.5 rounded-full bg-success/10 text-success text-xs">{c}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {(app.portfolio_links ?? []).length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Portfolio Links</p>
                              <div className="flex flex-wrap gap-2">
                                {(app.portfolio_links as string[]).map((link: string) => (
                                  <a key={link} href={link} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-primary/10 text-primary text-xs hover:bg-primary/20 transition-colors">
                                    <ExternalLink className="w-3 h-3" /> {link.replace(/^https?:\/\//, "").split("/")[0]}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                          <p className="text-[10px] text-muted-foreground">Applied {new Date(app.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TALENT SEARCH ───────────────────────────────────────── */}
        {activeTab === "talent" && (
          <div className="pb-12 space-y-4">
            {/* Search bar */}
            <div className="glass-card p-4 flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[180px]">
                <label className="text-xs text-muted-foreground mb-1 block">Search by skill</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" placeholder="e.g. Python, ChatGPT, Figma…"
                    value={talentFilters.skill}
                    onChange={e => setTalentFilters(f => ({ ...f, skill: e.target.value }))} />
                </div>
              </div>
              <div className="min-w-[160px]">
                <label className="text-xs text-muted-foreground mb-1 block">Availability</label>
                <select value={talentFilters.availability} onChange={e => setTalentFilters(f => ({ ...f, availability: e.target.value }))}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground">
                  <option value="all">All</option>
                  <option value="available_for_work">Available for Work</option>
                  <option value="available_for_internship">Available for Internship</option>
                  <option value="available_for_collaboration">Open to Collaboration</option>
                </select>
              </div>
              <div className="text-sm text-muted-foreground self-center pt-4">{filteredTalent.length} student{filteredTalent.length !== 1 ? "s" : ""}</div>
            </div>

            {/* Shortlisted section */}
            {shortlists.length > 0 && (
              <div className="glass-card p-4 border-primary/10 bg-primary/3">
                <p className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                  <BookmarkCheck className="w-4 h-4 text-primary" /> Your Shortlist ({shortlists.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {(shortlists as any[]).map((s: any) => {
                    const info = talentNameMap[s.student_user_id] ?? {};
                    return (
                      <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5">
                        <Avatar className="w-5 h-5"><AvatarImage src={info?.avatar_url} /><AvatarFallback className="text-[9px]">{(info?.full_name ?? "?").charAt(0)}</AvatarFallback></Avatar>
                        <span className="text-xs font-medium">{info?.full_name ?? "Student"}</span>
                        <button onClick={() => toggleShortlist.mutate(s.student_user_id)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Student grid */}
            {filteredTalent.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <Target className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="font-medium mb-1">No students match your filters</p>
                <p className="text-sm text-muted-foreground">Try a broader skill or change the availability filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredTalent.map((s: any) => {
                  const info = talentNameMap[s.user_id] ?? {};
                  const isShortlisted = shortlistedIds.has(s.user_id);
                  return (
                    <div key={s.user_id} className="glass-card p-5 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3 min-w-0">
                          <Avatar className="w-11 h-11 shrink-0">
                            <AvatarImage src={info?.avatar_url} />
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                              {(info?.full_name ?? "?").charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{info?.full_name ?? "Student"}</p>
                            {s.headline && <p className="text-xs text-muted-foreground truncate">{s.headline}</p>}
                            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] ${AVAIL_COLORS[s.availability_status] ?? ""}`}>
                              {AVAIL_LABELS[s.availability_status] ?? ""}
                            </span>
                          </div>
                        </div>
                        <button onClick={() => toggleShortlist.mutate(s.user_id)}
                          className={`shrink-0 p-1.5 rounded-lg border transition-all ${isShortlisted ? "bg-primary/10 border-primary/30 text-primary" : "border-border/30 text-muted-foreground hover:border-primary/20 hover:text-primary"}`}>
                          {isShortlisted ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                        </button>
                      </div>

                      {s.bio && <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{s.bio}</p>}

                      {(s.skills ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {(s.skills as string[]).slice(0, 6).map((sk: string) => (
                            <span key={sk} className="px-1.5 py-0.5 rounded bg-muted/30 text-[10px] text-muted-foreground border border-muted/50">{sk}</span>
                          ))}
                          {(s.skills as string[]).length > 6 && <span className="text-[10px] text-muted-foreground">+{(s.skills as string[]).length - 6}</span>}
                        </div>
                      )}

                      {(s.certificates ?? []).length > 0 && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <BadgeCheck className="w-3.5 h-3.5 text-success" />
                          <span className="text-success font-medium">{s.certificates.length} Certificate{s.certificates.length !== 1 ? "s" : ""}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-2 border-t border-border/30">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Star className="w-3 h-3 text-accent" />
                          <span className="font-medium text-foreground">{fmt(s.xp_points)}</span> XP
                        </div>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{s.rank_title}</span>
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1" asChild>
                          <Link to={`/dashboard/messages?to=${s.user_id}`}><MessageCircle className="w-3.5 h-3.5 mr-1" /> Contact</Link>
                        </Button>
                        <Button size="sm" variant="hero" className="flex-1" onClick={() => toggleShortlist.mutate(s.user_id)}>
                          {isShortlisted ? <><BookmarkCheck className="w-3.5 h-3.5 mr-1" /> Saved</> : <><Bookmark className="w-3.5 h-3.5 mr-1" /> Save</>}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployerDashboard;
