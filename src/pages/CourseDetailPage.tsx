import { useParams, Link, useNavigate } from "react-router-dom";
import { Clock, PlayCircle, FileText, CheckCircle, Lock, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useState, useEffect } from "react";

const CourseDetailPage = () => {
  const { courseId } = useParams();
  const { user, session, profile, hasCourseAccess, canAccessLesson, trialActive, trialDaysLeft, selectTrialCourse, refreshProfile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [payLoading, setPayLoading] = useState(false);

  const { data: course } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("*").eq("id", courseId!).single();
      return data;
    },
    enabled: !!courseId,
  });

  const { data: modules = [] } = useQuery({
    queryKey: ["course-modules", courseId],
    queryFn: async () => {
      const { data } = await supabase.from("modules").select("*").eq("course_id", courseId!).order("sort_order");
      return data ?? [];
    },
    enabled: !!courseId,
  });

  const { data: lessons = [] } = useQuery({
    queryKey: ["course-lessons", courseId],
    queryFn: async () => {
      const moduleIds = modules.map((m: any) => m.id);
      if (moduleIds.length === 0) return [];
      const { data } = await supabase.from("lessons").select("*").in("module_id", moduleIds).order("sort_order");
      return data ?? [];
    },
    enabled: modules.length > 0,
  });

  const { data: enrollment } = useQuery({
    queryKey: ["enrollment", user?.id, courseId],
    queryFn: async () => {
      const { data } = await supabase.from("enrollments").select("*").eq("user_id", user!.id).eq("course_id", courseId!).maybeSingle();
      return data;
    },
    enabled: !!user && !!courseId,
  });

  const { data: completions = [] } = useQuery({
    queryKey: ["course-completions", user?.id, courseId],
    queryFn: async () => {
      const lessonIds = lessons.map((l: any) => l.id);
      if (lessonIds.length === 0) return [];
      const { data } = await supabase.from("lesson_completions").select("lesson_id").eq("user_id", user!.id).in("lesson_id", lessonIds);
      return data?.map((c: any) => c.lesson_id) ?? [];
    },
    enabled: !!user && lessons.length > 0,
  });

  const enroll = useMutation({
    mutationFn: async () => {
      if (!user) { navigate("/login"); return; }
      const { error } = await supabase.from("enrollments").insert({ user_id: user.id, course_id: courseId! });
      if (error) throw error;
      // For free courses, auto-create a "paid" purchase record so hasCourseAccess works
      if (course?.price === 0) {
        await supabase.from("course_purchases").insert({
          user_id: user.id,
          course_id: courseId!,
          amount: 0,
          status: "paid",
          reference: "free-course",
        });
      }
      // If on trial and no trial course selected yet, and course is NOT free, select this one
      if (trialActive && !profile?.trial_course_id && course?.price !== 0) {
        await selectTrialCourse(courseId!);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollment"] });
      refreshProfile();
      toast.success("Enrolled successfully!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const courseAccess = courseId ? hasCourseAccess(courseId) : false;
  const isFree = course?.price === 0;

  const handleBuyCourse = async () => {
    if (!user || !session || !course) {
      toast.error("Please log in first");
      return;
    }
    setPayLoading(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paystack?action=initialize`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            course_id: courseId,
            plan_type: "course",
            callback_url: `${window.location.origin}/courses/${courseId}?verify=true`,
          }),
        }
      );
      const data = await resp.json();
      if (data.data?.authorization_url) {
        window.location.href = data.data.authorization_url;
      } else {
        toast.error(data.error || "Failed to initialize payment");
      }
    } catch (e) {
      toast.error("Payment initialization failed");
    }
    setPayLoading(false);
  };

  // Payment verification on callback
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const verifyRef = searchParams.get("reference");
    const shouldVerify = searchParams.get("verify");

    if (shouldVerify === "true" && verifyRef && session) {
      (async () => {
        try {
          const resp = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paystack?action=verify`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              },
              body: JSON.stringify({ reference: verifyRef }),
            }
          );
          const result = await resp.json();
          if (result.success) {
            toast.success("Payment successful! You now have full access to this course.");
            await refreshProfile();
            queryClient.invalidateQueries({ queryKey: ["enrollment"] });
            queryClient.invalidateQueries({ queryKey: ["course-purchases"] });
            // Clean URL
            window.history.replaceState({}, "", `/courses/${courseId}`);
          } else {
            toast.error("Payment verification failed. Please try again.");
          }
        } catch (error) {
          console.error("Verification error:", error);
          toast.error("Verification error. Please contact support.");
        }
      })();
    }
  }, [session, courseId, queryClient]);

  // Build flat lesson list with global index for sequential access
  const allLessonsOrdered: any[] = [];
  modules.forEach((mod: any) => {
    const modLessons = lessons.filter((l: any) => l.module_id === mod.id);
    modLessons.forEach((l: any) => allLessonsOrdered.push(l));
  });

  // Find first accessible incomplete lesson
  const firstAccessibleLesson = allLessonsOrdered.find((l, idx) => {
    if (idx === 0) return !completions.includes(l.id);
    const prevCompleted = completions.includes(allLessonsOrdered[idx - 1].id);
    return prevCompleted && !completions.includes(l.id);
  });

  if (!course) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading...</div>;

  const priceFormatted = course.price ? `KES ${course.price.toLocaleString()}` : "Free";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto mb-12">
            <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">{course.category}</span>
            <h1 className="text-3xl md:text-5xl font-bold mt-4 mb-4">{course.title}</h1>
            <p className="text-muted-foreground text-lg mb-4 leading-relaxed">{course.description}</p>

            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{modules.length} modules · {lessons.length} lessons</span>
              <span className="font-bold text-foreground text-lg">{priceFormatted}</span>
            </div>

            {/* Trial banner - only for paid courses */}
            {user && trialActive && profile?.trial_course_id === courseId && !courseAccess && !isFree && (
              <div className="glass-card p-3 mb-4 border-accent/30 bg-accent/5 text-sm">
                🕐 Trial: {trialDaysLeft} days left · First 7 lessons accessible
              </div>
            )}

            {/* No access banner */}
            {user && !courseAccess && !trialActive && !isFree && (
              <div className="glass-card p-4 mb-6 border-destructive/30 bg-destructive/5 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-destructive" />
                  <span className="text-sm font-medium text-destructive">
                    {profile?.trial_course_id ? "Trial expired — purchase to continue" : "Purchase this course to access lessons"}
                  </span>
                </div>
                <Button variant="hero" size="sm" onClick={handleBuyCourse} disabled={payLoading}>
                  <CreditCard className="w-4 h-4 mr-1" />
                  {payLoading ? "Processing..." : `Buy for ${priceFormatted}`}
                </Button>
              </div>
            )}

            {/* Trial course selection - only for paid courses */}
            {user && trialActive && !profile?.trial_course_id && !courseAccess && !isFree && (
              <div className="glass-card p-4 mb-6 border-primary/30 bg-primary/5 text-sm">
                You can select <strong>one course</strong> for your 7-day free trial. Enroll below to start!
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {enrollment ? (
                courseAccess ? (
                  <Button variant="hero" size="lg" asChild>
                    <Link to={firstAccessibleLesson ? `/lesson/${firstAccessibleLesson.id}` : (allLessonsOrdered[0] ? `/lesson/${allLessonsOrdered[0].id}` : "#")}>
                      Continue Learning
                    </Link>
                  </Button>
                ) : !isFree ? (
                  <Button variant="hero" size="lg" onClick={handleBuyCourse} disabled={payLoading}>
                    <CreditCard className="w-4 h-4 mr-2" />
                    {payLoading ? "Processing..." : `Buy for ${priceFormatted}`}
                  </Button>
                ) : null
              ) : (
                <Button variant="hero" size="lg" onClick={() => user ? enroll.mutate() : navigate("/login")}>
                  {user ? "Enroll Now" : "Sign In to Enroll"}
                </Button>
              )}

              {user && !profile?.is_premium && (
                <Button variant="outline" size="lg" asChild>
                  <Link to="/subscribe">Get Premium — All Courses</Link>
                </Button>
              )}
            </div>
          </div>

          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">Course Curriculum</h2>
            <div className="space-y-4">
              {modules.map((mod: any) => {
                const modLessons = lessons.filter((l: any) => l.module_id === mod.id);
                return (
                  <div key={mod.id} className="glass-card overflow-hidden">
                    <div className="p-5 border-b border-border">
                      <h3 className="font-semibold">{mod.title}</h3>
                    </div>
                    <div className="divide-y divide-border">
                      {modLessons.map((lesson: any) => {
                        const globalIdx = allLessonsOrdered.findIndex((l) => l.id === lesson.id);
                        const isCompleted = completions.includes(lesson.id);
                        const canAccess = enrollment && (isAdmin || (() => {
                          // Sequential: previous must be completed (or it's the first)
                          if (globalIdx === 0) return canAccessLesson(courseId!, globalIdx);
                          const prevCompleted = completions.includes(allLessonsOrdered[globalIdx - 1]?.id);
                          return prevCompleted && canAccessLesson(courseId!, globalIdx);
                        })());
                        const isLocked = !canAccess;

                        return (
                          <div
                            key={lesson.id}
                            className={`flex items-center gap-3 p-4 ${canAccess ? "hover:bg-secondary/50 cursor-pointer" : "opacity-50"}`}
                            onClick={() => canAccess && navigate(`/lesson/${lesson.id}`)}
                          >
                            {isCompleted ? (
                              <CheckCircle className="w-5 h-5 text-success shrink-0" />
                            ) : lesson.content_type === "video" ? (
                              <PlayCircle className={`w-5 h-5 shrink-0 ${canAccess ? "text-primary" : "text-muted-foreground"}`} />
                            ) : lesson.content_type === "pdf" ? (
                              <FileText className="w-5 h-5 text-accent shrink-0" />
                            ) : (
                              <CheckCircle className="w-5 h-5 text-muted-foreground shrink-0" />
                            )}
                            <span className="flex-1 text-sm">{lesson.title}</span>
                            {trialActive && globalIdx >= 7 && profile?.trial_course_id === courseId && !isCompleted && !isFree && (
                              <span className="text-xs text-muted-foreground">Trial limit</span>
                            )}
                            {isLocked && <Lock className="w-4 h-4 text-muted-foreground" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CourseDetailPage;
