import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardTopNav from "@/components/dashboard/DashboardTopNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const MarketplaceHubPage = () => {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [skillsInput, setSkillsInput] = useState("");

  const { data: studentProfile, isLoading } = useQuery({
    queryKey: ["marketplace-student-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("marketplace_student_profiles" as any).select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const saveProfile = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase.from("marketplace_student_profiles" as any).upsert({ user_id: user!.id, ...payload }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Marketplace profile updated");
      await qc.invalidateQueries({ queryKey: ["marketplace-student-profile", user?.id] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to update profile"),
  });

  const completion = useMemo(() => {
    const checks = [studentProfile?.headline, studentProfile?.bio, (studentProfile?.skills || []).length > 0, studentProfile?.whatsapp_number];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [studentProfile]);

  if (isLoading) return <div className="p-8">Loading marketplace hub...</div>;

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar />
      <div className="flex-1 min-w-0">
        <DashboardTopNav />
        <main className="p-4 md:p-8 space-y-6">
          <Card>
            <CardHeader><CardTitle>Student Marketplace & Marketing Dashboard</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">Build your profile, showcase projects, and get hired.</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <Card><CardContent className="p-4"><div>XP Points</div><div className="text-2xl font-bold">{studentProfile?.xp_points ?? 0}</div></CardContent></Card>
                <Card><CardContent className="p-4"><div>Rank</div><div className="text-2xl font-bold">{studentProfile?.rank_title ?? "Rookie"}</div></CardContent></Card>
                <Card><CardContent className="p-4"><div>Earnings</div><div className="text-2xl font-bold">KES {Number(studentProfile?.earnings_total ?? 0).toLocaleString()}</div></CardContent></Card>
                <Card><CardContent className="p-4"><div>Completion</div><div className="text-2xl font-bold">{completion}%</div></CardContent></Card>
              </div>
              <Progress value={completion} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Professional Profile</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Headline e.g. UI/UX Designer | Web Developer" defaultValue={studentProfile?.headline ?? ""} onBlur={(e) => saveProfile.mutate({ headline: e.target.value })} />
              <Textarea placeholder="Bio/About" defaultValue={studentProfile?.bio ?? ""} onBlur={(e) => saveProfile.mutate({ bio: e.target.value })} />
              <Input placeholder="WhatsApp number (e.g. +254...)" defaultValue={studentProfile?.whatsapp_number ?? ""} onBlur={(e) => saveProfile.mutate({ whatsapp_number: e.target.value })} />
              <div className="flex gap-2">
                <Input value={skillsInput} onChange={(e) => setSkillsInput(e.target.value)} placeholder="Add skills separated by commas" />
                <Button onClick={() => saveProfile.mutate({ skills: skillsInput.split(",").map((s) => s.trim()).filter(Boolean) })}>Save Skills</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(studentProfile?.skills ?? []).map((skill: string) => <Badge key={skill}>{skill}</Badge>)}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["available_for_work", "Available for Work"],
                  ["available_for_internship", "Internship"],
                  ["available_for_collaboration", "Collaboration"],
                  ["not_available", "Not Available"],
                ].map(([value, label]) => (
                  <Button key={value} variant={studentProfile?.availability_status === value ? "hero" : "outline"} onClick={() => saveProfile.mutate({ availability_status: value })}>{label}</Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Marketing & Visibility</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">Showcase your skills, track profile interest, and share your portfolio with employers.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="glass-card p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Profile Views</p>
                  <p className="text-3xl font-bold">{studentProfile?.profile_views ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Total views in the last 30 days</p>
                </div>
                <div className="glass-card p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Share your profile</p>
                  <div className="rounded-xl border border-border p-3 bg-secondary text-xs break-all">
                    {typeof window !== "undefined" ? `${window.location.origin}/portfolio` : "/portfolio"}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Copy this link and share it with employers.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild><a href="/portfolio">View Portfolio</a></Button>
                <Button variant="outline" asChild><a href="/dashboard/messages">Message Employers</a></Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild><a href="/dashboard/opportunities">Browse Opportunities</a></Button>
              <Button variant="outline" asChild><a href="/dashboard/messages">Message Students/Clients</a></Button>
              <Button variant="outline" asChild><a href="/portfolio">Public Portfolio</a></Button>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default MarketplaceHubPage;
