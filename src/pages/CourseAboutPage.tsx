import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import {
  PlayCircle, Clock, BookOpen, CheckCircle2, Users, CreditCard,
  Award, Target, Sparkles, ArrowRight, GraduationCap, Calendar, Star,
} from "lucide-react";
import CourseReviews from "@/components/courses/CourseReviews";
import { useCourseRatings } from "@/hooks/useCourseRatings";

const isYouTube = (u: string) => /youtube\.com|youtu\.be/.test(u);
const ytEmbed = (u: string) => {
  const id = u.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/)?.[1];
  return id ? `https://www.youtube.com/embed/${id}` : u;
};
const isVimeo = (u: string) => /vimeo\.com/.test(u);
const vimeoEmbed = (u: string) => {
  const id = u.match(/vimeo\.com\/(\d+)/)?.[1];
  return id ? `https://player.vimeo.com/video/${id}` : u;
};

const CourseAboutPage = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, session, profile, hasCourseAccess, trialActive, selectTrialCourse, refreshProfile } = useAuth();
  const [payLoading, setPayLoading] = useState(false);

  const { data: ratings = {} } = useCourseRatings();
  const courseRating = courseId ? ratings[courseId] : undefined;

  const { data: course, isLoading } = useQuery({
    queryKey: ["course-about", courseId],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("*").eq("id", courseId!).single();
      return data;
    },
    enabled: !!courseId,
  });

  const { data: modules = [] } = useQuery({
    queryKey: ["course-modules-about", courseId],
    queryFn: async () => {
      const { data } = await supabase.from("modules").select("*").eq("course_id", courseId!).order("sort_order");
      return data ?? [];
    },
    enabled: !!courseId,
  });

  const { data: lessons = [] } = useQuery({
    queryKey: ["course-lessons-about", courseId],
    queryFn: async () => {
      const moduleIds = modules.map((m: any) => m.id);
      if (!moduleIds.length) return [];
      const { data } = await supabase.from("lessons").select("*").in("module_id", moduleIds).order("sort_order");
      return data ?? [];
    },
    enabled: modules.length > 0,
  });

  const { data: enrollment } = useQuery({
    queryKey: ["enrollment-about", user?.id, courseId],
    queryFn: async () => {
      const { data } = await supabase.from("enrollments").select("*").eq("user_id", user!.id).eq("course_id", courseId!).maybeSingle();
      return data;
    },
    enabled: !!user && !!courseId,
  });

  const enroll = useMutation({
    mutationFn: async () => {
      if (!user) { navigate("/login"); return; }
      const { error } = await supabase.from("enrollments").insert({ user_id: user.id, course_id: courseId! });
      if (error) throw error;
      if (course?.price === 0) {
        await supabase.from("course_purchases").insert({
          user_id: user.id, course_id: courseId!, amount: 0, status: "paid", reference: "free-course",
        });
      }
      if (trialActive && !profile?.trial_course_id && course?.price !== 0) {
        await selectTrialCourse(courseId!);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollment-about"] });
      refreshProfile();
      toast.success("Enrolled! Start learning now.");
      navigate(`/courses/${courseId}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleBuy = async () => {
    if (!user || !session || !course) { toast.error("Please log in first"); return; }
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
      if (data.data?.authorization_url) window.location.href = data.data.authorization_url;
      else toast.error(data.error || "Failed to initialize payment");
    } catch {
      toast.error("Payment initialization failed");
    }
    setPayLoading(false);
  };

  if (isLoading || !course) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const isFree = course.price === 0;
  const courseAccess = courseId ? hasCourseAccess(courseId) : false;
  // ✅ Enrollment-first: students must enroll (free or paid) before they can open lessons or pay.
  const canOpenFreeCourse = !!user && isFree && !!enrollment;
  const needsEnroll = !!user && !enrollment;
  const priceFormatted = isFree ? "Free" : `KES ${course.price.toLocaleString()}`;
  const achievements: string[] = Array.isArray(course.what_you_achieve) ? (course.what_you_achieve as any[]).map(String) : [];
  const audience: string[] = Array.isArray(course.who_is_for) ? (course.who_is_for as any[]).map(String) : [];
  const trailerUrl: string | null = course.trailer_video_url || null;

  const renderTrailer = () => {
    if (!trailerUrl) {
      return (
        <div className="aspect-video w-full rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
          <div className="text-center">
            <PlayCircle className="w-16 h-16 text-primary/60 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Trailer coming soon</p>
          </div>
        </div>
      );
    }
    if (isYouTube(trailerUrl)) {
      return <iframe src={ytEmbed(trailerUrl)} className="aspect-video w-full rounded-2xl" allowFullScreen title="Course trailer" />;
    }
    if (isVimeo(trailerUrl)) {
      return <iframe src={vimeoEmbed(trailerUrl)} className="aspect-video w-full rounded-2xl" allowFullScreen title="Course trailer" />;
    }
    // direct file
    return (
      <video
        src={trailerUrl}
        controls
        controlsList="nodownload"
        onContextMenu={(e) => e.preventDefault()}
        className="aspect-video w-full rounded-2xl bg-black"
      />
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="pt-24 pb-12 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-5 gap-8 items-center max-w-6xl mx-auto">
            <div className="lg:col-span-3 space-y-4">
              <Badge variant="secondary" className="text-xs">{course.category}</Badge>
              <h1 className="text-3xl md:text-5xl font-bold leading-tight">{course.title}</h1>
              <p className="text-muted-foreground text-base md:text-lg leading-relaxed">{course.description}</p>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <BookOpen className="w-4 h-4" /> {modules.length} modules
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-4 h-4" /> {lessons.length} lessons
                </span>
                {course.instructor_name && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <GraduationCap className="w-4 h-4" /> {course.instructor_name}
                  </span>
                )}
                {courseRating && (
                  <span className="flex items-center gap-1.5">
                    <Star className="w-4 h-4 fill-primary text-primary" />
                    <span className="font-semibold">{courseRating.avg.toFixed(1)}</span>
                    <span className="text-muted-foreground">({courseRating.count})</span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <span className="text-2xl font-bold gradient-text">{priceFormatted}</span>
                {courseAccess || canOpenFreeCourse ? (
                  <Button variant="hero" size="lg" asChild>
                    <Link to={`/courses/${courseId}`}>
                      Continue Learning <ArrowRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                ) : !user ? (
                  <Button variant="hero" size="lg" onClick={() => navigate("/login")}>
                    Sign In to Enroll
                  </Button>
                ) : !enrollment ? (
                  <Button variant="hero" size="lg" onClick={() => enroll.mutate()} disabled={enroll.isPending}>
                    {enroll.isPending ? "Enrolling…" : isFree ? "Enroll for Free" : "Enroll Now"}
                  </Button>
                ) : isFree ? (
                  <Button variant="hero" size="lg" asChild>
                    <Link to={`/courses/${courseId}`}>Start Learning <ArrowRight className="w-4 h-4 ml-1" /></Link>
                  </Button>
                ) : (
                  <Button variant="hero" size="lg" onClick={handleBuy} disabled={payLoading}>
                    <CreditCard className="w-4 h-4 mr-2" />
                    {payLoading ? "Processing…" : `Pay ${priceFormatted}`}
                  </Button>
                )}
              </div>
            </div>

            <div className="lg:col-span-2">
              {renderTrailer()}
            </div>
          </div>
        </div>
      </section>

      {/* What You'll Achieve */}
      {achievements.length > 0 && (
        <section className="py-12">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="flex items-center gap-2 mb-6">
              <Target className="w-5 h-5 text-primary" />
              <h2 className="text-2xl md:text-3xl font-bold">What You'll Achieve</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {achievements.map((a, i) => (
                <div key={i} className="glass-card p-4 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                  <p className="text-sm leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Who This Is For */}
      {audience.length > 0 && (
        <section className="py-12 bg-secondary/30">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="flex items-center gap-2 mb-6">
              <Users className="w-5 h-5 text-accent" />
              <h2 className="text-2xl md:text-3xl font-bold">Who This Is For</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {audience.map((a, i) => (
                <div key={i} className="glass-card p-4 flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <p className="text-sm leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Long Description */}
      {course.long_description && (
        <section className="py-12">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="text-2xl md:text-3xl font-bold mb-6">About This Course</h2>
            <div className="prose prose-invert prose-sm md:prose-base max-w-none whitespace-pre-wrap text-foreground/90 leading-relaxed">
              {course.long_description}
            </div>
          </div>
        </section>
      )}

      {/* Course Breakdown */}
      <section className="py-12 bg-secondary/30">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center gap-2 mb-6">
            <Calendar className="w-5 h-5 text-primary" />
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
                    <h3 className="font-semibold">{mod.title}</h3>
                    <span className="text-xs text-muted-foreground ml-auto">{modLessons.length} lesson{modLessons.length !== 1 ? "s" : ""}</span>
                  </div>
                  <ul className="space-y-1.5 pl-11">
                    {modLessons.map((l: any) => (
                      <li key={l.id} className="text-sm text-muted-foreground flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                        <span className="flex-1">{l.title}</span>
                        {l.week_number && l.day_number && (
                          <span className="text-xs text-primary/70">W{l.week_number} D{l.day_number}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Instructor */}
      {course.instructor_name && (
        <section className="py-12">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="text-2xl md:text-3xl font-bold mb-6">Your Instructor</h2>
            <div className="glass-card p-6 flex flex-col sm:flex-row items-start gap-5">
              {course.instructor_photo_url ? (
                <img src={course.instructor_photo_url} alt={course.instructor_name} className="w-24 h-24 rounded-2xl object-cover shrink-0" />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <GraduationCap className="w-10 h-10 text-primary" />
                </div>
              )}
              <div>
                <h3 className="text-xl font-semibold mb-2">{course.instructor_name}</h3>
                {course.instructor_bio && (
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{course.instructor_bio}</p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Reviews */}
      <div className="bg-secondary/30">
        <CourseReviews courseId={courseId!} />
      </div>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-b from-transparent to-primary/5">
        <div className="container mx-auto px-4 max-w-2xl text-center">
          <Award className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Ready to start learning?</h2>
          <p className="text-muted-foreground mb-6">Join now and get full access to all lessons, assignments, and a certificate of completion.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            {courseAccess || canOpenFreeCourse ? (
              <Button variant="hero" size="lg" asChild>
                <Link to={`/courses/${courseId}`}>Go to Course <ArrowRight className="w-4 h-4 ml-1" /></Link>
              </Button>
            ) : !user ? (
              <Button variant="hero" size="lg" onClick={() => navigate("/login")}>
                Sign In to Enroll
              </Button>
            ) : !enrollment ? (
              <Button variant="hero" size="lg" onClick={() => enroll.mutate()} disabled={enroll.isPending}>
                {enroll.isPending ? "Enrolling…" : isFree ? "Enroll for Free" : "Enroll Now"}
              </Button>
            ) : isFree ? (
              <Button variant="hero" size="lg" asChild>
                <Link to={`/courses/${courseId}`}>Start Learning <ArrowRight className="w-4 h-4 ml-1" /></Link>
              </Button>
            ) : (
              <Button variant="hero" size="lg" onClick={handleBuy} disabled={payLoading}>
                <CreditCard className="w-4 h-4 mr-2" />
                {payLoading ? "Processing…" : `Pay ${priceFormatted}`}
              </Button>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default CourseAboutPage;
