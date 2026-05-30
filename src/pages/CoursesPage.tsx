import { Link } from "react-router-dom";
import { BookOpen, ArrowRight, Sparkles, Star } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useCourseRatings } from "@/hooks/useCourseRatings";

const CoursesPage = () => {
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("*").eq("is_published", true).order("created_at", { ascending: false }).limit(60);
      return data ?? [];
    },
  });

  const { data: moduleCounts = {} } = useQuery({
    queryKey: ["module-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("modules").select("course_id").limit(500);
      const counts: Record<string, number> = {};
      data?.forEach((m: any) => { counts[m.course_id] = (counts[m.course_id] || 0) + 1; });
      return counts;
    },
  });

  const { data: ratings = {} } = useCourseRatings();

  const categoryEmojis: Record<string, string> = {
    "AI": "🤖", "Graphic Design": "🎨", "Data Analysis": "📊",
    "Programming": "🐍", "Web Development": "🌐", "Machine Learning": "🧠",
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20 sm:pt-24 pb-12 sm:pb-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8 sm:mb-12">
            <Badge variant="secondary" className="mb-3"><Sparkles className="w-3 h-3 mr-1" /> Premium courses</Badge>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4">All <span className="gradient-text">Courses</span></h1>
            <p className="text-muted-foreground text-sm sm:text-base md:text-lg max-w-xl mx-auto px-2">
              Premium courses designed to take you from beginner to expert.
            </p>
          </div>

          {isLoading ? (
            <div className="text-center text-muted-foreground py-12">Loading courses…</div>
          ) : courses.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">No courses available yet. Check back soon!</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-6xl mx-auto">
              {courses.map((course: any) => {
                const isFree = course.price === 0;
                return (
                  <div key={course.id} className="glass-card overflow-hidden group hover:border-primary/30 transition-all duration-300 flex flex-col">
                    <Link to={`/courses/${course.id}/about`} className="block">
                      {course.image_url ? (
                        <img src={course.image_url} alt={course.title} className="h-40 sm:h-44 w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="h-40 sm:h-44 bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center text-5xl sm:text-6xl">
                          {categoryEmojis[course.category] || "📚"}
                        </div>
                      )}
                    </Link>
                    <div className="p-4 sm:p-5 flex-1 flex flex-col">
                      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                        <Badge variant="secondary" className="text-[10px] sm:text-xs">{course.category}</Badge>
                        {isFree && <Badge className="bg-success/15 text-success border-success/30 text-[10px]">Free</Badge>}
                      </div>
                      <Link to={`/courses/${course.id}/about`}>
                        <h3 className="font-semibold text-base sm:text-lg mb-2 group-hover:text-primary transition-colors line-clamp-2">
                          {course.title}
                        </h3>
                      </Link>
                      {course.description && (
                        <p className="text-xs sm:text-sm text-muted-foreground mb-3 line-clamp-2 flex-1">{course.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5" /> {moduleCounts[course.id] || 0} modules
                        </span>
                        {ratings[course.id] && (
                          <span className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 fill-primary text-primary" />
                            {ratings[course.id].avg.toFixed(1)}
                            <span className="text-muted-foreground/70">({ratings[course.id].count})</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/50">
                        <span className="text-base sm:text-lg font-bold gradient-text">
                          {isFree ? "Free" : `KES ${Number(course.price).toLocaleString()}`}
                        </span>
                        <Link
                          to={`/courses/${course.id}/about`}
                          className="text-xs sm:text-sm text-primary hover:underline flex items-center gap-1 font-medium"
                        >
                          View Details <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CoursesPage;
