import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { BookOpen, Clock, Trophy, Lock, CreditCard, Crown, Award, FolderOpen, ArrowRight, CheckCircle } from "lucide-react";
import DashboardTopNav from "@/components/dashboard/DashboardTopNav";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const StudentDashboard = () => {
  const { user, profile, trialActive, trialDaysLeft, purchases, hasCourseAccess } = useAuth();
  const isPremium = profile?.is_premium;

  const { data: enrollments = [] } = useQuery({
    queryKey: ["enrollments", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("enrollments").select("*, courses(*)").eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: completions = [] } = useQuery({
    queryKey: ["completions", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("lesson_completions").select("*").eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: certificates = [] } = useQuery({
    queryKey: ["my-certs-dash", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("certificates").select("*").eq("student_id", user!.id).eq("status", "Issued" as any);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["my-projects-dash", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("*, courses(title)").eq("student_id", user!.id).order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ["my-submissions-dash", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("submissions").select("*, assignments(title, lesson_id)").eq("user_id", user!.id).order("submitted_at", { ascending: false }).limit(10);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: announcements = [] } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(3);
      return data ?? [];
    },
    enabled: !!user,
  });

  const totalProgress = enrollments.length > 0
    ? Math.round(enrollments.reduce((sum: number, e: any) => sum + (e.progress || 0), 0) / enrollments.length)
    : 0;

  const stats = [
    { label: "Enrolled Courses", value: String(enrollments.length), icon: BookOpen, color: "text-primary", bg: "bg-primary/10" },
    { label: "Lessons Done", value: String(completions.length), icon: Trophy, color: "text-accent", bg: "bg-accent/10" },
    { label: "Certificates", value: String(certificates.length), icon: Award, color: "text-success", bg: "bg-success/10" },
    {
      label: isPremium ? "Premium" : "Trial Days",
      value: isPremium ? "∞" : String(trialDaysLeft),
      icon: isPremium ? Crown : Clock,
      color: isPremium ? "text-primary" : "text-success",
      bg: isPremium ? "bg-primary/10" : "bg-success/10",
    },
  ];

  const statusColor = (s: string) => {
    if (s === "Approved") return "bg-success/10 text-success border-success/20";
    if (s === "Pending") return "bg-accent/10 text-accent border-accent/20";
    if (s === "Rejected") return "bg-destructive/10 text-destructive border-destructive/20";
    return "bg-secondary text-muted-foreground";
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardTopNav />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-1">Welcome back, {profile?.full_name || "Student"}! 👋</h1>
          <p className="text-muted-foreground">Continue where you left off.</p>
        </div>

        {/* Subscription banner */}
        {isPremium ? (
          <div className="glass-card p-4 mb-8 border-success/30 bg-success/5 flex items-center gap-3">
            <Crown className="w-5 h-5 text-success" />
            <span className="text-sm font-medium text-success">Premium Access Active — All courses unlocked</span>
          </div>
        ) : trialActive ? (
          <div className="glass-card p-4 mb-8 border-accent/30 bg-accent/5 flex items-center justify-between flex-wrap gap-4">
            <div>
              <span className="text-sm font-medium text-accent">Free Trial Active</span>
              <p className="text-xs text-muted-foreground">{trialDaysLeft} days remaining · 1 course · First 7 lessons</p>
            </div>
            <Button variant="hero" size="sm" asChild><Link to="/subscribe">Get Premium</Link></Button>
          </div>
        ) : (
          <div className="glass-card p-4 mb-8 border-destructive/30 bg-destructive/5 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">Trial Expired — Purchase courses or get Premium</span>
            </div>
            <Button variant="hero" size="sm" asChild><Link to="/subscribe">Get Premium</Link></Button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => (
            <div key={stat.label} className="glass-card p-5 hover:border-primary/20 transition-all duration-300">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Overall Progress */}
        {enrollments.length > 0 && (
          <div className="glass-card p-5 mb-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Overall Progress</h3>
              <span className="text-sm font-bold gradient-text">{totalProgress}%</span>
            </div>
            <Progress value={totalProgress} className="h-2 bg-secondary" />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Continue Learning */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Continue Learning</h2>
              <Link to="/courses" className="text-sm text-primary hover:underline flex items-center gap-1">
                All Courses <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {enrollments.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">You haven't enrolled in any courses yet.</p>
                <Button variant="hero" asChild><Link to="/courses">Browse Courses</Link></Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {enrollments.map((enrollment: any) => {
                  const cId = enrollment.course_id;
                  const hasAccess = hasCourseAccess(cId);
                  const coursePurchased = purchases.some((p) => p.course_id === cId);

                  return (
                    <Link key={enrollment.id} to={`/courses/${cId}`} className="glass-card overflow-hidden group hover:border-primary/30 transition-all duration-300">
                      <div className="h-24 bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center text-3xl relative">
                        📚
                        {!hasAccess && (
                          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                            <Lock className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-sm group-hover:text-primary transition-colors flex-1 truncate">
                            {enrollment.courses?.title ?? "Course"}
                          </h3>
                          {coursePurchased && <Badge className="bg-success/10 text-success border-success/20 text-[10px]">Paid</Badge>}
                          {isPremium && <Crown className="w-3 h-3 text-primary" />}
                        </div>
                        <Progress value={enrollment.progress} className="h-1.5 bg-secondary mb-2" />
                        <p className="text-xs text-muted-foreground">{enrollment.progress}% complete</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Recent Assignments */}
            {submissions.length > 0 && (
              <div className="mt-8">
                <h2 className="text-xl font-bold mb-4">Recent Assignments</h2>
                <div className="space-y-3">
                  {submissions.slice(0, 5).map((s: any) => (
                    <div key={s.id} className="glass-card p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle className={`w-4 h-4 ${s.status === "Approved" ? "text-success" : s.status === "Rejected" ? "text-destructive" : "text-accent"}`} />
                        <div>
                          <p className="text-sm font-medium">{(s as any).assignments?.title ?? "Assignment"}</p>
                          <p className="text-xs text-muted-foreground">{new Date(s.submitted_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <Badge className={statusColor(s.status)}>{s.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            {/* Projects */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">My Projects</h3>
                <Link to="/dashboard/projects" className="text-xs text-primary hover:underline">View All</Link>
              </div>
              {projects.length === 0 ? (
                <div className="glass-card p-4 text-center">
                  <FolderOpen className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">No projects yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {projects.slice(0, 3).map((p: any) => (
                    <div key={p.id} className="glass-card p-3 flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{p.title}</p>
                        <p className="text-xs text-muted-foreground">{(p as any).courses?.title}</p>
                      </div>
                      <Badge className={statusColor(p.status)} >{p.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Certificates */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Certificates</h3>
                <Link to="/dashboard/certificates" className="text-xs text-primary hover:underline">View All</Link>
              </div>
              {certificates.length === 0 ? (
                <div className="glass-card p-4 text-center">
                  <Award className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">Complete courses to earn certificates</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {certificates.slice(0, 3).map((c: any) => (
                    <div key={c.id} className="glass-card p-3 flex items-center gap-3">
                      <Award className="w-5 h-5 text-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">Certificate</p>
                        <p className="text-xs text-muted-foreground">{new Date(c.issued_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Announcements */}
            {announcements.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Announcements</h3>
                <div className="space-y-2">
                  {announcements.map((a: any) => (
                    <div key={a.id} className="glass-card p-3">
                      <h4 className="text-sm font-medium">{a.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">{new Date(a.created_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;
