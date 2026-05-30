import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Cpu, FolderOpen, Upload, ArrowLeft, Heart, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const PortfolioPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [courseFilter, setCourseFilter] = useState("all");
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState<Record<string, string>>({});

  const { data: projects = [] } = useQuery({
    queryKey: ["public-projects"],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("*, courses(title)")
        .eq("public_visibility", true)
        .eq("status", "Approved" as any)
        .order("created_at", { ascending: false }).limit(60);
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["public-profiles-map"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, avatar_url").limit(250);
      return data ?? [];
    },
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["public-courses-list"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, title").eq("is_published", true).limit(100);
      return data ?? [];
    },
  });

  const projectIds = projects.map((p: any) => p.id);

  const { data: likes = [] } = useQuery({
    queryKey: ["project-likes", projectIds],
    queryFn: async () => {
      if (projectIds.length === 0) return [];
      const { data } = await supabase.from("project_likes").select("project_id, user_id").in("project_id", projectIds);
      return data ?? [];
    },
    enabled: projectIds.length > 0,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["project-comments", projectIds],
    queryFn: async () => {
      if (projectIds.length === 0) return [];
      const { data } = await supabase.from("project_comments").select("*").in("project_id", projectIds).order("created_at", { ascending: true }).limit(500);
      return data ?? [];
    },
    enabled: projectIds.length > 0,
  });

  const getStudent = (id: string) => profiles.find((p: any) => p.user_id === id);

  const toggleLike = useMutation({
    mutationFn: async (projectId: string) => {
      if (!user) { toast.error("Sign in to like projects"); return; }
      const existing = likes.find((l: any) => l.project_id === projectId && l.user_id === user.id);
      if (existing) {
        await supabase.from("project_likes").delete().eq("project_id", projectId).eq("user_id", user.id);
      } else {
        await supabase.from("project_likes").insert({ project_id: projectId, user_id: user.id });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-likes"] }),
  });

  const addComment = useMutation({
    mutationFn: async ({ projectId, content }: { projectId: string; content: string }) => {
      if (!user) throw new Error("Sign in to comment");
      const { error } = await supabase.from("project_comments").insert({ project_id: projectId, user_id: user.id, content });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      setCommentInput((p) => ({ ...p, [vars.projectId]: "" }));
      queryClient.invalidateQueries({ queryKey: ["project-comments"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = courseFilter === "all" ? projects : projects.filter((p: any) => p.course_id === courseFilter);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3 flex-wrap">
          <Link to="/" className="flex items-center gap-2">
            <Cpu className="w-6 h-6 text-primary" />
            <span className="font-display font-bold">NEXUS AI ACADEMY</span>
          </Link>
          <div className="flex items-center gap-3">
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="w-44 bg-secondary border-border"><SelectValue placeholder="Filter" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" asChild>
              <Link to={user ? "/dashboard" : "/"}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3">Student Portfolio</h1>
          <p className="text-muted-foreground max-w-lg mx-auto">Explore approved projects from NEXUS AI Academy students. Like and leave feedback!</p>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No public projects yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((p: any) => {
              const projectLikes = likes.filter((l: any) => l.project_id === p.id);
              const liked = !!user && projectLikes.some((l: any) => l.user_id === user.id);
              const projectComments = comments.filter((c: any) => c.project_id === p.id);
              const owner = getStudent(p.student_id);

              return (
                <div key={p.id} className="glass-card overflow-hidden hover:border-primary/30 transition-all flex flex-col">
                  <div className="p-5 flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="secondary" className="text-xs">{p.courses?.title ?? "Course"}</Badge>
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{p.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-3">{p.description}</p>

                    {p.project_files && (p.project_files as string[]).length > 0 && (
                      <div className="flex gap-2 mt-3 flex-wrap">
                        {(p.project_files as string[]).map((url: string, i: number) => {
                          const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url.split("?")[0]);
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

                    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                      <p>By {owner?.full_name || "Student"}</p>
                      <p>{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</p>
                    </div>
                  </div>

                  <div className="px-5 pb-3 border-t border-border/50 pt-3 flex items-center gap-4">
                    <button
                      onClick={() => toggleLike.mutate(p.id)}
                      className={`flex items-center gap-1.5 text-sm transition-colors ${liked ? "text-destructive" : "text-muted-foreground hover:text-destructive"}`}
                      disabled={!user}
                    >
                      <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} />
                      {projectLikes.length}
                    </button>
                    <button
                      onClick={() => setOpenComments(openComments === p.id ? null : p.id)}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      {projectComments.length}
                    </button>
                  </div>

                  {openComments === p.id && (
                    <div className="px-5 pb-5 border-t border-border/50 pt-3 space-y-3 max-h-72 overflow-y-auto">
                      {projectComments.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No comments yet. Be the first!</p>}
                      {projectComments.map((c: any) => {
                        const author = getStudent(c.user_id);
                        return (
                          <div key={c.id} className="flex gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                              {author?.full_name?.[0]?.toUpperCase() || "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium">{author?.full_name || "Student"}</p>
                              <p className="text-sm break-words">{c.content}</p>
                              <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</p>
                            </div>
                          </div>
                        );
                      })}
                      {user && (
                        <div className="flex gap-2 pt-2">
                          <Input
                            value={commentInput[p.id] || ""}
                            onChange={(e) => setCommentInput((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            placeholder="Write a comment..."
                            className="bg-secondary border-border h-8 text-sm"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && commentInput[p.id]?.trim()) {
                                addComment.mutate({ projectId: p.id, content: commentInput[p.id].trim() });
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            variant="hero"
                            onClick={() => commentInput[p.id]?.trim() && addComment.mutate({ projectId: p.id, content: commentInput[p.id].trim() })}
                            disabled={!commentInput[p.id]?.trim()}
                          >
                            <Send className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default PortfolioPage;
