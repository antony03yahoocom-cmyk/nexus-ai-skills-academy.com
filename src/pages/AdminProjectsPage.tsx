import { useState } from "react";
import AdminSidebar from "@/components/dashboard/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, XCircle, MessageSquare, Upload } from "lucide-react";

const AdminProjectsPage = () => {
  const queryClient = useQueryClient();
  const [feedbackFor, setFeedbackFor] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  const { data: projects = [] } = useQuery({
    queryKey: ["admin-projects"],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("*, courses(title)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles-map"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      return data ?? [];
    },
  });

  const getStudentName = (studentId: string) => {
    return profiles.find((p: any) => p.user_id === studentId)?.full_name || "Student";
  };

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("projects").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
      toast.success("Project status updated!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const submitFeedback = useMutation({
    mutationFn: async ({ id, feedback }: { id: string; feedback: string }) => {
      const { error } = await supabase.from("projects").update({ admin_feedback: feedback }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
      toast.success("Feedback saved!");
      setFeedbackFor(null);
      setFeedback("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusColor = (s: string) => {
    if (s === "Approved") return "bg-success/10 text-success border-success/20";
    if (s === "Submitted") return "bg-accent/10 text-accent border-accent/20";
    if (s === "Rejected") return "bg-destructive/10 text-destructive border-destructive/20";
    return "bg-secondary text-muted-foreground";
  };

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold mb-1">Student Projects</h1>
          <p className="text-muted-foreground mb-8">{projects.length} total projects</p>

          <div className="space-y-4">
            {projects.map((p: any) => (
              <div key={p.id} className="glass-card p-5">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{p.title}</h3>
                      <Badge className={statusColor(p.status)}>{p.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">By: {getStudentName(p.student_id)} · Course: {(p as any).courses?.title ?? "—"}</p>
                    {p.description && <p className="text-sm mt-2">{p.description}</p>}
                    {p.project_files && (p.project_files as string[]).length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {(p.project_files as string[]).map((url: string, i: number) => {
                          const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url.split("?")[0]);
                          const fileName = decodeURIComponent((url.split("?")[0]).split("/").pop()?.replace(/^\d+_/, "") || `File ${i + 1}`);
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
                    {p.admin_feedback && (
                      <div className="mt-2 p-2 rounded bg-accent/5 border border-accent/20">
                        <p className="text-xs text-accent font-medium">Feedback: {p.admin_feedback}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: p.id, status: "Approved" })} disabled={p.status === "Approved"}>
                      <CheckCircle className="w-4 h-4 mr-1 text-success" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: p.id, status: "Rejected" })} disabled={p.status === "Rejected"}>
                      <XCircle className="w-4 h-4 mr-1 text-destructive" /> Reject
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setFeedbackFor(p.id); setFeedback(p.admin_feedback || ""); }}>
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {feedbackFor === p.id && (
                  <div className="mt-4 space-y-2">
                    <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Write feedback..." className="bg-secondary border-border" />
                    <div className="flex gap-2">
                      <Button size="sm" variant="hero" onClick={() => submitFeedback.mutate({ id: p.id, feedback })}>Save Feedback</Button>
                      <Button size="sm" variant="ghost" onClick={() => setFeedbackFor(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-3">{new Date(p.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminProjectsPage;
