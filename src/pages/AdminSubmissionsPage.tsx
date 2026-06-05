import { useState } from "react";
import AdminSidebar from "@/components/dashboard/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, XCircle, MessageSquare, Upload } from "lucide-react";

const AdminSubmissionsPage = () => {
  const queryClient = useQueryClient();
  const [feedbackFor, setFeedbackFor] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  const { data: submissions = [] } = useQuery({
    queryKey: ["admin-submissions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("submissions")
        .select("*, assignments(title, lesson_id, lessons:lesson_id(title, modules:module_id(title, courses:course_id(title))))")
        .order("submitted_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles-sub-map"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      return data ?? [];
    },
  });

  const getStudentName = (userId: string) => profiles.find((p: any) => p.user_id === userId)?.full_name || "Student";

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, feedbackText }: { id: string; status: string; feedbackText?: string }) => {
      const update: any = { status };
      if (feedbackText !== undefined) update.feedback = feedbackText;
      const { error } = await supabase.from("submissions").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-submissions"] });
      toast.success("Submission updated!");
      setFeedbackFor(null);
      setFeedback("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusColor = (s: string) => {
    if (s === "Approved") return "bg-success/10 text-success border-success/20";
    if (s === "Pending") return "bg-accent/10 text-accent border-accent/20";
    if (s === "Rejected") return "bg-destructive/10 text-destructive border-destructive/20";
    return "bg-secondary text-muted-foreground";
  };

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold mb-1">Assignment Submissions</h1>
          <p className="text-muted-foreground mb-8">{submissions.length} total submissions · {submissions.filter((s: any) => s.status === "Pending").length} pending</p>

          <div className="space-y-4">
            {submissions.map((s: any) => {
              const assignInfo = (s as any).assignments;
              const lessonTitle = assignInfo?.lessons?.title ?? "";
              const courseTitle = assignInfo?.lessons?.modules?.courses?.title ?? "";

              return (
                <div key={s.id} className="glass-card p-5">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-sm">{assignInfo?.title ?? "Assignment"}</h3>
                        <Badge className={statusColor(s.status)}>{s.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Student: {getStudentName(s.user_id)} · {courseTitle && `${courseTitle} · `}{lessonTitle}
                      </p>
                      {s.text_submission && <p className="text-sm mt-2 bg-secondary/50 p-3 rounded-lg">{s.text_submission}</p>}
                      {s.file_url && (
                        <div className="mt-2">
                          {/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(s.file_url) ? (
                            <a href={s.file_url} target="_blank" rel="noreferrer">
                              <img src={s.file_url} alt="Submission" className="max-w-[200px] max-h-[150px] rounded-lg border border-border object-cover" />
                            </a>
                          ) : (
                            <a href={s.file_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                              <Upload className="w-3 h-3" /> View File
                            </a>
                          )}
                        </div>
                      )}
                      {s.submission_files && (s.submission_files as string[]).length > 0 && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {(s.submission_files as string[]).map((url: string, i: number) => (
                            /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url) ? (
                              <a key={i} href={url} target="_blank" rel="noreferrer">
                                <img src={url} alt={`File ${i + 1}`} className="max-w-[120px] max-h-[90px] rounded-lg border border-border object-cover" />
                              </a>
                            ) : (
                              <a key={i} href={url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                                <Upload className="w-3 h-3" /> File {i + 1}
                              </a>
                            )
                          ))}
                        </div>
                      )}
                      {s.feedback && (
                        <div className="mt-2 p-2 rounded-lg bg-accent/5 border border-accent/20">
                          <p className="text-xs text-accent font-medium">Feedback: {s.feedback}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => updateStatus.mutate({ id: s.id, status: "Approved" })} disabled={s.status === "Approved"}>
                        <CheckCircle className="w-4 h-4 mr-1 text-success" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => updateStatus.mutate({ id: s.id, status: "Rejected" })} disabled={s.status === "Rejected"}>
                        <XCircle className="w-4 h-4 mr-1 text-destructive" /> Reject
                      </Button>
                      <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setFeedbackFor(s.id); setFeedback(s.feedback || ""); }}>
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {feedbackFor === s.id && (
                    <div className="mt-4 space-y-2">
                      <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Write feedback..." className="bg-secondary border-border" />
                      <div className="flex gap-2">
                        <Button size="sm" variant="hero" onClick={() => updateStatus.mutate({ id: s.id, status: s.status, feedbackText: feedback })}>Save Feedback</Button>
                        <Button size="sm" variant="ghost" onClick={() => setFeedbackFor(null)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-3">{new Date(s.submitted_at).toLocaleDateString()}</p>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminSubmissionsPage;
