import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, PlayCircle, FileText, CheckCircle, Lock, ExternalLink, Paperclip, Send, AlertCircle, Upload, X, ImageIcon, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useState, useMemo, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import FileDropzone from "@/components/shared/FileDropzone";

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_FILES = 10;

const ALLOWED_MIME_PREFIXES = ["image/", "video/"];
const ALLOWED_MIME_EXACT = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream", // some browsers report zip as this
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);
const ALLOWED_EXT = /\.(jpg|jpeg|png|gif|webp|heic|heif|mp4|mov|webm|mkv|avi|m4v|pdf|zip|doc|docx|txt)$/i;

const isAllowedFile = (f: File) => {
  if (ALLOWED_MIME_PREFIXES.some((p) => f.type.startsWith(p))) return true;
  if (ALLOWED_MIME_EXACT.has(f.type)) return true;
  return ALLOWED_EXT.test(f.name);
};

const sanitizeFileName = (name: string): string => {
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  const base = name
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .substring(0, 40);
  const unique = Math.random().toString(36).substring(2, 10);
  return ext ? `${base}_${unique}.${ext}` : `${base}_${unique}`;
};

const LessonViewerPage = () => {
  const { lessonId } = useParams();
  const { user, isAdmin, profile, hasCourseAccess, canAccessLesson, trialActive } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [submissionText, setSubmissionText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File[]>>({});
  const [previewUrls, setPreviewUrls] = useState<Record<string, string[]>>({});
  const [justSubmitted, setJustSubmitted] = useState<string | null>(null); // assignment ID just submitted
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    return () => {
      Object.values(previewUrls).flat().forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const { data: allCourseLessons = [] } = useQuery({
    queryKey: ["all-course-lessons", courseId],
    queryFn: async () => {
      const { data: mods } = await supabase.from("modules").select("*").eq("course_id", courseId!).order("sort_order");
      if (!mods?.length) return [];
      const { data } = await supabase.from("lessons").select("*").in("module_id", mods.map((m: any) => m.id));
      if (!data) return [];
      const moduleOrder = new Map(mods.map((m: any, i: number) => [m.id, m.sort_order ?? i]));
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

  const { data: mySubmissions = [], refetch: refetchSubmissions } = useQuery({
    queryKey: ["my-submissions", user?.id, lessonId],
    queryFn: async () => {
      const assignIds = assignments.map((a: any) => a.id);
      if (!assignIds.length) return [];
      const { data } = await supabase.from("submissions").select("*").eq("user_id", user!.id).in("assignment_id", assignIds);
      return data ?? [];
    },
    enabled: !!user && assignments.length > 0,
  });

  const isLessonAssignmentApproved = (lId: string) => {
    const lessonAssigns = allAssignments.filter((a: any) => a.lesson_id === lId);
    if (lessonAssigns.length === 0) return true;
    return lessonAssigns.every((a: any) => {
      const sub = allSubmissions.find((s: any) => s.assignment_id === a.id);
      return sub && sub.status === "Approved";
    });
  };

  const completedCount = allCompletions.length;
  const totalLessons = allCourseLessons.length;
  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  const markComplete = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lesson_completions").insert({ user_id: user!.id, lesson_id: lessonId! });
      if (error) throw error;
      if (courseId) {
        const newProgress = totalLessons > 0 ? Math.round(((completedCount + 1) / totalLessons) * 100) : 0;
        await supabase.from("enrollments").update({ progress: newProgress }).eq("user_id", user!.id).eq("course_id", courseId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-completions"] });
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      toast.success("Lesson marked as complete! 🎉");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleFileChange = (assignmentId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files || []);
    const existing = selectedFiles[assignmentId] || [];

    const invalid = incoming.filter((f) => !isAllowedFile(f));
    if (invalid.length > 0) {
      toast.error(`Unsupported file type: ${invalid.map((f) => f.name).join(", ")}. Allowed: images, videos, PDF, ZIP, DOC.`);
      e.target.value = "";
      return;
    }
    const oversized = incoming.filter((f) => f.size > MAX_FILE_SIZE_BYTES);
    if (oversized.length > 0) {
      toast.error(`File too large: ${oversized.map((f) => f.name).join(", ")}. Max ${MAX_FILE_SIZE_MB}MB each.`);
      e.target.value = "";
      return;
    }
    const merged = [...existing, ...incoming];
    if (merged.length > MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} files per submission.`);
      e.target.value = "";
      return;
    }

    previewUrls[assignmentId]?.forEach((u) => URL.revokeObjectURL(u));
    const newPreviews = merged
      .filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"))
      .map((f) => URL.createObjectURL(f));
    setPreviewUrls((prev) => ({ ...prev, [assignmentId]: newPreviews }));
    setSelectedFiles((prev) => ({ ...prev, [assignmentId]: merged }));
    e.target.value = "";
  };

  const removeFile = (assignmentId: string, index: number) => {
    const updated = [...(selectedFiles[assignmentId] || [])];
    updated.splice(index, 1);
    if (updated.length === 0 && fileInputRefs.current[assignmentId]) {
      fileInputRefs.current[assignmentId]!.value = "";
    }
    previewUrls[assignmentId]?.forEach((u) => URL.revokeObjectURL(u));
    const newPreviews = updated
      .filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"))
      .map((f) => URL.createObjectURL(f));
    setSelectedFiles((prev) => ({ ...prev, [assignmentId]: updated }));
    setPreviewUrls((prev) => ({ ...prev, [assignmentId]: newPreviews }));
  };

  const submitAssignment = async (assignmentId: string) => {
    const filesToUpload = selectedFiles[assignmentId] || [];
    const text = submissionText.trim();
    if (!text && filesToUpload.length === 0) {
      toast.error("Please add a written response or attach at least one file before submitting.");
      return;
    }
    setSubmitting(true);
    setUploadProgress(0);
    let fileUrls: string[] = [];

    if (filesToUpload.length > 0) {
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const path = `${user!.id}/${Date.now()}_${sanitizeFileName(file.name)}`;
        const { error } = await supabase.storage.from("assignment-files").upload(path, file, { cacheControl: "3600", upsert: false });
        if (error) {
          toast.error(`Upload failed for "${file.name}": ${error.message}`);
          setSubmitting(false);
          setUploadProgress(0);
          return;
        }
        const { data: urlData } = supabase.storage.from("assignment-files").getPublicUrl(path);
        if (urlData?.publicUrl) fileUrls.push(urlData.publicUrl);
        setUploadProgress(Math.round(((i + 1) / filesToUpload.length) * 80));
      }
    }

    const existingSub = mySubmissions.find((s: any) => s.assignment_id === assignmentId && s.status === "Rejected");

    let insertedSub: any;
    if (existingSub) {
      const { data, error } = await supabase.from("submissions").update({
        text_submission: submissionText || null,
        file_url: fileUrls[0] || existingSub.file_url || null,
        submission_files: fileUrls.length > 0 ? fileUrls : existingSub.submission_files,
        status: "Pending",
        feedback: null,
      }).eq("id", existingSub.id).select().single();
      if (error) { toast.error(error.message); setSubmitting(false); setUploadProgress(0); return; }
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
      if (error) { toast.error(error.message); setSubmitting(false); setUploadProgress(0); return; }
      insertedSub = data;
    }

    setUploadProgress(90);

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
        toast.success("Assignment approved! 🎉 Check your Messages for details.");
      } else if (result.status === "Rejected") {
        toast.error("Assignment needs revision. Check your Messages for feedback.");
      } else {
        toast.success("Submitted! 🎉 Check your Messages — you have a new notification.");
      }
    } catch {
      toast.success("Submitted! 🎉 Check your Messages for updates.");
    }

    // Mark as just submitted to show success card
    setJustSubmitted(assignmentId);

    // Clear form
    setSubmissionText("");
    setSelectedFiles((prev) => ({ ...prev, [assignmentId]: [] }));
    previewUrls[assignmentId]?.forEach((u) => URL.revokeObjectURL(u));
    setPreviewUrls((prev) => ({ ...prev, [assignmentId]: [] }));
    if (fileInputRefs.current[assignmentId]) fileInputRefs.current[assignmentId]!.value = "";
    setSubmitting(false);
    setUploadProgress(0);

    queryClient.invalidateQueries({ queryKey: ["my-submissions"] });
    queryClient.invalidateQueries({ queryKey: ["all-submissions"] });
    queryClient.invalidateQueries({ queryKey: ["all-completions"] });
    refetchSubmissions();
  };

  const globalIndex = useMemo(() => allCourseLessons.findIndex((l: any) => l.id === lessonId), [allCourseLessons, lessonId]);

  const hasAccess = useMemo(() => {
    if (!courseId || !user) return false;
    if (isAdmin) return true;
    if (!hasCourseAccess(courseId)) return false;
    if (!canAccessLesson(courseId, globalIndex)) return false;
    if (trialActive && profile?.trial_course_id === courseId && globalIndex < 5) return true;
    if (globalIndex === 0) return true;
    const prevLesson = allCourseLessons[globalIndex - 1];
    if (!prevLesson) return false;
    return allCompletions.includes(prevLesson.id) && isLessonAssignmentApproved(prevLesson.id);
  }, [courseId, user, isAdmin, profile, trialActive, hasCourseAccess, canAccessLesson, globalIndex, allCourseLessons, allCompletions, allAssignments, allSubmissions]);

  const currentAssignmentsApproved = isLessonAssignmentApproved(lessonId!);
  const canComplete = !currentCompletion && currentAssignmentsApproved;

  if (!lesson) return (
    <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
      <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading...
    </div>
  );

  if (!hasAccess && !isAdmin) {
    const prevLesson = globalIndex > 0 ? allCourseLessons[globalIndex - 1] : null;
    const prevNotCompleted = prevLesson && !allCompletions.includes(prevLesson.id);
    const prevAssignmentPending = prevLesson && !isLessonAssignmentApproved(prevLesson.id);
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="glass-card p-8 text-center max-w-md w-full">
          <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Lesson Locked</h2>
          <p className="text-muted-foreground mb-4">
            {prevAssignmentPending ? "Complete and get your assignment approved to unlock this lesson."
              : prevNotCompleted ? "Complete the previous lesson first to unlock this one."
              : trialActive && globalIndex >= 7 ? "This lesson is beyond the trial limit. Purchase the course for full access."
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
      <div className="flex-1 lg:w-3/4 overflow-auto">

        {/* Header */}
        <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border p-4 flex items-center gap-3">
          <Link to={courseId ? `/courses/${courseId}` : "/courses"} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold truncate">{lesson.title}</h1>
            <p className="text-xs text-muted-foreground truncate">{course?.title} · Lesson {globalIndex + 1} of {totalLessons}</p>
          </div>
          {currentCompletion && <Badge className="bg-success/10 text-success border-success/20 shrink-0">✓ Done</Badge>}
        </div>

        {/* Content area */}
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
                <video controls controlsList="nodownload" className="w-full h-full" src={lesson.file_url} onContextMenu={(e) => e.preventDefault()} />
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
                <ExternalLink className="w-5 h-5" /> Open External Resource
              </a>
              <iframe src={lesson.file_url} className="w-full h-[60vh] rounded-lg border border-border" title={lesson.title} />
            </div>
          ) : lesson.content_type === "video" ? (
            <div className="aspect-video flex items-center justify-center">
              <div className="text-center">
                <PlayCircle className="w-16 h-16 text-primary mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">No video uploaded yet</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Lesson text */}
        <div className="p-4 sm:p-6 max-w-3xl mx-auto">
          {lesson.content_text && (
            <div className="prose prose-invert max-w-none mb-8">
              <div
                className="text-muted-foreground leading-relaxed whitespace-pre-wrap [&_a]:text-primary [&_a]:underline [&_a]:hover:opacity-80"
dangerouslySetInnerHTML={{
                  __html: (() => {
                    // FIX: sanitize URL before injecting into href to prevent XSS
                    const sanitizeUrl = (url: string) => {
                      try {
                        const u = new URL(url);
                        if (!["http:", "https:"].includes(u.protocol)) return "#";
                        return u.toString().replace(/"/g, "%22").replace(/'/g, "%27");
                      } catch { return "#"; }
                    };
                    return lesson.content_text
                      .replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;")
                      .replace(/\n/g, "<br/>")
                      .replace(/(https?:\/\/[^\s<]+)/g, (_, url) =>
                        `<a href="${sanitizeUrl(url)}" target="_blank" rel="noopener noreferrer">${url.replace(/&/g, "&amp;")}</a>`
                      );
                  })()
                }}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 mb-8">
            {canComplete && (
              <Button variant="hero" onClick={() => markComplete.mutate()} disabled={markComplete.isPending} className="w-full sm:w-auto">
                <CheckCircle className="w-4 h-4 mr-1" />
                {markComplete.isPending ? "Saving..." : "Mark as Complete"}
              </Button>
            )}
            {assignments.length > 0 && !currentAssignmentsApproved && currentCompletion && (
              <div className="flex items-center gap-2 text-sm text-accent">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Assignment approval required to unlock next lesson
              </div>
            )}
            {canGoNext && (
              <Button variant="hero" asChild className="w-full sm:w-auto">
                <Link to={`/lesson/${nextLesson.id}`}>Next Lesson →</Link>
              </Button>
            )}
          </div>

          {/* Assignments */}
          {assignments.length > 0 && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Paperclip className="w-5 h-5 text-primary" /> Assignments
              </h3>

              {assignments.map((a: any) => {
                const existingSub = mySubmissions.find((s: any) => s.assignment_id === a.id);
                const subStatus = existingSub?.status;
                const canResubmit = subStatus === "Rejected";
                const assignFiles = selectedFiles[a.id] || [];
                const assignPreviews = previewUrls[a.id] || [];
                const isJustSubmitted = justSubmitted === a.id;

                return (
                  <div key={a.id} className="glass-card p-4 sm:p-5 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold">{a.title}</h4>
                        {a.objective && <p className="text-sm text-muted-foreground mt-1"><strong>Objective:</strong> {a.objective}</p>}
                        {a.task && <p className="text-sm text-muted-foreground mt-1"><strong>Task:</strong> {a.task}</p>}
                        {a.deliverable && <p className="text-sm text-muted-foreground mt-1"><strong>Deliverable:</strong> {a.deliverable}</p>}
                        {a.description && <p className="text-sm text-muted-foreground mt-1">{a.description}</p>}
                        {Array.isArray(a.attachment_files) && a.attachment_files.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="text-xs text-muted-foreground">Attachments:</span>
                            {a.attachment_files.map((url: string, i: number) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
                                File {i + 1}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      {subStatus && (
                        <Badge className={
                          subStatus === "Approved" ? "bg-success/10 text-success border-success/20 shrink-0" :
                          subStatus === "Rejected" ? "bg-destructive/10 text-destructive border-destructive/20 shrink-0" :
                          "bg-accent/10 text-accent border-accent/20 shrink-0"
                        }>{subStatus}</Badge>
                      )}
                    </div>

                    {existingSub?.feedback && (
                      <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
                        <p className="text-xs font-medium text-accent mb-1">Instructor Feedback</p>
                        <p className="text-sm whitespace-pre-wrap">{existingSub.feedback}</p>
                      </div>
                    )}

                    {/* ✅ Submission success card — shown immediately after submitting */}
                    {isJustSubmitted && (
                      <div className="p-4 rounded-xl bg-success/10 border border-success/30 space-y-2">
                        <p className="text-sm font-semibold text-success flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" /> Assignment submitted successfully! 🎉
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Your submission has been received. You'll get a notification in your Messages — check there for feedback and approval status.
                        </p>
                        <Link
                          to="/dashboard/messages"
                          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                        >
                          <MessageCircle className="w-3 h-3" /> Go to Messages →
                        </Link>
                      </div>
                    )}

                    {(!existingSub || canResubmit) && !isJustSubmitted && (
                      <div className="space-y-4 pt-2 border-t border-border">
                        <Textarea
                          placeholder="Write your submission here..."
                          value={submissionText}
                          onChange={(e) => setSubmissionText(e.target.value)}
                          className="bg-secondary border-border text-sm min-h-[120px] text-base"
                        />

                        <div className="space-y-3">
                          <Label className="text-xs text-muted-foreground">
                            Add a written response or attach files (max {MAX_FILES} files, {MAX_FILE_SIZE_MB}MB each). At least one is required.
                          </Label>
                          <FileDropzone
                            files={assignFiles}
                            onChange={(next) => setSelectedFiles((prev) => ({ ...prev, [a.id]: next }))}
                            maxFiles={MAX_FILES}
                            maxSizeMB={MAX_FILE_SIZE_MB}
                            disabled={submitting}
                          />
                        </div>

                        {submitting && uploadProgress > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Uploading...</span><span>{uploadProgress}%</span>
                            </div>
                            <Progress value={uploadProgress} className="h-1.5 bg-secondary" />
                          </div>
                        )}

                        <Button
                          size="lg"
                          variant="hero"
                          onClick={() => submitAssignment(a.id)}
                          disabled={submitting}
                          className="w-full sm:w-auto touch-manipulation"
                        >
                          {submitting
                            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{uploadProgress > 0 ? `Uploading ${uploadProgress}%...` : "Submitting..."}</>
                            : <><Send className="w-4 h-4 mr-2" />{canResubmit ? "Resubmit Assignment" : "Submit Assignment"}</>}
                        </Button>
                      </div>
                    )}

                    {existingSub && !canResubmit && subStatus !== "Approved" && !isJustSubmitted && (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-accent flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" /> Under review — check Messages for updates
                        </p>
                        <Link to="/dashboard/messages" className="text-xs text-primary hover:underline flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" /> Messages
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
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
                  const trialPreviewAccess = trialActive && profile?.trial_course_id === courseId && idx < 5;
                  const prevApproved = idx === 0 || (allCompletions.includes(allCourseLessons[idx - 1]?.id) && isLessonAssignmentApproved(allCourseLessons[idx - 1]?.id));
                  const accessible = isAdmin || (hasCourseAccess(courseId) && canAccessLesson(courseId, idx) && (trialPreviewAccess || prevApproved));
                  return (
                    <div
                      key={l.id}
                      className={`flex items-center gap-3 px-4 py-3 text-sm transition-all duration-200 ${
                        l.id === lessonId ? "bg-primary/10 border-l-2 border-l-primary" :
                        accessible ? "hover:bg-secondary/50 cursor-pointer" : "opacity-40"
                      }`}
                      onClick={() => accessible && navigate(`/lesson/${l.id}`)}
                    >
                      {completed
                        ? <CheckCircle className="w-4 h-4 text-success shrink-0" />
                        : accessible
                          ? l.content_type === "video"
                            ? <PlayCircle className={`w-4 h-4 shrink-0 ${l.id === lessonId ? "text-primary" : "text-muted-foreground"}`} />
                            : <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                          : <Lock className="w-4 h-4 text-muted-foreground shrink-0" />}
                      <span className={`flex-1 truncate ${l.id === lessonId ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                        {l.title}
                      </span>
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
