import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, MapPin, Clock, Briefcase, DollarSign, Bookmark, BookmarkCheck, Flag, Sparkles } from "lucide-react";
import DashboardTopNav from "@/components/dashboard/DashboardTopNav";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const statusColor: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  viewed: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  shortlisted: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  accepted: "bg-green-500/10 text-green-400 border-green-500/20",
  rejected: "bg-red-500/10 text-red-400 border-red-500/20",
};

export default function OpportunityDetailPage() {
  const { opportunityId } = useParams<{ opportunityId: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [proposal, setProposal] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");

  const { data: saved } = useQuery({
    queryKey: ["saved-opportunity", opportunityId, user?.id],
    enabled: !!user && !!opportunityId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("marketplace_saved_opportunities")
        .select("id")
        .eq("user_id", user!.id)
        .eq("opportunity_id", opportunityId)
        .maybeSingle();
      return data as { id: string } | null;
    },
  });

  const toggleSave = useMutation({
    mutationFn: async () => {
      if (saved) {
        const { error } = await (supabase as any)
          .from("marketplace_saved_opportunities")
          .delete()
          .eq("id", saved.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("marketplace_saved_opportunities")
          .insert({ user_id: user!.id, opportunity_id: opportunityId });
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast.success(saved ? "Removed from saved" : "Saved");
      await qc.invalidateQueries({ queryKey: ["saved-opportunity", opportunityId, user?.id] });
      await qc.invalidateQueries({ queryKey: ["saved-opportunities", user?.id] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const submitReport = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("content_reports").insert({
        reporter_id: user!.id,
        target_type: "opportunity",
        target_id: opportunityId,
        reason: reportReason || "other",
        details: reportDetails || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Report submitted to admins");
      setReportOpen(false);
      setReportReason("");
      setReportDetails("");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to report"),
  });

  const generateAIProposal = async () => {
    if (!op) return;
    setAiLoading(true);
    try {
      const { data: sp } = await (supabase as any)
        .from("marketplace_student_profiles")
        .select("headline, bio, skills")
        .eq("user_id", user!.id)
        .maybeSingle();
      const { data, error } = await supabase.functions.invoke("ai-proposal", {
        body: {
          opportunityTitle: op.title,
          opportunityDescription: op.description,
          requiredSkills: op.required_skills,
          studentHeadline: sp?.headline,
          studentBio: sp?.bio,
          studentSkills: sp?.skills,
        },
      });
      if (error) throw error;
      if (data?.proposal) {
        setProposal(data.proposal);
        toast.success("AI draft ready — edit before submitting");
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (e: any) {
      toast.error(e.message ?? "AI assist failed");
    } finally {
      setAiLoading(false);
    }
  };


  const { data: op, isLoading } = useQuery({
    queryKey: ["opportunity", opportunityId],
    queryFn: async () => {
      // FIX: cast as any — table not yet in generated Supabase types
      const { data, error } = await (supabase as any)
        .from("marketplace_opportunities")
        .select("*")
        .eq("id", opportunityId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!opportunityId,
  });

  const { data: myApplication } = useQuery({
    queryKey: ["my-application", opportunityId, user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("marketplace_applications")
        .select("*")
        .eq("opportunity_id", opportunityId)
        .eq("student_user_id", user!.id)
        .maybeSingle();
      return data as any;
    },
    enabled: !!user && !!opportunityId,
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("marketplace_applications")
        .insert({ opportunity_id: opportunityId, student_user_id: user!.id, proposal });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Application submitted!");
      await qc.invalidateQueries({ queryKey: ["my-application", opportunityId, user?.id] });
      await qc.invalidateQueries({ queryKey: ["my-marketplace-applications", user?.id] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to apply"),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardTopNav />
        <main className="max-w-3xl mx-auto px-4 py-12 space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="glass-card p-6 animate-pulse space-y-3">
              <div className="h-5 bg-secondary rounded w-1/2" />
              <div className="h-3 bg-secondary rounded w-full" />
              <div className="h-3 bg-secondary rounded w-3/4" />
            </div>
          ))}
        </main>
      </div>
    );
  }

  if (!op) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardTopNav />
        <main className="max-w-3xl mx-auto px-4 py-12 text-center">
          <p className="text-muted-foreground">Opportunity not found.</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link to="/opportunities">Browse all opportunities</Link>
          </Button>
        </main>
      </div>
    );
  }

  const canApply = !!user && !myApplication && proposal.trim().length >= 20;

  return (
    <div className="min-h-screen bg-background">
      <DashboardTopNav />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Back + action row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link to="/opportunities">
              <ArrowLeft className="w-4 h-4 mr-1" /> All Opportunities
            </Link>
          </Button>
          {user && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleSave.mutate()}
                disabled={toggleSave.isPending}
              >
                {saved ? <BookmarkCheck className="w-4 h-4 mr-1" /> : <Bookmark className="w-4 h-4 mr-1" />}
                {saved ? "Saved" : "Save"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setReportOpen(true)}>
                <Flag className="w-4 h-4 mr-1" /> Report
              </Button>
            </div>
          )}
        </div>

        {/* Details card */}
        <Card className="glass-card">
          <CardHeader>
            <div className="flex flex-wrap items-start gap-3 justify-between">
              <CardTitle className="text-2xl leading-tight">{op.title}</CardTitle>
              <Badge className="text-xs uppercase shrink-0">{op.status}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground pt-1">
              <span className="flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" />
                {op.opportunity_type?.replace("_", " ")}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {op.location_type}
              </span>
              {op.duration && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {op.duration}
                </span>
              )}
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <DollarSign className="w-3.5 h-3.5" />
                {op.currency} {op.budget_min ?? 0}
                {op.budget_max ? ` – ${op.budget_max}` : "+"}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed whitespace-pre-line">{op.description}</p>

            {(op.required_skills ?? []).length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Required Skills
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(op.required_skills as string[]).map((s) => (
                    <Badge key={s} variant="secondary">{s}</Badge>
                  ))}
                </div>
              </div>
            )}

            {op.experience_level && (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Experience level:</span>{" "}
                {op.experience_level}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Application card */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Apply for this opportunity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!user ? (
              <div className="text-center space-y-3 py-4">
                <p className="text-muted-foreground text-sm">You need to be signed in to apply.</p>
                <Button asChild>
                  <Link to="/login">Sign In to Apply</Link>
                </Button>
              </div>
            ) : myApplication ? (
              <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-2">
                <p className="text-sm font-medium">You've already applied to this opportunity.</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Badge className={statusColor[myApplication.status] ?? ""}>
                    {myApplication.status}
                  </Badge>
                </div>
                {myApplication.status === "shortlisted" && (
                  <p className="text-sm text-green-400">
                    🎉 Congratulations — you've been shortlisted! Check your messages.
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className="text-sm font-medium" htmlFor="proposal">
                      Cover letter / Proposal
                      <span className="text-muted-foreground font-normal ml-1">(min 20 characters)</span>
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={generateAIProposal}
                      disabled={aiLoading}
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1" />
                      {aiLoading ? "Drafting..." : "AI Assist"}
                    </Button>
                  </div>
                  <Textarea
                    id="proposal"
                    value={proposal}
                    onChange={(e) => setProposal(e.target.value)}
                    placeholder="Tell the employer why you're the right fit, what you'd bring to this role, and any relevant experience..."
                    rows={6}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {proposal.length} characters
                  </p>
                </div>
                <Button
                  disabled={!canApply || applyMutation.isPending}
                  onClick={() => applyMutation.mutate()}
                  className="w-full sm:w-auto"
                >
                  {applyMutation.isPending ? "Submitting..." : "Submit Application"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
