import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, PlayCircle, FileText, CheckCircle, Lock, Image, ExternalLink, Download, Paperclip, Send, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const LessonViewerPage = () => {
  const { lessonId } = useParams();
  const { user, profile, isAdmin, hasCourseAccess, canAccessLesson, trialActive, trialDaysLeft } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [submissionText, setSubmissionText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: lesson } = useQuery({
    queryKey: ["lesson", lessonId],
    queryFn: async () => {
      const { data } = await supabase.from("lessons").select("*, modules(*, courses(*))").eq("id", lessonId!).single();
      return data;
    },
    enabled: !!lessonId,
  });

  const courseId = (lesson as any)?.modules?.course_id;
  const course = (lesson as any)?.modules?.courses;
  const currentModule = (lesson as any)?.modules;

// ✅ NEW (fixed)
const { data: allCourseLessons = [] } = useQuery({
  queryKey: ["all-course-lessons", courseId],
  queryFn: async () => {
    const { data: mods } = await supabase.from("modules").select("*").eq("course_id", courseId!).order("sort_order");
    if (!mods?.length) return [];
    const { data } = await supabase.from("lessons").select("*").in("module_id", mods.map((m: any) => m.id));
    if (!data) return [];
    // Build a map of module_id → its position in the sorted module list
    const moduleOrder = new Map(mods.map((m: any, i: number) => [m.id, m.sort_order ?? i]));
    // Sort: by module order first, then by lesson sort_order within each module
    return data.sort((a: any, b: any) => {
      const modDiff = (moduleOrder.get(a.module_id) ?? 0) - (moduleOrder.get(b.module_id) ?? 0);
      if (modDiff !== 0) return modDiff;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
  },
  enabled: !!courseId,
});

  const { data: modules = [] } = useQuery({
    queryKey: ["course-modules-viewer", courseId],
    queryFn: async () => {
      const { data } = await supabase.from("modules").select("*").eq("course_id", courseId!).order("sort_order");
      return data ?? [];
    },
    enabled: !!courseId,
  });

  const { data: allCompletions = [] } = useQuery({
    queryKey: ["all-completions", user?.id, courseId],
    queryFn: async () => {
      const ids = allCourseLessons.map((l: any) => l.id);
      if (!ids.length) return [];
      const { data } = await supabase.from("lesson_completions").select("lesson_id").eq("user_id", user!.id).in("lesson_id", ids);
      return data?.map((c: any) => c.lesson_id) ?? [];
    },
    enabled: !!user && allCourseLessons.length > 0,
  });

  // Fetch all submissions for this course's lessons to check assignment approval
  const { data: allSubmissions = [] } = useQuery({
    queryKey: ["all-submissions", user?.id, courseId],
    queryFn: async () => {
      const lessonIds = allCourseLessons.map((l: any) => l.id);
      if (!lessonIds.length) return [];
      const { data: assigns } = await supabase.from("assignments").select("id, lesson_id").in("lesson_id", lessonIds);
      if (!assigns?.length) return [];
      const { data } = await supabase.from("submissions").select("*, assignments(lesson_id)").eq("user_id", user!.id).in("assignment_id", assigns.map((a: any) => a.id));
      return data ?? [];
    },
    enabled: !!user && allCourseLessons.length > 0,
  });

  // All assignments for this course
  const { data: allAssignments = [] } = useQuery({
    queryKey: ["all-assignments", courseId],
    queryFn: async () => {
      const lessonIds = allCourseLessons.map((l: any) => l.id);
      if (!lessonIds.length) return [];
      const { data } = await supabase.from("assignments").select("*").in("lesson_id", lessonIds);
      return data ?? [];
    },
    enabled: allCourseLessons.length > 0,
  });

  const currentCompletion = allCompletions.includes(lessonId!);

  const { data: assignments = [] } = useQuery({
    queryKey: ["lesson-assignments", lessonId],
    queryFn: async () => {
      const { data } = await supabase.from("assignments").select("*").eq("lesson_id", lessonId!);
      return data ?? [];
    },
    enabled: !!lessonId,
  });

  // Existing submissions for this lesson's assignments
  const { data: mySubmissions = [] } = useQuery({
    queryKey: ["my-submissions", user?.id, lessonId],
    queryFn: async () => {
      const assignIds = assignments.map((a: any) => a.id);
      if (!assignIds.length) return [];
      const { data } = await supabase.from("submissions").select("*").eq("user_id", user!.id).in("assignment_id", assignIds);
      return data ?? [];
    },
    enabled: !!user && assignments.length > 0,
  });

  // Check if lesson's assignment is approved (for strict unlock)
  const isLessonAssignmentApproved = (lId: string) => {
    const lessonAssigns = allAssignments.filter((a: any) => a.lesson_id === lId);
    if (lessonAssigns.length === 0) return true; // no assignment = auto-approved
    return lessonAssigns.every((a: any) => {
      const sub = allSubmissions.find((s: any) => s.assignment_id === a.id);
      return sub && sub.status === "Approved";
    });
  };

  const markComplete = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lesson_completions").insert({ user_id: user!.id, lesson_id: lessonId! });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-completions"] });
      toast.success("Lesson marked as complete!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const submitAssignment = async (assignmentId: string) => {
    setSubmitting(true);
    const fileInput = document.getElementById("submission-file") as HTMLInputElement;
    let fileUrls: string[] = [];

    if (fileInput?.files?.length) {
      for (const file of Array.from(fileInput.files)) {
        const path = `${user!.id}/${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from("assignment-files").upload(path, file);
        if (error) { toast.error("Upload failed: " + error.message); setSubmitting(false); return; }
        const { data } = supabase.storage.from("assignment-files").getPublicUrl(path);
        if (data?.publicUrl) fileUrls.push(data.publicUrl);
      }
    }

    // Check if this is a resubmission (existing rejected submission)
    const existingSub = mySubmissions.find((s: any) => s.assignment_id === assignmentId && s.status === "Rejected");

    let insertedSub: any;
    if (existingSub) {
      // Update existing submission instead of inserting a new one
      const { data, error } = await supabase.from("submissions").update({
        text_submission: submissionText || null,
        file_url: fileUrls[0] || existingSub.file_url || null,
        submission_files: fileUrls.length > 0 ? fileUrls : existingSub.submission_files,
        status: "Pending",
        feedback: null,
      }).eq("id", existingSub.id).select().single();
      if (error) { toast.error(error.message); setSubmitting(false); return; }
      insertedSub = data;
    } else {
      const { data, error } = await supabase.from("submissions").insert({
        assignment_id: assignmentId,
        user_id: user!.id,
        text_submission: submissionText || null,
        file_url: fileUrls[0] || null,
        submission_files: fileUrls,
        status: "Pending",
      } as any).select().single();
      if (error) { toast.error(error.message); setSubmitting(false); return; }
      insertedSub = data;
    }


    // Call auto-evaluation edge function
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evaluate-assignment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ submission_id: (insertedSub as any).id }),
        }
      );
      const result = await resp.json();
      if (result.status === "Approved") {
        toast.success(result.feedback || "Assignment approved! ✅");
      } else if (result.status === "Rejected") {
        toast.error(result.feedback || "Assignment needs revision ❌");
      } else {
        toast.success("Assignment submitted! Awaiting review.");
      }
    } catch {
      toast.success("Assignment submitted!");
    }

    setSubmissionText("");
    setSubmitting(false);
    queryClient.invalidateQueries({ queryKey: ["my-submissions"] });
    queryClient.invalidateQueries({ queryKey: ["all-submissions"] });
    queryClient.invalidateQueries({ queryKey: ["all-completions"] });
  };

  // Determine access - STRICT: previous lesson's assignment must be approved
  const globalIndex = useMemo(() => {
    return allCourseLessons.findIndex((l: any) => l.id === lessonId);
  }, [allCourseLessons, lessonId]);

  const hasAccess = useMemo(() => {
    if (!courseId || !user) return false;
    if (isAdmin) return true;
    if (!hasCourseAccess(courseId)) return false;
    if (!canAccessLesson(courseId, globalIndex)) return false;
    if (globalIndex === 0) return true;
    const prevLesson = allCourseLessons[globalIndex - 1];
    if (!prevLesson) return false;
    // Previous lesson must be completed AND its assignment approved
    return allCompletions.includes(prevLesson.id) && isLessonAssignmentApproved(prevLesson.id);
  }, [courseId, user, isAdmin, hasCourseAccess, canAccessLesson, globalIndex, allCourseLessons, allCompletions, allAssignments, allSubmissions]);

  // Check if current lesson's assignments are all approved
  const currentAssignmentsApproved = isLessonAssignmentApproved(lessonId!);
  const hasAssignments = assignments.length > 0;

  // Can mark complete only if assignments approved (or no assignments)
  const canComplete = !currentCompletion && currentAssignmentsApproved;

  // Progress calculation
  const completedCount = allCompletions.length;
  const totalLessons = allCourseLessons.length;
  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  if (!lesson) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading...</div>;

  if (!hasAccess && !isAdmin) {
    const prevLesson = globalIndex > 0 ? allCourseLessons[globalIndex - 1] : null;
    const prevNotCompleted = prevLesson && !allCompletions.includes(prevLesson.id);
    const prevAssignmentPending = prevLesson && !isLessonAssignmentApproved(prevLesson.id);

    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="glass-card p-8 text-center max-w-md">
          <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Lesson Locked</h2>
          <p className="text-muted-foreground mb-4">
            {prevAssignmentPending
              ? "Complete and get your assignment approved to unlock this lesson."
              : prevNotCompleted
              ? "Complete the previous lesson first to unlock this one."
              : trialActive && globalIndex >= 7
              ? "This lesson is beyond the trial limit. Purchase the course for full access."
              : "Purchase this course or get Premium to access this lesson."}
          </p>
          <div className="flex flex-col gap-2">
            {courseId && <Button variant="hero" asChild><Link to={`/courses/${courseId}`}>Back to Course</Link></Button>}
            <Button variant="outline" asChild><Link to="/subscribe">Get Premium</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  const nextLesson = globalIndex >= 0 && globalIndex < allCourseLessons.length - 1 ? allCourseLessons[globalIndex + 1] : null;
  const canGoNext = currentCompletion && currentAssignmentsApproved && nextLesson;

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Main content */}
      <div className="flex-1 lg:w-3/4 overflow-auto">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border p-4 flex items-center gap-3">
          <Link to={courseId ? `/courses/${courseId}` : "/courses"} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold truncate">{lesson.title}</h1>
            <p className="text-xs text-muted-foreground truncate">{course?.title} · Lesson {globalIndex + 1} of {totalLessons}</p>
          </div>
          {currentCompletion && <Badge className="bg-success/10 text-success border-success/20 shrink-0">✓ Completed</Badge>}
        </div>

        {/* Video/Content area */}
        <div className="bg-card">
          {lesson.content_type === "video" && lesson.file_url ? (
            <div className="aspect-video">
              {lesson.file_url.includes("youtube.com") || lesson.file_url.includes("youtu.be") ? (
                <iframe
                  src={lesson.file_url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={lesson.title}
                />
              ) : (
                <video
                  controls
                  controlsList="nodownload"
                  className="w-full h-full"
                  src={lesson.file_url}
                  onContextMenu={(e) => e.preventDefault()}
                />
              )}
            </div>
          ) : lesson.content_type === "pdf" && lesson.file_url ? (
            <div className="aspect-video">
              <iframe src={lesson.file_url} className="w-full h-full" title={lesson.title} />
            </div>
          ) : lesson.content_type === "image" && lesson.file_url ? (
            <div className="flex items-center justify-center p-6">
              <img src={lesson.file_url} alt={lesson.title} className="max-w-full max-h-[70vh] rounded-lg object-contain" />
            </div>
          ) : lesson.content_type === "url" && lesson.file_url ? (
            <div className="p-6">
              <a href={lesson.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-primary hover:underline text-lg mb-4">
                <ExternalLink className="w-5 h-5" />
                Open External Resource
              </a>
              <iframe src={lesson.file_url} className="w-full h-[60vh] rounded-lg border border-border" title={lesson.title} />
            </div>
          ) : lesson.content_type === "video" ? (
            <div className="aspect-video flex items-center justify-center">
              <div className="text-center"><PlayCircle className="w-16 h-16 text-primary mx-auto mb-4 opacity-50" /><p className="text-muted-foreground">No video uploaded yet</p></div>
            </div>
          ) : null}
        </div>

        {/* Lesson text content */}
        <div className="p-6 max-w-3xl mx-auto">
          {lesson.content_text && (
            <div className="prose prose-invert max-w-none mb-8">
            <div
              className="text-muted-foreground leading-relaxed whitespace-pre-wrap [&_a]:text-primary [&_a]:underline [&_a]:hover:opacity-80"
              dangerouslySetInnerHTML={{
                __html: lesson.content_text
                  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                  .replace(/\n/g, '<br/>')
                  .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
              }}
            />
            </div>
          )}

          {/* Progress / Actions */}
          <div className="flex flex-wrap gap-3 mb-8">
            {canComplete && (
              <Button variant="hero" onClick={() => markComplete.mutate()}>
                <CheckCircle className="w-4 h-4 mr-1" />
                Mark as Complete
              </Button>
            )}
            {hasAssignments && !currentAssignmentsApproved && currentCompletion && (
              <div className="flex items-center gap-2 text-sm text-accent">
                <AlertCircle className="w-4 h-4" />
                Assignment approval required to unlock next lesson
              </div>
            )}
            {canGoNext && (
              <Button variant="hero" asChild>
                <Link to={`/lesson/${nextLesson.id}`}>Next Lesson →</Link>
              </Button>
            )}
          </div>

          {/* Assignments */}
          {assignments.length > 0 && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Paperclip className="w-5 h-5 text-primary" />
                Assignments
              </h3>
              {assignments.map((a: any) => {
                const existingSub = mySubmissions.find((s: any) => s.assignment_id === a.id);
                const subStatus = existingSub?.status;
                const canResubmit = subStatus === "Rejected";

                return (
                  <div key={a.id} className="glass-card p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold">{a.title}</h4>
                        {a.objective && <p className="text-sm text-muted-foreground mt-1"><strong>Objective:</strong> {a.objective}</p>}
                        {a.task && <p className="text-sm text-muted-foreground mt-1"><strong>Task:</strong> {a.task}</p>}
                        {a.deliverable && <p className="text-sm text-muted-foreground mt-1"><strong>Deliverable:</strong> {a.deliverable}</p>}
                        {a.description && <p className="text-sm text-muted-foreground mt-1">{a.description}</p>}
                      </div>
                      {subStatus && (
                        <Badge className={
                          subStatus === "Approved" ? "bg-success/10 text-success border-success/20" :
                          subStatus === "Rejected" ? "bg-destructive/10 text-destructive border-destructive/20" :
                          "bg-accent/10 text-accent border-accent/20"
                        }>{subStatus}</Badge>
                      )}
                    </div>

                    {/* Existing submission feedback */}
                    {existingSub?.feedback && (
                      <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
                        <p className="text-xs font-medium text-accent mb-1">Instructor Feedback</p>
                        <p className="text-sm">{existingSub.feedback}</p>
                      </div>
                    )}

                    {/* Submit form */}
                    {(!existingSub || canResubmit) && (
                      <div className="space-y-3 pt-2 border-t border-border">
                        <Textarea
                          placeholder="Write your submission..."
                          value={submissionText}
                          onChange={(e) => setSubmissionText(e.target.value)}
                          className="bg-secondary border-border text-sm min-h-[100px]"
                        />
                        <div className="space-y-1">
                          <Label className="text-xs">Attach files (optional)</Label>
                          <Input id="submission-file" type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt,.zip" className="bg-secondary border-border text-sm" />
                        </div>
                        <Button size="sm" variant="hero" onClick={() => submitAssignment(a.id)} disabled={submitting}>
                          <Send className="w-4 h-4 mr-1" />
                          {submitting ? "Submitting..." : canResubmit ? "Resubmit" : "Submit Assignment"}
                        </Button>
                      </div>
                    )}

                    {existingSub && !canResubmit && subStatus !== "Approved" && (
                      <p className="text-sm text-accent flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Your submission is under review
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar - hidden on mobile, shown below content on tablet, sticky on desktop */}
      <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-border bg-card/30 overflow-auto lg:max-h-screen lg:sticky lg:top-0">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-sm mb-2">{course?.title}</h3>
          <Progress value={progressPercent} className="h-1.5 bg-secondary mb-1" />
          <p className="text-xs text-muted-foreground">{completedCount}/{totalLessons} lessons · {progressPercent}%</p>
        </div>

        {modules.map((mod: any) => {
          const modLessons = allCourseLessons.filter((l: any) => l.module_id === mod.id);
          return (
            <div key={mod.id}>
              <div className="px-4 py-3 border-b border-border/50">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{mod.title}</p>
              </div>
              <div className="divide-y divide-border/30">
                {modLessons.map((l: any) => {
                  const idx = allCourseLessons.findIndex((al: any) => al.id === l.id);
                  const completed = allCompletions.includes(l.id);
                  const prevApproved = idx === 0 || (allCompletions.includes(allCourseLessons[idx - 1]?.id) && isLessonAssignmentApproved(allCourseLessons[idx - 1]?.id));
                  const accessible = isAdmin || (
                    hasCourseAccess(courseId) &&
                    canAccessLesson(courseId, idx) &&
                    prevApproved
                  );

                  return (
                    <div
                      key={l.id}
                      className={`flex items-center gap-3 px-4 py-3 text-sm transition-all duration-200 ${
                        l.id === lessonId ? "bg-primary/10 border-l-2 border-l-primary" :
                        accessible ? "hover:bg-secondary/50 cursor-pointer" : "opacity-40"
                      }`}
                      onClick={() => accessible && navigate(`/lesson/${l.id}`)}
                    >
                      {completed ? (
                        <CheckCircle className="w-4 h-4 text-success shrink-0" />
                      ) : accessible ? (
                        l.content_type === "video" ? <PlayCircle className={`w-4 h-4 shrink-0 ${l.id === lessonId ? "text-primary" : "text-muted-foreground"}`} />
                          : l.content_type === "pdf" ? <FileText className="w-4 h-4 text-accent shrink-0" />
                          : <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      ) : (
                        <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                      <span className={`flex-1 truncate ${l.id === lessonId ? "text-foreground font-medium" : "text-muted-foreground"}`}>{l.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LessonViewerPage;
