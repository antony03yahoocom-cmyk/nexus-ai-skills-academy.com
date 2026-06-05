import { useState } from "react";
import AdminSidebar from "@/components/dashboard/AdminSidebar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Users, Search, ChevronDown, ChevronRight, Crown, CreditCard } from "lucide-react";

const AdminEnrollmentsPage = () => {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: courses = [] } = useQuery({
    queryKey: ["admin-enroll-courses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("courses")
        .select("id, title, category, price, is_published")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: allEnrollments = [] } = useQuery({
    queryKey: ["admin-enroll-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollments")
        .select("id, user_id, course_id, progress, enrolled_at");
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-enroll-profiles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, is_premium, subscription_status, avatar_url");
      return data ?? [];
    },
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ["admin-enroll-purchases"],
    queryFn: async () => {
      const { data } = await supabase
        .from("course_purchases")
        .select("user_id, course_id, amount, purchased_at, status")
        .eq("status", "paid");
      return data ?? [];
    },
  });

  const profileMap: Record<string, any> = {};
  profiles.forEach((p: any) => { profileMap[p.user_id] = p; });

  const filteredCourses = courses.filter((c: any) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const getEnrollmentsForCourse = (courseId: string) =>
    allEnrollments.filter((e: any) => e.course_id === courseId);

  const hasPurchased = (userId: string, courseId: string) =>
    purchases.some((p: any) => p.user_id === userId && p.course_id === courseId);

  const getPurchaseAmount = (userId: string, courseId: string) => {
    const p = purchases.find((pu: any) => pu.user_id === userId && pu.course_id === courseId);
    return p ? p.amount : null;
  };

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold mb-1">Course Enrollments</h1>
          <p className="text-muted-foreground mb-6">
            See which students are enrolled in each course and their progress.
          </p>

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
            <div className="glass-card p-4">
              <p className="text-2xl font-bold">{courses.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Total Courses</p>
            </div>
            <div className="glass-card p-4">
              <p className="text-2xl font-bold">{allEnrollments.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Total Enrollments</p>
            </div>
            <div className="glass-card p-4">
              <p className="text-2xl font-bold">{purchases.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Paid Purchases</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search courses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-secondary border-border"
            />
          </div>

          {/* Course accordion */}
          <div className="space-y-3">
            {filteredCourses.map((course: any) => {
              const courseEnrollments = getEnrollmentsForCourse(course.id);
              const isOpen = expanded === course.id;
              const avgProgress = courseEnrollments.length > 0
                ? Math.round(courseEnrollments.reduce((s: number, e: any) => s + (e.progress ?? 0), 0) / courseEnrollments.length)
                : 0;

              return (
                <div key={course.id} className="glass-card overflow-hidden">
                  {/* Course header — click to expand */}
                  <button
                    className="w-full flex items-center gap-3 p-4 sm:p-5 text-left hover:bg-secondary/30 transition-colors"
                    onClick={() => setExpanded(isOpen ? null : course.id)}
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{course.title}</span>
                        {!course.is_published && (
                          <Badge className="bg-secondary text-muted-foreground text-[10px]">Draft</Badge>
                        )}
                        {course.price === 0 && (
                          <Badge className="bg-success/10 text-success border-success/20 text-[10px]">Free</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" /> {courseEnrollments.length} enrolled
                        </span>
                        {courseEnrollments.length > 0 && (
                          <span>Avg progress: {avgProgress}%</span>
                        )}
                        {course.price > 0 && (
                          <span className="flex items-center gap-1">
                            <CreditCard className="w-3 h-3" />
                            KES {Number(course.price).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    {isOpen
                      ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                  </button>

                  {/* Enrolled students table */}
                  {isOpen && (
                    <div className="border-t border-border">
                      {courseEnrollments.length === 0 ? (
                        <div className="p-6 text-center text-sm text-muted-foreground">
                          No students enrolled in this course yet.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-border bg-secondary/30">
                                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Student</th>
                                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Progress</th>
                                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Access</th>
                                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Amount Paid</th>
                                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Enrolled</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                              {courseEnrollments.map((enr: any) => {
                                const prof = profileMap[enr.user_id];
                                const paid = hasPurchased(enr.user_id, course.id);
                                const amount = getPurchaseAmount(enr.user_id, course.id);
                                const prog = enr.progress ?? 0;

                                return (
                                  <tr key={enr.id} className="hover:bg-secondary/20 transition-colors">
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                          {(prof?.full_name || "?")[0].toUpperCase()}
                                        </div>
                                        <div>
                                          <p className="text-sm font-medium">{prof?.full_name || "Unknown"}</p>
                                          {prof?.is_premium && (
                                            <span className="flex items-center gap-0.5 text-[10px] text-primary">
                                              <Crown className="w-2.5 h-2.5" /> Premium
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2 min-w-[120px]">
                                        <Progress value={prog} className="h-1.5 flex-1 bg-border" />
                                        <span className={`text-xs font-semibold shrink-0 ${prog >= 100 ? "text-success" : "text-muted-foreground"}`}>
                                          {prog}%
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      {prof?.is_premium ? (
                                        <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">Premium</Badge>
                                      ) : paid ? (
                                        <Badge className="bg-success/10 text-success border-success/20 text-[10px]">Paid</Badge>
                                      ) : course.price === 0 ? (
                                        <Badge className="bg-success/10 text-success border-success/20 text-[10px]">Free</Badge>
                                      ) : (
                                        <Badge className="bg-accent/10 text-accent border-accent/20 text-[10px]">Trial</Badge>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                      {amount ? (
                                        <span className="text-success font-medium">KES {Number(amount).toLocaleString()}</span>
                                      ) : (
                                        <span className="text-muted-foreground">—</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground">
                                      {enr.enrolled_at ? new Date(enr.enrolled_at).toLocaleDateString() : "—"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredCourses.length === 0 && (
              <div className="glass-card p-10 text-center">
                <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No courses found.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminEnrollmentsPage;
