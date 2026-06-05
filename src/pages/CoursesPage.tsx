import { Link } from "react-router-dom";
import { Clock, Users, Star } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const CoursesPage = () => {
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("*").eq("is_published", true).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: moduleCounts = {} } = useQuery({
    queryKey: ["module-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("modules").select("course_id");
      const counts: Record<string, number> = {};
      data?.forEach((m: any) => { counts[m.course_id] = (counts[m.course_id] || 0) + 1; });
      return counts;
    },
  });

  const categoryEmojis: Record<string, string> = {
    "AI": "🤖", "Graphic Design": "🎨", "Data Analysis": "📊",
    "Programming": "🐍", "Web Development": "🌐", "Machine Learning": "🧠",
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">All <span className="gradient-text">Courses</span></h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">Premium courses designed to take you from beginner to expert.</p>
          </div>

          {isLoading ? (
            <div className="text-center text-muted-foreground">Loading courses...</div>
          ) : courses.length === 0 ? (
            <div className="text-center text-muted-foreground">No courses available yet. Check back soon!</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {courses.map((course: any) => (
                <Link key={course.id} to={`/courses/${course.id}`} className="glass-card overflow-hidden group hover:border-primary/30 transition-all duration-300">
                  <div className="h-40 bg-secondary flex items-center justify-center text-5xl">
                    {categoryEmojis[course.category] || "📚"}
                  </div>
                  <div className="p-6">
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">{course.category}</span>
                    <h3 className="font-semibold text-foreground mt-3 mb-2 group-hover:text-primary transition-colors">{course.title}</h3>
                    <p className="text-lg font-bold text-primary mb-3">
                      {course.price ? `KES ${course.price.toLocaleString()}` : "Free"}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{moduleCounts[course.id] || 0} modules</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CoursesPage;
