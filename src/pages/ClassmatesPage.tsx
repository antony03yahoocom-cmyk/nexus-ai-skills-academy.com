import { useAuth } from "@/contexts/AuthContext";
import DashboardTopNav from "@/components/dashboard/DashboardTopNav";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, MessageCircle, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";

const ClassmatesPage = () => {
  const { user } = useAuth();

  const { data: myEnrollments = [] } = useQuery({
    queryKey: ["my-enrollments-classmates", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollments")
        .select("course_id, courses(id, title)")
        .eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const myCourseIds = (myEnrollments as any[]).map((e) => e.course_id);

  // Course mates: users enrolled in same courses
  const { data: courseMates = [] } = useQuery({
    queryKey: ["course-mates", user?.id, myCourseIds.join(",")],
    queryFn: async () => {
      if (myCourseIds.length === 0) return [];
      const { data: ens } = await supabase
        .from("enrollments")
        .select("user_id, course_id")
        .in("course_id", myCourseIds)
        .neq("user_id", user!.id);
      const userIds = [...new Set((ens ?? []).map((e: any) => e.user_id))];
      if (userIds.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles_public" as any)
        .select("user_id, full_name, avatar_url")
        .in("user_id", userIds);
      const courseTitleMap: Record<string, string> = {};
      (myEnrollments as any[]).forEach((e) => { courseTitleMap[e.course_id] = e.courses?.title ?? ""; });
      const matesByUser: Record<string, { profile: any; courses: string[] }> = {};
      (ens ?? []).forEach((e: any) => {
        const prof = (profiles ?? []).find((p: any) => p.user_id === e.user_id);
        if (!prof) return;
        if (!matesByUser[e.user_id]) matesByUser[e.user_id] = { profile: prof, courses: [] };
        const t = courseTitleMap[e.course_id];
        if (t && !matesByUser[e.user_id].courses.includes(t)) matesByUser[e.user_id].courses.push(t);
      });
      return Object.values(matesByUser);
    },
    enabled: !!user && myCourseIds.length > 0,
  });

  // Academy mates: every other student
  const { data: academyMates = [] } = useQuery({
    queryKey: ["academy-mates", user?.id],
    queryFn: async () => {
      const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("role", "admin").limit(100);
      const adminIds = new Set((adminRoles ?? []).map((r) => r.user_id));
      const { data } = await supabase
        .from("profiles_public" as any)
        .select("user_id, full_name, avatar_url, created_at")
        .order("created_at", { ascending: false }).limit(100);
      return (data ?? []).filter((p: any) => p.user_id !== user?.id && !adminIds.has(p.user_id));
    },
    enabled: !!user,
  });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <DashboardTopNav />
      <div className="flex-1 min-h-0">
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 flex flex-col gap-6">
          <div className="shrink-0">
            <h1 className="text-3xl font-display font-bold mb-1">Classmates</h1>
            <p className="text-muted-foreground">Connect with your course mates and the wider NEXUS community.</p>
          </div>

          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-4 shrink-0">
            <BookOpen className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Course Mates</h2>
            <Badge variant="secondary">{(courseMates as any[]).length}</Badge>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          {(courseMates as any[]).length === 0 ? (
            <div className="glass-card p-8 text-center text-muted-foreground">
              {myCourseIds.length === 0 ? "Enroll in a course to see your course mates." : "No one else is enrolled in your courses yet."}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(courseMates as any[]).map(({ profile, courses }) => (
                <div key={profile.user_id} className="glass-card p-4 flex items-center gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={profile.avatar_url ?? undefined} />
                    <AvatarFallback>{(profile.full_name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{profile.full_name || "Student"}</p>
                    <p className="text-xs text-muted-foreground truncate">{courses.join(" · ")}</p>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/dashboard/messages?to=${profile.user_id}`}>
                      <MessageCircle className="w-4 h-4" />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
          </div>
        </section>

        <section className="flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-4 shrink-0">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Academy Mates</h2>
            <Badge variant="secondary">{(academyMates as any[]).length}</Badge>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          {(academyMates as any[]).length === 0 ? (
            <div className="glass-card p-8 text-center text-muted-foreground">No other learners yet — be the first to invite friends!</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(academyMates as any[]).map((p: any) => (
                <div key={p.user_id} className="glass-card p-4 flex items-center gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={p.avatar_url ?? undefined} />
                    <AvatarFallback>{(p.full_name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.full_name || "Student"}</p>
                    <p className="text-xs text-muted-foreground">NEXUS Learner</p>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/dashboard/messages?to=${p.user_id}`}>
                      <MessageCircle className="w-4 h-4" />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
          </div>
        </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClassmatesPage;
