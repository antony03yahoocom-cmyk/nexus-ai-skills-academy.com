import { ArrowRight, Sparkles, Users, BookOpen, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Format helpers for social proof stats ──────────────────────────
const formatStudents = (n: number) => {
  if (n >= 1000) return `${(Math.floor(n / 1000) * 1000).toLocaleString()}+`;
  if (n >= 100) return `${Math.floor(n / 100) * 100}+`;
  if (n >= 10) return `${Math.floor(n / 10) * 10}+`;
  return `${n}`;
};

const formatCourses = (n: number) => (n >= 5 ? `${Math.floor(n / 5) * 5}+` : `${n}`);

const HeroSection = () => {
  const { user } = useAuth();

  // ── Live platform stats for social proof (real data from Supabase) ──
  const { data: stats } = useQuery({
    queryKey: ["landing-social-proof-stats"],
    queryFn: async () => {
      const [studentsRes, coursesRes, reviewsRes] = await Promise.all([
        supabase.from("profiles_public").select("*", { count: "exact", head: true }),
        supabase.from("courses").select("*", { count: "exact", head: true }).eq("is_published", true),
        supabase.from("course_reviews").select("rating"),
      ]);

      const reviews = reviewsRes.data ?? [];
      const avgRating = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
        : null;

      return {
        students: studentsRes.count ?? 0,
        courses: coursesRes.count ?? 0,
        avgRating,
      };
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const socialProof = [
    { icon: Users, value: stats ? formatStudents(stats.students) : "—", label: "Students Trained" },
    { icon: BookOpen, value: stats ? formatCourses(stats.courses) : "—", label: "Courses" },
    { icon: Star, value: stats?.avgRating ? `${stats.avgRating.toFixed(1)}★` : "New", label: "Student Rating" },
  ];

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 mesh-gradient" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

      {/* Floating orbs */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-primary/10 blur-[100px] animate-pulse-glow" />
      <div className="absolute bottom-1/3 right-1/4 w-96 h-96 rounded-full bg-accent/10 blur-[120px] animate-pulse-glow" style={{ animationDelay: "1.5s" }} />
      <div className="absolute top-1/2 right-1/3 w-64 h-64 rounded-full bg-success/5 blur-[80px] animate-pulse-glow" style={{ animationDelay: "3s" }} />

      <div className="relative z-10 container mx-auto px-4 text-center max-w-4xl">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 mb-8">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-primary">AI-Powered Learning Platform</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
          Master AI, Tech &{" "}
          <span className="gradient-text">Digital Skills</span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
          Learn in-demand AI and digital skills, build real projects, earn certificates, and unlock new career opportunities.
        </p>

        {/* Social proof */}
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 sm:gap-x-12 mb-10">
          {socialProof.map((stat) => (
            <div key={stat.label} className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <stat.icon className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-lg sm:text-xl font-bold leading-tight">{stat.value}</p>
                <p className="text-xs text-muted-foreground whitespace-nowrap">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button variant="hero" size="lg" asChild>
            <Link to={user ? "/dashboard" : "/signup"}>
              {user ? "Start Learning" : "Join Now"}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
          <Button variant="hero-outline" size="lg" asChild>
            <Link to="/courses">Browse Courses</Link>
          </Button>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          7-day free trial · No credit card required
        </p>
      </div>
    </section>
  );
};

export default HeroSection;
