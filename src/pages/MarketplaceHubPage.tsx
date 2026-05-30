import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FolderOpen,
  ExternalLink,
  Star,
  UploadCloud,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardTopNav from "@/components/dashboard/DashboardTopNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const AVAILABILITY_OPTIONS = [
  { value: "available_for_work", label: "Available for Work", color: "bg-success/10 text-success" },
  { value: "available_for_internship", label: "Available for Internship", color: "bg-primary/10 text-primary" },
  { value: "available_for_collaboration", label: "Available for Collaboration", color: "bg-accent/10 text-accent" },
  { value: "not_available", label: "Not Available", color: "bg-muted/10 text-muted-foreground" },
];

const availabilityLabel = (value: string) => AVAILABILITY_OPTIONS.find((option) => option.value === value)?.label ?? "Not Available";
const availabilityClass = (value: string) => AVAILABILITY_OPTIONS.find((option) => option.value === value)?.color ?? "bg-muted/10 text-muted-foreground";
const isMissingMarketplaceTableError = (error: any) =>
  typeof error?.message === "string" && /Could not find the table 'public\.marketplace_/i.test(error.message);

const profileCompletion = (profile: any, hasAvatar: boolean) => {
  const checks = [
    Boolean(profile?.headline?.trim()),
    Boolean(profile?.bio?.trim()),
    Boolean(profile?.skills?.length),
    Boolean(profile?.completed_courses?.length),
    Boolean(profile?.certificates?.length),
    Boolean(profile?.whatsapp_number?.trim()),
    Boolean(profile?.social_links && Object.values(profile.social_links).some((value: string) => value?.trim())),
    Boolean(profile?.availability_status && profile.availability_status !== "not_available"),
    hasAvatar,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
};

const MarketplaceHubPage = () => {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [skillsInput, setSkillsInput] = useState("");
  const [coursesInput, setCoursesInput] = useState("");
  const [certificatesInput, setCertificatesInput] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [projectTools, setProjectTools] = useState("");
  const [projectMedia, setProjectMedia] = useState("");
  const [socialLinks, setSocialLinks] = useState({ linkedin: "", github: "", website: "", portfolio: "" });

  const { data: hubData, isLoading } = useQuery({
    queryKey: ["marketplace-student-hub", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_marketplace_student_hub" as any, { p_user_id: user!.id });
      if (!error) {
        return {
          profile: (data as any)?.profile ?? null,
          projects: (data as any)?.projects ?? [],
          applications: (data as any)?.applications ?? [],
          testimonials: (data as any)?.testimonials ?? [],
          savedOpportunitiesCount: (data as any)?.saved_opportunities_count ?? 0,
        };
      }

      if (/Could not find the function|schema cache|marketplace_saved_opportunities/.test(error.message)) {
        const [profileRes, projectsRes, applicationsRes, testimonialsRes, savedRes] = await Promise.all([
          supabase.from("marketplace_student_profiles" as any).select("*").eq("user_id", user!.id).maybeSingle(),
          supabase.from("marketplace_projects" as any).select("*").eq("student_user_id", user!.id).order("created_at", { ascending: false }).limit(6),
          supabase.from("marketplace_applications" as any).select("*, marketplace_opportunities(title)").eq("student_user_id", user!.id).order("created_at", { ascending: false }).limit(25),
          supabase.from("testimonials").select("*").eq("is_published", true).order("created_at", { ascending: false }).limit(3),
          supabase.from("marketplace_saved_opportunities" as any).select("*", { count: "exact", head: true }).eq("student_user_id", user!.id),
        ]);

        for (const result of [profileRes, projectsRes, applicationsRes, testimonialsRes, savedRes]) {
          if (result.error && !/Could not find the table/.test(result.error.message)) throw result.error;
        }

        return {
          profile: profileRes.data ?? null,
          projects: projectsRes.data ?? [],
          applications: applicationsRes.data ?? [],
          testimonials: testimonialsRes.data ?? [],
          savedOpportunitiesCount: savedRes.count ?? 0,
        };
      }

      throw error;
    },
  });

  const studentProfile = hubData?.profile ?? null;
  const projects = hubData?.projects ?? [];
  const applications = hubData?.applications ?? [];
  const testimonials = hubData?.testimonials ?? [];
  const savedOpportunitiesCount = hubData?.savedOpportunitiesCount ?? null;

  useEffect(() => {
    if (!studentProfile) return;
    setHeadline(studentProfile.headline ?? "");
    setBio(studentProfile.bio ?? "");
    setWhatsapp(studentProfile.whatsapp_number ?? "");
    setSkillsInput((studentProfile.skills ?? []).join(", "));
    setCoursesInput((studentProfile.completed_courses ?? []).join(", "));
    setCertificatesInput((studentProfile.certificates ?? []).join(", "));
    setSocialLinks({
      linkedin: studentProfile.social_links?.linkedin ?? "",
      github: studentProfile.social_links?.github ?? "",
      website: studentProfile.social_links?.website ?? "",
      portfolio: studentProfile.social_links?.portfolio ?? "",
    });
  }, [studentProfile]);

  const saveProfile = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase
        .from("marketplace_student_profiles")
        .upsert({ user_id: user!.id, ...payload }, { onConflict: "user_id" });
      if (error) {
        if (isMissingMarketplaceTableError(error)) return;
        throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Marketplace profile updated");
      await qc.invalidateQueries({ queryKey: ["marketplace-student-hub", user?.id] });
    },
    onError: (error: any) => toast.error(error.message || "Unable to update profile"),
  });

  const saveProject = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase.from("marketplace_projects").insert({ student_user_id: user!.id, ...payload });
      if (error) {
        if (isMissingMarketplaceTableError(error)) return;
        throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Project added to your portfolio");
      setProjectTitle("");
      setProjectDesc("");
      setProjectTools("");
      setProjectMedia("");
      await qc.invalidateQueries({ queryKey: ["marketplace-student-hub", user?.id] });
    },
    onError: (error: any) => toast.error(error.message || "Failed to save project"),
  });

  const saveSocialLinks = () => {
    saveProfile.mutate({ social_links: socialLinks });
  };

  const saveArrays = () => {
    saveProfile.mutate({
      skills: skillsInput.split(",").map((skill) => skill.trim()).filter(Boolean),
      completed_courses: coursesInput.split(",").map((course) => course.trim()).filter(Boolean),
      certificates: certificatesInput.split(",").map((cert) => cert.trim()).filter(Boolean),
    });
  };

  const profileUrl = typeof window !== "undefined" ? `${window.location.origin}/portfolio` : "/portfolio";
  const completionScore = useMemo(() => profileCompletion(studentProfile, Boolean(profile?.avatar_url)), [profile?.avatar_url, studentProfile]);
  const projectCount = projects.length;
  const applicationCount = applications.length;
  const reviewData = useMemo(() => applications.filter((app: any) => typeof app.employer_rating === "number"), [applications]);
  const reviewCount = reviewData.length;
  const reviewAverage = useMemo(
    () => reviewCount > 0 ? (reviewData.reduce((sum: number, app: any) => sum + (app.employer_rating ?? 0), 0) / reviewCount).toFixed(1) : "0.0",
    [reviewCount, reviewData],
  );
  const whatsappLink = useMemo(
    () => studentProfile?.whatsapp_number ? `https://wa.me/${studentProfile.whatsapp_number.replace(/[^0-9]/g, "")}` : null,
    [studentProfile?.whatsapp_number],
  );

  if (isLoading) return <div className="p-8">Loading marketplace hub...</div>;

  return (
    <div className="min-h-screen bg-background">
      <DashboardTopNav />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-primary via-sky-500 to-cyan-400 text-white p-6">
            <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <Avatar className="w-24 h-24 border border-white/25 shadow-lg shadow-slate-900/10">
                  {profile?.avatar_url ? (
                    <AvatarImage src={profile.avatar_url} alt={profile.full_name ?? "Student"} />
                  ) : null}
                  <AvatarFallback className="text-2xl text-white">
                    {(profile?.full_name || user?.email || "S")[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-white/80 mb-2">Student Marketplace</p>
                  <h1 className="text-3xl font-semibold">{studentProfile?.headline || "Build a profile that gets you hired"}</h1>
                  <p className="mt-2 max-w-xl text-sm text-white/90">{studentProfile?.bio || "Write a powerful bio, add skills, portfolio projects, and share your profile with employers."}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full xl:w-auto">
                <div className="rounded-3xl border border-white/10 bg-white/10 p-4 text-center">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/70">XP Points</p>
                  <p className="mt-2 text-2xl font-semibold">{studentProfile?.xp_points ?? 0}</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/10 p-4 text-center">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/70">Rank</p>
                  <p className="mt-2 text-2xl font-semibold">{studentProfile?.rank_title ?? "Rookie"}</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/10 p-4 text-center">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/70">Earnings</p>
                  <p className="mt-2 text-2xl font-semibold">KES {Number(studentProfile?.earnings_total ?? 0).toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-white/70">Profile completion</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-3xl font-semibold">{completionScore}%</span>
                  <Badge className="bg-white/10 text-white border-white/20">{availabilityLabel(studentProfile?.availability_status)}</Badge>
                </div>
                <Progress value={completionScore} className="mt-4 h-3 bg-white/20" />
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-white/70">Applied opportunities</p>
                <p className="mt-3 text-3xl font-semibold">{applicationCount}</p>
                <p className="text-sm text-white/80 mt-2">View activity and upcoming responses in Messages.</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-white/70">Saved opportunities</p>
                <p className="mt-3 text-3xl font-semibold">{savedOpportunitiesCount ?? "—"}</p>
                <p className="text-sm text-white/80 mt-2">Save job posts and gigs for later in the marketplace.</p>
              </div>
            </div>
          </div>
          <CardContent className="grid gap-6 lg:grid-cols-[1.4fr_1fr] p-6">
            <div className="space-y-5">
              <div className="rounded-3xl border border-border bg-card p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Client Reviews</p>
                    <p className="mt-2 text-2xl font-semibold">{reviewAverage} <span className="text-sm text-muted-foreground">/ 5</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Reviewer count</p>
                    <p className="mt-2 text-2xl font-semibold">{reviewCount}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} className={`w-4 h-4 ${index < Math.round(Number(reviewAverage)) ? "text-primary fill-current" : "text-muted-foreground"}`} />
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-border bg-card p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Portfolio projects</p>
                <p className="mt-2 text-2xl font-semibold">{projectCount}</p>
                <p className="text-sm text-muted-foreground mt-2">Publish real work to build trust with hiring managers.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-border bg-card p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Share your profile</p>
                    <p className="mt-2 text-sm text-foreground/80 break-all">{profileUrl}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => {
                    navigator.clipboard.writeText(profileUrl);
                    toast.success("Profile link copied");
                  }}>
                    Copy Link
                  </Button>
                </div>
              </div>
              <div className="rounded-3xl border border-border bg-card p-5 space-y-3">
                <Button className="w-full" asChild>
                  <Link to={user?.id ? `/dashboard/messages?to=${user.id}` : "/dashboard/messages"}>Message Student</Link>
                </Button>
                <Button variant="hero" className="w-full" onClick={() => {
                  navigator.clipboard.writeText(profileUrl);
                  toast.success("Share this link to get hired");
                }}>
                  Hire Me
                </Button>
                {whatsappLink && (
                  <Button variant="outline" className="w-full" asChild>
                    <a href={whatsappLink} target="_blank" rel="noreferrer">WhatsApp Chat</a>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Marketplace Profile Builder</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Headline</p>
                    <Input
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      onBlur={() => saveProfile.mutate({ headline })}
                      placeholder="UI/UX designer, data analyst, freelance developer"
                    />
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Availability</p>
                    <div className="grid grid-cols-2 gap-2">
                      {AVAILABILITY_OPTIONS.map((option) => (
                        <Button
                          key={option.value}
                          variant={studentProfile?.availability_status === option.value ? "hero" : "outline"}
                          size="sm"
                          onClick={() => saveProfile.mutate({ availability_status: option.value })}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold">Bio / About</p>
                  <Textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    onBlur={() => saveProfile.mutate({ bio })}
                    placeholder="Share your story, strengths, and what you want to build next."
                    rows={5}
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">WhatsApp contact</p>
                    <Input
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      onBlur={() => saveProfile.mutate({ whatsapp_number: whatsapp })}
                      placeholder="+254712345678"
                    />
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Social links</p>
                    <div className="grid gap-2">
                      <Input
                        value={socialLinks.linkedin}
                        onChange={(e) => setSocialLinks({ ...socialLinks, linkedin: e.target.value })}
                        placeholder="LinkedIn URL"
                      />
                      <Input
                        value={socialLinks.github}
                        onChange={(e) => setSocialLinks({ ...socialLinks, github: e.target.value })}
                        placeholder="GitHub URL"
                      />
                      <Input
                        value={socialLinks.website}
                        onChange={(e) => setSocialLinks({ ...socialLinks, website: e.target.value })}
                        placeholder="Personal website"
                      />
                      <Input
                        value={socialLinks.portfolio}
                        onChange={(e) => setSocialLinks({ ...socialLinks, portfolio: e.target.value })}
                        placeholder="Portfolio URL"
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={saveSocialLinks}>Save Social Links</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Skills, Courses & Certificates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Skill badges</p>
                  <Input
                    value={skillsInput}
                    onChange={(e) => setSkillsInput(e.target.value)}
                    placeholder="Add skills separated by commas"
                  />
                  <div className="flex flex-wrap gap-2">
                    {(studentProfile?.skills ?? []).map((skill: string) => (
                      <Badge key={skill}>{skill}</Badge>
                    ))}
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Completed courses</p>
                    <Textarea
                      value={coursesInput}
                      onChange={(e) => setCoursesInput(e.target.value)}
                      placeholder="Add course names separated by commas"
                      rows={3}
                    />
                    <div className="flex flex-wrap gap-2">
                      {(studentProfile?.completed_courses ?? []).map((course: string) => (
                        <Badge key={course} variant="secondary">{course}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Certificates</p>
                    <Textarea
                      value={certificatesInput}
                      onChange={(e) => setCertificatesInput(e.target.value)}
                      placeholder="Add certificate names separated by commas"
                      rows={3}
                    />
                    <div className="flex flex-wrap gap-2">
                      {(studentProfile?.certificates ?? []).map((cert: string) => (
                        <Badge key={cert} variant="outline">{cert}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <Button onClick={saveArrays}>Update Profile Items</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Portfolio Gallery</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  {projects.length > 0 ? (
                    projects.map((project: any) => (
                      <div key={project.id} className="rounded-3xl border border-border bg-card p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <p className="text-sm font-semibold">{project.title}</p>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{project.description}</p>
                          </div>
                          <Badge className="bg-primary/10 text-primary border-primary/20">Live</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {(project.tools_used ?? []).slice(0, 4).map((tool: string) => (
                            <Badge key={tool} variant="outline">{tool}</Badge>
                          ))}
                        </div>
                        <div className="grid gap-2">
                          {(project.media_urls ?? []).slice(0, 2).map((url: string) => (
                            url.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                              <img key={url} src={url} alt={project.title} className="h-24 w-full rounded-2xl object-cover" />
                            ) : (
                              <a key={url} href={url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline flex items-center gap-2">
                                <ExternalLink className="w-4 h-4" /> View media
                              </a>
                            )
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-border bg-card p-6 text-center">
                      <FolderOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No portfolio work added yet.</p>
                      <p className="text-xs text-muted-foreground mt-2">Add a project below to get visible on the marketplace.</p>
                    </div>
                  )}
                </div>

                <div className="rounded-3xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-semibold">Add a new portfolio project</p>
                      <p className="text-xs text-muted-foreground">Include a title, description, tools, and media links.</p>
                    </div>
                    <UploadCloud className="w-5 h-5 text-primary" />
                  </div>
                  <div className="grid gap-4">
                    <Input
                      value={projectTitle}
                      onChange={(e) => setProjectTitle(e.target.value)}
                      placeholder="Project title"
                    />
                    <Textarea
                      value={projectDesc}
                      onChange={(e) => setProjectDesc(e.target.value)}
                      placeholder="Project description"
                      rows={3}
                    />
                    <Input
                      value={projectTools}
                      onChange={(e) => setProjectTools(e.target.value)}
                      placeholder="Tools used (comma separated)"
                    />
                    <Input
                      value={projectMedia}
                      onChange={(e) => setProjectMedia(e.target.value)}
                      placeholder="Media URL(s) separated by commas"
                    />
                    <Button
                      onClick={() => {
                        if (!projectTitle.trim()) {
                          toast.error("Project title is required");
                          return;
                        }
                        saveProject.mutate({
                          title: projectTitle.trim(),
                          description: projectDesc.trim(),
                          tools_used: projectTools.split(",").map((item) => item.trim()).filter(Boolean),
                          media_urls: projectMedia.split(",").map((item) => item.trim()).filter(Boolean),
                        });
                      }}
                    >
                      Add Project
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Quick Panel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-3xl border border-border bg-card p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-3">Profile photo</p>
                  <div className="flex items-center gap-4">
                    <Avatar className="w-16 h-16">
                      {profile?.avatar_url ? (
                        <AvatarImage src={profile.avatar_url} alt={profile.full_name ?? "Profile"} />
                      ) : null}
                      <AvatarFallback className="text-xl">{(profile?.full_name || user?.email || "S")[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">Use your account avatar as your marketplace photo.</p>
                      <Link to="/dashboard/settings" className="text-sm text-primary hover:underline">Update photo in settings</Link>
                    </div>
                  </div>
                </div>
                <div className="rounded-3xl border border-border bg-card p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-3">Contacts</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-secondary/60 p-3">
                      <div>
                        <p className="text-sm font-medium">WhatsApp</p>
                        <p className="text-xs text-muted-foreground">{studentProfile?.whatsapp_number || "Not added"}</p>
                      </div>
                      {whatsappLink && (
                        <a href={whatsappLink} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">Chat</a>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-secondary/60 p-3">
                      <div>
                        <p className="text-sm font-medium">Email</p>
                        <p className="text-xs text-muted-foreground">{user?.email}</p>
                      </div>
                      <a href={`mailto:${user?.email}`} className="text-sm text-primary hover:underline">Send email</a>
                    </div>
                  </div>
                </div>
                <div className="rounded-3xl border border-border bg-card p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-3">Visibility</p>
                  <div className="grid gap-3">
                    <div className="rounded-2xl border border-border bg-secondary/60 p-3">
                      <p className="text-sm font-medium">Profile views</p>
                      <p className="text-2xl font-semibold mt-1">{studentProfile?.profile_views ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-secondary/60 p-3">
                      <p className="text-sm font-medium">Estimated reach</p>
                      <p className="text-xs text-muted-foreground mt-1">Complete your profile to appear among top students.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Testimonials</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {reviewData.length > 0 ? (
                  reviewData.slice(0, 3).map((review: any) => (
                    <div key={review.id} className="rounded-3xl border border-border bg-card p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">{review.employer_rating}</div>
                        <div>
                          <p className="text-sm font-semibold">{review.marketplace_opportunities?.title || "Employer review"}</p>
                          <p className="text-xs text-muted-foreground">{new Date(review.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{review.cover_message || "No message provided."}</p>
                    </div>
                  ))
                ) : testimonials.length > 0 ? (
                  testimonials.map((testimonial: any) => (
                    <div key={testimonial.id} className="rounded-3xl border border-border bg-card p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <p className="text-sm font-semibold">{testimonial.name}</p>
                        <div className="flex items-center gap-1 text-primary">
                          {Array.from({ length: testimonial.rating ?? 5 }).map((_, index) => (
                            <Star key={index} className="w-3.5 h-3.5 fill-current" />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{testimonial.content}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-3xl border border-border bg-card p-4 text-center text-sm text-muted-foreground">
                    No testimonials yet. Share your profile link with employers to collect reviews.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MarketplaceHubPage;
