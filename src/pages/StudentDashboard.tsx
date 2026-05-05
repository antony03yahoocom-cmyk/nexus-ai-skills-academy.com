import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import {
  BookOpen, Clock, Trophy, Lock, CreditCard, Crown, Award, FolderOpen,
  ArrowRight, CheckCircle, Flame, Zap, Target, Sparkles, TrendingUp,
  MessageCircle, Bell, Play, ChevronRight,
} from "lucide-react";
import DashboardTopNav from "@/components/dashboard/DashboardTopNav";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Daily rotating tip ────────────────────────────────────────────
const DAILY_TIPS = [
  { tip: "Consistency beats intensity. 20 minutes of focused study daily beats 3 hours once a week.", emoji: "🎯" },
  { tip: "After each lesson, write 3 key takeaways in your own words. You'll retain 70% more.", emoji: "✍️" },
  { tip: "AI tools are not replacing skills — they're amplifying them. Learn the skill first.", emoji: "🤖" },
  { tip: "Share what you're learning with someone. Teaching is the fastest path to mastery.", emoji: "💬" },
  { tip: "Your assignment feedback is gold. Read every word — it's a personalised roadmap.", emoji: "📋" },
  { tip: "One completed course opens doors others don't even know exist.", emoji: "🚪" },
  { tip: "Progress, not perfection. Submit the assignment. You can always improve.", emoji: "🏃" },
  { tip: "Join a discussion group — the students you meet today could be collaborators tomorrow.", emoji: "🤝" },
  { tip: "Certificates matter more than you think. They're proof you finished what you started.", emoji: "🏆" },
  { tip: "The best time to start was yesterday. The second best time is right now.", emoji: "⚡" },
  { tip: "Read the lesson text carefully — it often contains insights the video skips.", emoji: "📖" },
  { tip: "Your project portfolio is your real CV. Every project you submit builds it.", emoji: "💼" },
];

const getDailyTip = () => {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return DAILY_TIPS[dayOfYear % DAILY_TIPS.length];
};

