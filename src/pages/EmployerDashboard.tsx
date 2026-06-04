import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardTopNav from "@/components/dashboard/DashboardTopNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";

const EmployerDashboard = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [opportunityForm, setOpportunityForm] = useState({
    title: "",
    description: "",
    opportunity_type: "freelance",
    location_type: "remote",
    experience_level: "entry",
    category: "AI",
    budget_min: "",
    budget_max: "",
    required_skills: "",
  });

  const { data: employerHub = { projects: [], opportunities: [] }, isLoading: employerHubLoading } = useQuery({
    queryKey: ["employer-marketplace-hub", user?.id],
    queryFn: async () => {
      const [projectsRes, opportunitiesRes] = await Promise.all([
        supabase.from("marketplace_projects").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("marketplace_opportunities").select("*").eq("employer_user_id", user!.id).order("created_at", { ascending: false }).limit(50),
      ]);
      if (projectsRes.error) throw projectsRes.error;
      if (opportunitiesRes.error) throw opportunitiesRes.error;
      return { projects: projectsRes.data ?? [], opportunities: opportunitiesRes.data ?? [] };
    },
    enabled: !!user,
  });

  const projects = employerHub.projects;
  const opportunities = employerHub.opportunities;
  const projectsLoading = employerHubLoading;
  const opportunitiesLoading = employerHubLoading;

  const opportunityIds = useMemo(() => opportunities.map((o: any) => o.id), [opportunities]);

  const { data: applications = [], isLoading: applicationsLoading } = useQuery({
    queryKey: ["employer-applications", opportunityIds.join(",")],
    queryFn: async () => {
      if (!opportunityIds.length) return [];
      const { data, error } = await supabase
        .from("marketplace_applications")
        .select("*")
        .in("opportunity_id", opportunityIds)
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user && opportunityIds.length > 0,
  });

  const studentIds = useMemo(
    () => [...new Set(applications.map((app: any) => app.student_user_id))],
    [applications],
  );

  const { data: studentProfiles = [] } = useQuery({
    queryKey: ["employer-application-students", studentIds.join(",")],
    queryFn: async () => {
      if (!studentIds.length) return [];
      const { data, error } = await (supabase as any).from("profiles_public").select("user_id, full_name").in("user_id", studentIds).limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: studentIds.length > 0,
  });

  const studentMap = useMemo(
    () => Object.fromEntries((studentProfiles as any[]).map((profile) => [profile.user_id, profile.full_name || "Student"])),
    [studentProfiles],
  );


  const applicationsByOpportunity = useMemo(() => {
    const grouped = new Map<string, any[]>();
    applications.forEach((application: any) => {
      const items = grouped.get(application.opportunity_id) ?? [];
      items.push(application);
      grouped.set(application.opportunity_id, items);
    });
    return grouped;
  }, [applications]);

  const createOpportunity = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to post opportunities");
      const title = opportunityForm.title.trim();
      const description = opportunityForm.description.trim();
      if (!title || !description) throw new Error("Title and description are required");

      const { error } = await supabase.from("marketplace_opportunities").insert({
        employer_user_id: user.id,
        title,
        description,
        opportunity_type: opportunityForm.opportunity_type,
        location_type: opportunityForm.location_type,
        experience_level: opportunityForm.experience_level,
        category: opportunityForm.category || null,
        budget_min: opportunityForm.budget_min ? Number(opportunityForm.budget_min) : null,
        budget_max: opportunityForm.budget_max ? Number(opportunityForm.budget_max) : null,
        required_skills: opportunityForm.required_skills.split(",").map((skill) => skill.trim()).filter(Boolean),
        status: "open",
        currency: "KES",
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Opportunity posted to the marketplace");
      setOpportunityForm({ title: "", description: "", opportunity_type: "freelance", location_type: "remote", experience_level: "entry", category: "AI", budget_min: "", budget_max: "", required_skills: "" });
      await qc.invalidateQueries({ queryKey: ["employer-marketplace-hub", user?.id] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to post opportunity"),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("marketplace_applications").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Application status updated");
      await qc.invalidateQueries({ queryKey: ["employer-applications", opportunityIds.join(",")] });
    },
    onError: (e: any) => {
      toast.error(e.message ?? "Failed to update application status");
    },
  });

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar />
      <div className="flex-1">
        <DashboardTopNav />
        <main className="p-6">
          <h1 className="text-2xl font-bold mb-4">Employer Dashboard</h1>
          <p className="text-sm text-muted-foreground mb-6">Review student work, shortlist candidates, and move hires forward.</p>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Post a real marketplace opportunity</CardTitle></CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Input value={opportunityForm.title} onChange={(e) => setOpportunityForm((form) => ({ ...form, title: e.target.value }))} placeholder="Role or gig title" />
                  <Input value={opportunityForm.category} onChange={(e) => setOpportunityForm((form) => ({ ...form, category: e.target.value }))} placeholder="Category" />
                </div>
                <Textarea value={opportunityForm.description} onChange={(e) => setOpportunityForm((form) => ({ ...form, description: e.target.value }))} placeholder="Describe deliverables, timeline, and success criteria" rows={4} />
                <div className="grid gap-3 md:grid-cols-4">
                  <Input value={opportunityForm.opportunity_type} onChange={(e) => setOpportunityForm((form) => ({ ...form, opportunity_type: e.target.value }))} placeholder="freelance/job/internship" />
                  <Input value={opportunityForm.location_type} onChange={(e) => setOpportunityForm((form) => ({ ...form, location_type: e.target.value }))} placeholder="remote/hybrid/onsite" />
                  <Input value={opportunityForm.budget_min} onChange={(e) => setOpportunityForm((form) => ({ ...form, budget_min: e.target.value }))} placeholder="Min budget" type="number" />
                  <Input value={opportunityForm.budget_max} onChange={(e) => setOpportunityForm((form) => ({ ...form, budget_max: e.target.value }))} placeholder="Max budget" type="number" />
                </div>
                <Input value={opportunityForm.required_skills} onChange={(e) => setOpportunityForm((form) => ({ ...form, required_skills: e.target.value }))} placeholder="Required skills, comma separated" />
                <Button onClick={() => createOpportunity.mutate()} disabled={createOpportunity.isPending}>Post Opportunity</Button>
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <Card>
                <CardHeader><CardTitle>Open Opportunities</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {opportunitiesLoading ? (
                    <p>Loading opportunities...</p>
                  ) : opportunities.length === 0 ? (
                    <p className="text-sm text-muted-foreground">You haven’t posted any opportunities yet.</p>
                  ) : (
                    opportunities.map((op: any) => (
                      <div key={op.id} className="rounded-2xl border border-border p-3">
                        <p className="font-semibold truncate">{op.title}</p>
                        <p className="text-xs text-muted-foreground">{op.opportunity_type} • {op.location_type}</p>
                        <p className="text-xs text-muted-foreground mt-2">Applicants: {(applicationsByOpportunity.get(op.id) ?? []).length}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="xl:col-span-2">
                <CardHeader><CardTitle>Review Student Projects</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {projectsLoading ? (
                    <p>Loading projects...</p>
                  ) : projects.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No student projects are currently available.</p>
                  ) : (
                    projects.slice(0, 6).map((project: any) => (
                      <div key={project.id} className="rounded-2xl border border-border p-3">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div>
                            <p className="font-semibold truncate">{project.title}</p>
                            <p className="text-xs text-muted-foreground">{studentMap[project.student_user_id] || "Student"}</p>
                          </div>
                          <Link to={`/dashboard/messages?to=${project.student_user_id}`} className="text-primary text-xs hover:underline">Message</Link>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Application Pipeline</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {applicationsLoading ? (
                  <p>Loading applications...</p>
                ) : applications.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No applications yet. Students will appear here once they apply.</p>
                ) : (
                  applications.map((application: any) => (
                    <div key={application.id} className="rounded-2xl border border-border p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{studentMap[application.student_user_id] || "Student"}</p>
                          <p className="text-xs text-muted-foreground">Applied to: {opportunities.find((op: any) => op.id === application.opportunity_id)?.title || "Opportunity"}</p>
                          <p className="text-xs text-muted-foreground mt-2">Status: <span className="font-medium">{application.status}</span></p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant={application.status === "shortlisted" ? "hero" : "outline"}
                            onClick={() => updateStatus.mutate({ id: application.id, status: "shortlisted" })}
                            disabled={application.status === "shortlisted" || application.status === "accepted"}
                          >
                            Shortlist
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => updateStatus.mutate({ id: application.id, status: "accepted" })}
                            disabled={application.status === "accepted"}
                          >
                            Hire
                          </Button>
                          <Button asChild size="sm" variant="outline"><Link to={`/dashboard/messages?to=${application.student_user_id}`}>Message</Link></Button>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-3 line-clamp-3">{application.proposal}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default EmployerDashboard;
