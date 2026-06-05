import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Cpu, FolderOpen, Upload, ArrowLeft } from "lucide-react";

const PortfolioPage = () => {
  const [courseFilter, setCourseFilter] = useState("all");

  const { data: projects = [] } = useQuery({
    queryKey: ["public-projects"],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("*, courses(title)")
        .eq("public_visibility", true)
        .eq("status", "Approved" as any)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["public-profiles-map"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      return data ?? [];
    },
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["public-courses-list"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, title").eq("is_published", true);
      return data ?? [];
    },
  });

  const getStudentName = (studentId: string) => {
    return profiles.find((p: any) => p.user_id === studentId)?.full_name || "Student";
  };

  const filtered = courseFilter === "all" ? projects : projects.filter((p: any) => p.course_id === courseFilter);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Cpu className="w-6 h-6 text-primary" />
            <span className="font-display font-bold">NEXUS AI ACADEMY</span>
          </Link>
          <div className="flex items-center gap-3">
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="w-48 bg-secondary border-border">
                <SelectValue placeholder="Filter by course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" asChild>
              <Link to="/"><ArrowLeft className="w-4 h-4 mr-1" /> Home</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3">Student Portfolio</h1>
          <p className="text-muted-foreground max-w-lg mx-auto">Explore projects built by NEXUS AI Academy students.</p>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No public projects yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((p: any) => (
              <div key={p.id} className="glass-card overflow-hidden hover:border-primary/30 transition-all">
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="secondary" className="text-xs">{(p as any).courses?.title ?? "Course"}</Badge>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{p.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-3">{p.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">By {getStudentName(p.student_id)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</p>
                  </div>
                  {p.project_files && (p.project_files as string[]).length > 0 && (
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {(p.project_files as string[]).map((url: string, i: number) => {
                        const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
                        const fileName = decodeURIComponent(url.split("/").pop()?.replace(/^\d+_/, "") || `File ${i + 1}`);
                        return isImage ? (
                          <a key={i} href={url} target="_blank" rel="noreferrer">
                            <img src={url} alt={fileName} className="w-20 h-20 object-cover rounded-lg border border-border hover:opacity-80 transition" />
                          </a>
                        ) : (
                          <a key={i} href={url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                            <Upload className="w-3 h-3" /> {fileName}
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default PortfolioPage;