// ── Streak calculation from completion dates ──────────────────────
const calculateStreak = (completions: any[]): number => {
  if (!completions.length) return 0;
  const uniqueDates = [
    ...new Set(completions.map((c: any) => new Date(c.completed_at).toDateString())),
  ]
    .map((d) => new Date(d))
    .sort((a, b) => b.getTime() - a.getTime());

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (uniqueDates[0] < yesterday) return 0;

  let streak = 1;
  for (let i = 0; i < uniqueDates.length - 1; i++) {
    const diff = Math.round(
      (uniqueDates[i].getTime() - uniqueDates[i + 1].getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff === 1) streak++;
    else break;
  }
  return streak;
};

const categoryEmojis: Record<string, string> = {
  AI: "🤖", "Graphic Design": "🎨", "Data Analysis": "📊",
  Programming: "🐍", "Web Development": "🌐", "Machine Learning": "🧠",
};

const StudentDashboard = () => {
  const { user, profile, trialActive, trialDaysLeft, purchases, hasCourseAccess } = useAuth();
  const isPremium = profile?.is_premium;
  const dailyTip = getDailyTip();

  // ── Data queries ──────────────────────────────────────────────────
  const { data: enrollments = [] } = useQuery({
    queryKey: ["enrollments", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("enrollments").select("*, courses(*)").eq("user_id", user!.id).order("enrolled_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: completions = [] } = useQuery({
    queryKey: ["completions", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("lesson_completions").select("*").eq("user_id", user!.id).order("completed_at", { ascending: false });
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

  // Lessons across all enrolled courses (for week/day + per-course progress)
  const { data: allEnrolledLessons = [] } = useQuery({
    queryKey: ["enrolled-lessons", user?.id, enrollments.map((e: any) => e.course_id).join(",")],
    queryFn: async () => {
      const courseIds = enrollments.map((e: any) => e.course_id);
      if (!courseIds.length) return [];
      const { data: mods } = await supabase.from("modules").select("id, course_id, sort_order").in("course_id", courseIds);
      const moduleIds = (mods ?? []).map((m: any) => m.id);
      if (!moduleIds.length) return [];
      const { data: lessons } = await supabase
        .from("lessons")
        .select("id, module_id, sort_order, week_number, day_number, title")
        .in("module_id", moduleIds)
        .order("sort_order");
      const modMap = Object.fromEntries((mods ?? []).map((m: any) => [m.id, m]));
      return (lessons ?? []).map((l: any) => ({ ...l, course_id: modMap[l.module_id]?.course_id, module_sort: modMap[l.module_id]?.sort_order ?? 0 }));
    },
    enabled: !!user && enrollments.length > 0,
  });

  const { data: announcements = [] } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(3);
      return data ?? [];
    },
    enabled: !!user,
  });

  // Unread messages count for notification badge
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["dash-unread", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("private_messages")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", user!.id)
        .eq("is_read", false);
      return count ?? 0;
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  // Discover: published courses not yet enrolled
  const { data: discoverCourses = [] } = useQuery({
    queryKey: ["discover-courses", user?.id, enrollments.length],
    queryFn: async () => {
      const enrolledIds = enrollments.map((e: any) => e.course_id);
      const { data } = await supabase
        .from("courses")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      return (data ?? []).filter((c: any) => !enrolledIds.includes(c.id)).slice(0, 3);
    },
    enabled: !!user && enrollments.length >= 0,
  });

  // ── Derived values ────────────────────────────────────────────────
  const streak = calculateStreak(completions);
  const weeklyCompletions = completions.filter(
    (c: any) => new Date(c.completed_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  ).length;

  const totalProgress =
    enrollments.length > 0
      ? Math.round(enrollments.reduce((s: number, e: any) => s + (e.progress || 0), 0) / enrollments.length)
      : 0;

  // Most active course = highest progress but not 100%
  const activeEnrollment = [...enrollments]
    .filter((e: any) => (e.progress || 0) < 100)
    .sort((a: any, b: any) => (b.progress || 0) - (a.progress || 0))[0];

  const pendingSubmissions = submissions.filter((s: any) => s.status === "Pending").length;

  const statusColor = (s: string) => {
    if (s === "Approved") return "bg-success/10 text-success border-success/20";
    if (s === "Pending") return "bg-accent/10 text-accent border-accent/20";
    if (s === "Rejected") return "bg-destructive/10 text-destructive border-destructive/20";
    return "bg-secondary text-muted-foreground";
  };

  // ── Stats cards ───────────────────────────────────────────────────
  const stats = [
    {
      label: "Enrolled Courses", value: String(enrollments.length),
      icon: BookOpen, color: "text-primary", bg: "bg-primary/10",
    },
    {
      label: "Lessons Done", value: String(completions.length),
      icon: Trophy, color: "text-accent", bg: "bg-accent/10",
    },
    {
      label: "Certificates", value: String(certificates.length),
      icon: Award, color: "text-success", bg: "bg-success/10",
    },
    {
      label: streak > 0 ? `${streak}-Day Streak 🔥` : isPremium ? "Premium" : "Trial Days",
      value: streak > 0 ? String(streak) : isPremium ? "∞" : String(trialDaysLeft),
      icon: streak > 0 ? Flame : isPremium ? Crown : Clock,
      color: streak > 0 ? "text-orange-400" : isPremium ? "text-primary" : "text-success",
      bg: streak > 0 ? "bg-orange-400/10" : isPremium ? "bg-primary/10" : "bg-success/10",
    },
  ];

  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <DashboardTopNav />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Welcome row ── */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold mb-1">
              Welcome back, {profile?.full_name?.split(" ")[0] || "Student"}! 👋
            </h1>
            <p className="text-muted-foreground text-sm">
              {weeklyCompletions > 0
                ? `You've completed ${weeklyCompletions} lesson${weeklyCompletions > 1 ? "s" : ""} this week. Keep it up!`
                : "Ready to learn something new today?"}
            </p>
          </div>
          {/* Quick action icons */}
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Link to="/dashboard/messages" className="relative">
                <Button variant="outline" size="sm">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Messages
                  <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                </Button>
              </Link>
            )}
            <Link to="/dashboard/notifications">
              <Button variant="outline" size="sm"><Bell className="w-4 h-4" /></Button>
            </Link>
          </div>
        </div>

        {/* ── Subscription banner ── */}
        {isPremium ? (
          <div className="glass-card p-4 mb-6 border-success/30 bg-success/5 flex items-center gap-3">
            <Crown className="w-5 h-5 text-success shrink-0" />
            <span className="text-sm font-medium text-success">Premium Access Active — All courses unlocked</span>
          </div>
        ) : trialActive ? (
          <div className="glass-card p-4 mb-6 border-accent/30 bg-accent/5 flex items-center justify-between flex-wrap gap-4">
            <div>
              <span className="text-sm font-medium text-accent">Free Trial Active</span>
              <p className="text-xs text-muted-foreground">{trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} remaining · 1 course · First 7 lessons</p>
            </div>
            <Button variant="hero" size="sm" asChild><Link to="/subscribe">Upgrade to Premium</Link></Button>
          </div>
        ) : (
          <div className="glass-card p-4 mb-6 border-destructive/30 bg-destructive/5 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">Trial Expired — Purchase courses or get Premium</span>
            </div>
            <Button variant="hero" size="sm" asChild><Link to="/subscribe">Get Premium</Link></Button>
          </div>
        )}

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((stat) => (
            <div key={stat.label} className="glass-card p-5 hover:border-primary/20 transition-all duration-300">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground leading-tight mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* ── Jump back in — next lesson CTA ── */}
        {activeEnrollment && (() => {
          const completedIds = new Set(completions.map((c: any) => c.lesson_id));
          const courseLessons = (allEnrolledLessons as any[])
            .filter((l) => l.course_id === activeEnrollment.course_id)
            .sort((a, b) => (a.module_sort - b.module_sort) || (a.sort_order - b.sort_order));
          const remaining = courseLessons.filter((l) => !completedIds.has(l.id)).length;
          const trigger = remaining <= 2 && remaining > 0
            ? `You're ${remaining} lesson${remaining > 1 ? "s" : ""} away from your first paying client`
            : (activeEnrollment.progress || 0) >= 50
            ? "Don't waste what you started"
            : "Most people quit here — don't be average";
          return (
          <Link
            to={`/courses/${activeEnrollment.course_id}`}
            className="glass-card p-5 mb-6 flex items-center gap-4 hover:border-primary/30 transition-all duration-300 group block"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary/30 transition-colors">
              <Play className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-primary mb-0.5">{trigger}</p>
              <h3 className="font-semibold truncate">{activeEnrollment.courses?.title ?? "Course"}</h3>
              <div className="flex items-center gap-2 mt-1.5">
                <Progress value={activeEnrollment.progress || 0} className="h-1.5 flex-1 max-w-xs bg-secondary" />
                <span className="text-xs text-muted-foreground shrink-0">{activeEnrollment.progress || 0}%</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          </Link>
          );
        })()}

        {/* ── Overall Progress ── */}
        {enrollments.length > 0 && (
          <div className="glass-card p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">Overall Progress</h3>
              </div>
              <span className="text-sm font-bold gradient-text">{totalProgress}%</span>
            </div>
            <Progress value={totalProgress} className="h-2.5 bg-secondary" />
            {totalProgress === 100 && (
              <p className="text-xs text-success mt-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Amazing — you've completed all your courses! Request your certificates.
              </p>
            )}
          </div>
        )}

        {/* ── Pending submission alert ── */}
        {pendingSubmissions > 0 && (
          <div className="glass-card p-4 mb-6 border-accent/30 bg-accent/5 flex items-center gap-3">
            <Target className="w-4 h-4 text-accent shrink-0" />
            <p className="text-sm text-accent">
              You have <strong>{pendingSubmissions}</strong> assignment{pendingSubmissions > 1 ? "s" : ""} under review. Check your messages for feedback.
            </p>
            <Link to="/dashboard/messages" className="ml-auto shrink-0">
              <Button size="sm" variant="outline">Check Messages</Button>
            </Link>
          </div>
        )}

        {/* ── Daily Tip ── */}
        <div className="glass-card p-5 mb-8 border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">{dailyTip.emoji}</span>
            <div>
              <p className="text-xs font-semibold text-primary mb-1 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Daily Learning Tip
              </p>
              <p className="text-sm text-foreground/90 leading-relaxed">{dailyTip.tip}</p>
            </div>
          </div>
        </div>

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Continue Learning + Assignments ── */}
          <div className="lg:col-span-2 space-y-8">

            {/* Enrolled courses */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">My Courses</h2>
                <Link to="/courses" className="text-sm text-primary hover:underline flex items-center gap-1">
                  Browse More <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {enrollments.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">You haven't enrolled in any courses yet.</p>
                  <Button variant="hero" asChild><Link to="/courses">Browse Courses</Link></Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {enrollments.map((enrollment: any) => {
                    const cId = enrollment.course_id;
                    const hasAccess = hasCourseAccess(cId);
                    const coursePurchased = purchases.some((p) => p.course_id === cId);
                    const completedIds = new Set(completions.map((c: any) => c.lesson_id));
                    const courseLessons = (allEnrolledLessons as any[])
                      .filter((l) => l.course_id === cId)
                      .sort((a, b) => (a.module_sort - b.module_sort) || (a.sort_order - b.sort_order));
                    const totalLessons = courseLessons.length;
                    const doneLessons = courseLessons.filter((l) => completedIds.has(l.id)).length;
                    const prog = totalLessons > 0
                      ? Math.round((doneLessons / totalLessons) * 100)
                      : (enrollment.progress || 0);
                    const isComplete = prog >= 100;
                    // Next lesson = first not-completed; current week/day = its labels
                    const nextLesson = courseLessons.find((l) => !completedIds.has(l.id)) || courseLessons[courseLessons.length - 1];
                    const wkLabel = nextLesson?.week_number
                      ? `Week ${nextLesson.week_number}${nextLesson.day_number ? ` · Day ${nextLesson.day_number}` : ""}`
                      : null;

                    return (
                      <Link
                        key={enrollment.id}
                        to={`/courses/${cId}`}
                        className="glass-card overflow-hidden group hover:border-primary/30 transition-all duration-300"
                      >
                        <div className="h-20 sm:h-24 bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center text-3xl relative">
                          {categoryEmojis[enrollment.courses?.category] || "📚"}
                          {!hasAccess && (
                            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                              <Lock className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                          {isComplete && (
                            <div className="absolute top-2 right-2">
                              <Badge className="bg-success/90 text-white border-0 text-[10px]">✓ Complete</Badge>
                            </div>
                          )}
                          {wkLabel && !isComplete && (
                            <div className="absolute bottom-2 left-2">
                              <Badge className="bg-primary/80 text-white border-0 text-[10px]">{wkLabel}</Badge>
                            </div>
                          )}
                        </div>
                        <div className="p-3 sm:p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-sm group-hover:text-primary transition-colors flex-1 truncate">
                              {enrollment.courses?.title ?? "Course"}
                            </h3>
                            {coursePurchased && <Badge className="bg-success/10 text-success border-success/20 text-[10px]">Paid</Badge>}
                            {isPremium && <Crown className="w-3 h-3 text-primary shrink-0" />}
                          </div>
                          {/* Per-course progress bar */}
                          <Progress value={prog} className="h-2 bg-secondary mb-1.5" />
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{doneLessons}/{totalLessons || "—"} lessons</span>
                            <span className="font-semibold gradient-text">{prog}%</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent Assignments */}
            {submissions.length > 0 && (
              <div>
                <h2 className="text-xl font-bold mb-4">Recent Assignments</h2>
                <div className="space-y-3">
                  {submissions.slice(0, 5).map((s: any) => (
                    <div key={s.id} className="glass-card p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <CheckCircle className={`w-4 h-4 shrink-0 ${
                          s.status === "Approved" ? "text-success"
                          : s.status === "Rejected" ? "text-destructive"
                          : "text-accent"}`}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{(s as any).assignments?.title ?? "Assignment"}</p>
                          <p className="text-xs text-muted-foreground">{new Date(s.submitted_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <Badge className={`${statusColor(s.status)} shrink-0`}>{s.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Discover New Courses ── */}
            {discoverCourses.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" /> Discover Courses
                  </h2>
                  <Link to="/courses" className="text-sm text-primary hover:underline flex items-center gap-1">
                    See All <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {discoverCourses.map((c: any) => (
                    <Link
                      key={c.id}
                      to={`/courses/${c.id}`}
                      className="glass-card overflow-hidden hover:border-accent/30 transition-all duration-300 group"
                    >
                      <div className="h-16 bg-gradient-to-br from-accent/20 to-primary/10 flex items-center justify-center text-2xl">
                        {categoryEmojis[c.category] || "📚"}
                      </div>
                      <div className="p-3">
                        <p className="text-xs text-accent font-medium mb-1">{c.category}</p>
                        <h4 className="text-sm font-semibold group-hover:text-primary transition-colors line-clamp-2">{c.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">
                          {c.price ? `KES ${Number(c.price).toLocaleString()}` : "Free"}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Right Sidebar ── */}
          <div className="space-y-6">

            {/* Weekly Activity */}
            <div className="glass-card p-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-400" /> This Week
              </h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{weeklyCompletions}</p>
                  <p className="text-xs text-muted-foreground">lesson{weeklyCompletions !== 1 ? "s" : ""} completed</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-orange-400">{streak > 0 ? `🔥 ${streak}` : "—"}</p>
                  <p className="text-xs text-muted-foreground">day streak</p>
                </div>
              </div>
              {weeklyCompletions === 0 && (
                <p className="text-xs text-muted-foreground mt-2">Start a lesson to build your streak!</p>
              )}
              {weeklyCompletions >= 5 && (
                <p className="text-xs text-success mt-2 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Great week! You're on fire.
                </p>
              )}
            </div>

            {/* Projects */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2"><FolderOpen className="w-4 h-4" /> My Projects</h3>
                <Link to="/dashboard/projects" className="text-xs text-primary hover:underline">View All</Link>
              </div>
              {projects.length === 0 ? (
                <div className="glass-card p-4 text-center">
                  <FolderOpen className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground mb-2">No projects yet</p>
                  <Link to="/dashboard/projects" className="text-xs text-primary hover:underline">Submit your first project →</Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {projects.slice(0, 3).map((p: any) => (
                    <div key={p.id} className="glass-card p-3 flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{p.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{(p as any).courses?.title}</p>
                      </div>
                      <Badge className={statusColor(p.status)}>{p.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Certificates */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2"><Award className="w-4 h-4" /> Certificates</h3>
                <Link to="/dashboard/certificates" className="text-xs text-primary hover:underline">View All</Link>
              </div>
              {certificates.length === 0 ? (
                <div className="glass-card p-4 text-center">
                  <Award className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground mb-2">Complete a course to earn your first certificate</p>
                  <Link to="/dashboard/certificates" className="text-xs text-primary hover:underline">View progress →</Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {certificates.slice(0, 3).map((c: any) => (
                    <div key={c.id} className="glass-card p-3 flex items-center gap-3">
                      <Award className="w-5 h-5 text-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">Certificate Earned</p>
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
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Bell className="w-4 h-4" /> Announcements
                </h3>
                <div className="space-y-2">
                  {announcements.map((a: any) => (
                    <div key={a.id} className="glass-card p-3 border-primary/10">
                      <h4 className="text-sm font-medium">{a.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.content}</p>
                      <p className="text-xs text-muted-foreground mt-1.5">{new Date(a.created_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA for unenrolled / no courses */}
            {enrollments.length === 0 && (
              <div className="glass-card p-5 text-center border-primary/20 bg-gradient-to-b from-primary/5 to-transparent">
                <Sparkles className="w-8 h-8 text-primary mx-auto mb-2" />
                <h4 className="font-semibold mb-1">Start Your Journey</h4>
                <p className="text-xs text-muted-foreground mb-3">Pick a course and begin learning today</p>
                <Button variant="hero" size="sm" asChild className="w-full">
                  <Link to="/courses">Browse Courses</Link>
                </Button>
              </div>
            )}

            {/* Quick links */}
            <div className="glass-card p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Links</p>
              {[
                { to: "/discussions", icon: MessageCircle, label: "Discussion Groups" },
                { to: "/dashboard/messages", icon: MessageCircle, label: "Messages", badge: unreadCount },
                { to: "/dashboard/notifications", icon: Bell, label: "Notifications" },
                { to: "/subscribe", icon: CreditCard, label: isPremium ? "Premium Active" : "Upgrade to Premium" },
              ].map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors relative"
                >
                  <link.icon className="w-4 h-4 shrink-0" />
                  {link.label}
                  {link.badge && link.badge > 0 ? (
                    <span className="ml-auto h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                      {link.badge > 9 ? "9+" : link.badge}
                    </span>
                  ) : (
                    <ChevronRight className="w-3 h-3 ml-auto" />
                  )}
                </Link>
              ))}
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;
