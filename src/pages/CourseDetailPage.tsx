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
import CourseReviews from "@/components/courses/CourseReviews";

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
    queryKey: ["course-modules-public", courseId],
    queryFn: async () => {
      const { data } = await supabase.from("modules_public" as any).select("*").eq("course_id", courseId!).order("sort_order");
      return (data as any[]) ?? [];
    },
    enabled: !!courseId,
  });

  const { data: lessons = [] } = useQuery({
    queryKey: ["course-lessons-public", courseId],
    queryFn: async () => {
      const moduleIds = modules.map((m: any) => m.id);
      if (moduleIds.length === 0) return [];
      const { data } = await supabase.from("lessons_public" as any).select("*").in("module_id", moduleIds).order("sort_order");
      return (data as any[]) ?? [];
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
  // ✅ Enrollment-first: free courses still require an enrollment record before access.
  const canOpenFreeCourse = !!user && isFree && !!enrollment;
  // ✅ Trial students get into their selected trial course (first 5 lessons) even without paying.
  const trialAccess = !!(user && trialActive && profile?.trial_course_id === courseId && !isFree);

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

  // Payment verification on callback (guarded against double-fire in StrictMode)
  const [verifying, setVerifying] = useState(false);
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const verifyRef = searchParams.get("reference");
    const shouldVerify = searchParams.get("verify");

    if (shouldVerify === "true" && verifyRef && session && !verifying) {
      const key = `paystack-verified-${verifyRef}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      setVerifying(true);

      (async () => {
        const loadingToast = toast.loading("Verifying your payment...");
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
          toast.dismiss(loadingToast);
          if (result.success) {
            toast.success(result.message || "Payment successful! Course unlocked.");
            await refreshProfile();
            queryClient.invalidateQueries({ queryKey: ["enrollment"] });
            queryClient.invalidateQueries({ queryKey: ["course-purchases"] });
          } else {
            toast.error(result.message || result.error || "Payment verification failed. Please try again.");
          }
          window.history.replaceState({}, "", `/courses/${courseId}`);
        } catch (error) {
          toast.dismiss(loadingToast);
          console.error("Verification error:", error);
          toast.error("Could not reach our servers to verify payment. Please refresh or contact support.");
        } finally {
          setVerifying(false);
        }
      })();
    }
  }, [session, courseId, queryClient, refreshProfile]);

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
                🕐 Trial: {trialDaysLeft} days left · First 5 lessons accessible
              </div>
            )}

            {/* No access banner - only after enrollment */}
            {user && enrollment && !courseAccess && !trialActive && !isFree && (
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
              {enrollment || canOpenFreeCourse ? (
                courseAccess || canOpenFreeCourse || trialAccess ? (
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
            <div className="flex items-center gap-2 mb-6">
              <Clock className="w-5 h-5 text-primary" />
              <h2 className="text-2xl md:text-3xl font-bold">Course Breakdown</h2>
            </div>
            <div className="space-y-3">
              {modules.map((mod: any, mi: number) => {
                const modLessons = lessons.filter((l: any) => l.module_id === mod.id);
                return (
                  <div key={mod.id} className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {mi + 1}
                      </div>
                      <h3 className="font-semibold flex-1">{mod.title}</h3>
                      <span className="text-xs text-muted-foreground">{modLessons.length} lesson{modLessons.length !== 1 ? "s" : ""}</span>
                    </div>
                    <ul className="space-y-1.5 pl-11">
                      {modLessons.map((lesson: any) => {
                        const isCompleted = completions.includes(lesson.id);
                        return (
                          <li
                            key={lesson.id}
                            className="text-sm flex items-center gap-2 py-1 text-muted-foreground"
                          >
                            {isCompleted ? (
                              <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" />
                            ) : (
                              <span className="w-1 h-1 rounded-full bg-muted-foreground shrink-0" />
                            )}
                            <span className="flex-1">{lesson.title}</span>
                            {lesson.week_number && lesson.day_number ? (
                              <span className="text-xs text-primary/70 font-medium shrink-0">W{lesson.week_number} D{lesson.day_number}</span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="max-w-4xl mx-auto mt-12">
            <CourseReviews courseId={courseId!} />
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CourseDetailPage;
