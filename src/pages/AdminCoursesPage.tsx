import { useState, useRef } from "react";
import AdminSidebar from "@/components/dashboard/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus, Trash2, Edit, ChevronDown, ChevronRight, Save, Paperclip,
  Video, FileText, Image as ImageIcon, Link as LinkIcon, BookOpen, Upload, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

const CATEGORIES = ["AI", "Graphic Design", "Data Analysis", "Programming", "Web Development", "Machine Learning"];

const CONTENT_TYPES = [
  { value: "video",  label: "Video",      icon: Video,     color: "text-primary",     bg: "bg-primary/10",     accept: "video/*",  hint: "MP4, MOV, AVI — or paste a YouTube/Vimeo URL below" },
  { value: "pdf",    label: "PDF",        icon: FileText,  color: "text-accent",      bg: "bg-accent/10",      accept: ".pdf",     hint: "Upload a PDF document" },
  { value: "image",  label: "Image",      icon: ImageIcon, color: "text-success",     bg: "bg-success/10",     accept: "image/*",  hint: "JPG, PNG, GIF, WebP" },
  { value: "text",   label: "Notes/Text", icon: BookOpen,  color: "text-orange-400",  bg: "bg-orange-400/10",  accept: "",         hint: "Text notes — no file needed, write content below" },
  { value: "url",    label: "External Link", icon: LinkIcon, color: "text-purple-400", bg: "bg-purple-400/10", accept: "",         hint: "Link to an external resource or embed" },
];

const ContentTypeButton = ({ type, selected, onClick }: { type: typeof CONTENT_TYPES[0]; selected: boolean; onClick: () => void }) => {
  const Icon = type.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border-2 text-xs font-medium transition-all duration-150 touch-manipulation ${
        selected
          ? `border-current ${type.color} ${type.bg}`
          : "border-border text-muted-foreground hover:border-border/80 hover:bg-secondary/50"
      }`}
    >
      <Icon className="w-4 h-4" />
      {type.label}
    </button>
  );
};

const isYouTubeUrl = (url: string) =>
  url.includes("youtube.com") || url.includes("youtu.be");

const EMPTY_COURSE_FORM = {
  title: "", description: "", category: "AI", is_published: false, price: 0, approval_mode: "manual",
  long_description: "", what_you_achieve: "", who_is_for: "",
  instructor_name: "", instructor_bio: "", instructor_photo_url: "",
  trailer_video_url: "", trailer_video_type: "url",
};
const EMPTY_LESSON_FORM = { title: "", content_type: "video", content_text: "", content_url: "", module_id: "", week_number: "", day_number: "" };

const AdminCoursesPage = () => {
  const queryClient = useQueryClient();
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [courseForm, setCourseForm] = useState({
    title: "", description: "", category: "AI", is_published: false, price: 0, approval_mode: "manual",
    long_description: "", what_you_achieve: "", who_is_for: "",
    instructor_name: "", instructor_bio: "", instructor_photo_url: "",
    trailer_video_url: "", trailer_video_type: "url",
  });
  const [moduleForm, setModuleForm] = useState({ title: "", course_id: "" });
  const [showModuleForm, setShowModuleForm] = useState<string | null>(null);
  const [lessonForm, setLessonForm] = useState({ title: "", content_type: "video", content_text: "", content_url: "", module_id: "", week_number: "", day_number: "" });
  const [showLessonForm, setShowLessonForm] = useState<string | null>(null);
  const [editingLesson, setEditingLesson] = useState<any>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [editFileName, setEditFileName] = useState("");
  const [uploadingTrailer, setUploadingTrailer] = useState(false);
  const [showAssignmentForm, setShowAssignmentForm] = useState<string | null>(null);
  const [assignForm, setAssignForm] = useState<{ title: string; description: string; objective: string; task: string; deliverable: string; lesson_id: string; attachment_files: string[] }>({ title: "", description: "", objective: "", task: "", deliverable: "", lesson_id: "", attachment_files: [] });
  const [uploadingAssignFiles, setUploadingAssignFiles] = useState(false);

  // Per-form refs so there are no shared IDs
  const createFileRef = useRef<HTMLInputElement>(null);
  const editFileRef = useRef<HTMLInputElement>(null);

  const { data: courses = [] } = useQuery({
    queryKey: ["admin-courses-full"],
    queryFn: async () => { const { data } = await supabase.from("courses").select("*").order("created_at", { ascending: false }); return data ?? []; },
  });

  const { data: modules = [] } = useQuery({
    queryKey: ["admin-modules"],
    queryFn: async () => { const { data } = await supabase.from("modules").select("*").order("sort_order"); return data ?? []; },
  });

  const { data: lessons = [] } = useQuery({
    queryKey: ["admin-lessons"],
    queryFn: async () => { const { data } = await supabase.from("lessons").select("*").order("sort_order"); return data ?? []; },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["admin-assignments"],
    queryFn: async () => { const { data } = await supabase.from("assignments").select("*"); return data ?? []; },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-courses-full"] });
    queryClient.invalidateQueries({ queryKey: ["admin-modules"] });
    queryClient.invalidateQueries({ queryKey: ["admin-lessons"] });
    queryClient.invalidateQueries({ queryKey: ["admin-assignments"] });
  };

  // Build course DB payload from form (convert textarea → JSON arrays)
  const buildCoursePayload = () => {
    const toLines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
    return {
      title: courseForm.title,
      description: courseForm.description || null,
      category: courseForm.category,
      is_published: courseForm.is_published,
      price: courseForm.price || 0,
      approval_mode: courseForm.approval_mode,
      long_description: courseForm.long_description || null,
      what_you_achieve: toLines(courseForm.what_you_achieve),
      who_is_for: toLines(courseForm.who_is_for),
      instructor_name: courseForm.instructor_name || null,
      instructor_bio: courseForm.instructor_bio || null,
      instructor_photo_url: courseForm.instructor_photo_url || null,
      trailer_video_url: courseForm.trailer_video_url || null,
      trailer_video_type: courseForm.trailer_video_type,
    } as any;
  };

  // ── Course mutations ──────────────────────────────────────────────
  const createCourse = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("courses").insert(buildCoursePayload());
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success("Course created!"); setShowCourseForm(false); setCourseForm(EMPTY_COURSE_FORM); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateCourse = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("courses").update(buildCoursePayload()).eq("id", editingCourse.id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success("Course updated!"); setEditingCourse(null); setCourseForm(EMPTY_COURSE_FORM); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteCourse = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("courses").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { invalidateAll(); toast.success("Course deleted!"); },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Module mutations ──────────────────────────────────────────────
  const createModule = useMutation({
    mutationFn: async () => {
      const courseModules = modules.filter((m: any) => m.course_id === moduleForm.course_id);
      const { error } = await supabase.from("modules").insert({ ...moduleForm, sort_order: courseModules.length });
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success("Module created!"); setShowModuleForm(null); setModuleForm({ title: "", course_id: "" }); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteModule = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("modules").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { invalidateAll(); toast.success("Module deleted!"); },
    onError: (e: any) => toast.error(e.message),
  });

  // ── File upload ───────────────────────────────────────────────────
  const handleFileUpload = async (file: File, contentType: string): Promise<string | null> => {
    setUploadingFile(true);
    setUploadProgress(10);
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const folder = contentType === "video" ? "videos" : contentType === "pdf" ? "pdfs" : contentType === "image" ? "images" : "files";
    const path = `lessons/${folder}/${Date.now()}_${safeFileName}`;

    const { error } = await supabase.storage.from("course-content").upload(path, file, { cacheControl: "3600", upsert: false });
    setUploadProgress(80);
    if (error) {
      toast.error("Upload failed: " + error.message);
      setUploadingFile(false);
      setUploadProgress(0);
      return null;
    }
    const { data } = supabase.storage.from("course-content").getPublicUrl(path);
    setUploadProgress(100);
    setTimeout(() => { setUploadingFile(false); setUploadProgress(0); }, 600);
    return data?.publicUrl || null;
  };

  // ── Lesson mutations ──────────────────────────────────────────────
  const createLesson = useMutation({
    mutationFn: async (fileUrl?: string) => {
      const moduleLessons = lessons.filter((l: any) => l.module_id === lessonForm.module_id);
      const finalUrl = fileUrl || lessonForm.content_url || null;
      const { error } = await supabase.from("lessons").insert({
        title: lessonForm.title,
        content_type: lessonForm.content_type,
        content_text: lessonForm.content_text || null,
        file_url: finalUrl,
        module_id: lessonForm.module_id,
        sort_order: moduleLessons.length,
        week_number: lessonForm.week_number ? parseInt(lessonForm.week_number) : null,
        day_number: lessonForm.day_number ? parseInt(lessonForm.day_number) : null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Lesson created!");
      setShowLessonForm(null);
      setLessonForm(EMPTY_LESSON_FORM);
      setSelectedFileName("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateLesson = useMutation({
    mutationFn: async ({ id, fileUrl }: { id: string; fileUrl?: string }) => {
      const updateData: any = {
        title: lessonForm.title,
        content_type: lessonForm.content_type,
        content_text: lessonForm.content_text || null,
        week_number: lessonForm.week_number ? parseInt(lessonForm.week_number) : null,
        day_number: lessonForm.day_number ? parseInt(lessonForm.day_number) : null,
      };
      if (fileUrl) updateData.file_url = fileUrl;
      else if (lessonForm.content_url) updateData.file_url = lessonForm.content_url;
      const { error } = await supabase.from("lessons").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Lesson updated!");
      setEditingLesson(null);
      setLessonForm(EMPTY_LESSON_FORM);
      setEditFileName("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteLesson = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("lessons").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { invalidateAll(); toast.success("Lesson deleted!"); },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Assignment mutations ──────────────────────────────────────────
  const createAssignment = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("assignments").insert({
        lesson_id: assignForm.lesson_id,
        title: assignForm.title,
        description: assignForm.description || null,
        objective: assignForm.objective || null,
        task: assignForm.task || null,
        deliverable: assignForm.deliverable || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Assignment created!");
      setShowAssignmentForm(null);
      setAssignForm({ title: "", description: "", objective: "", task: "", deliverable: "", lesson_id: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteAssignment = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("assignments").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { invalidateAll(); toast.success("Assignment deleted!"); },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Handlers ──────────────────────────────────────────────────────
  const handleCreateLesson = async () => {
    let fileUrl: string | undefined;
    const needsFile = ["video", "pdf", "image"].includes(lessonForm.content_type);
    if (needsFile && createFileRef.current?.files?.[0]) {
      const url = await handleFileUpload(createFileRef.current.files[0], lessonForm.content_type);
      if (!url) return; // upload failed — stop
      fileUrl = url;
    }
    createLesson.mutate(fileUrl);
  };

  const handleUpdateLesson = async () => {
    let fileUrl: string | undefined;
    const needsFile = ["video", "pdf", "image"].includes(lessonForm.content_type);
    if (needsFile && editFileRef.current?.files?.[0]) {
      const url = await handleFileUpload(editFileRef.current.files[0], lessonForm.content_type);
      if (!url) return;
      fileUrl = url;
    }
    updateLesson.mutate({ id: editingLesson.id, fileUrl });
  };

  const startEditCourse = (course: any) => {
    setEditingCourse(course);
    const wya = Array.isArray(course.what_you_achieve) ? course.what_you_achieve.join("\n") : "";
    const wif = Array.isArray(course.who_is_for) ? course.who_is_for.join("\n") : "";
    setCourseForm({
      title: course.title, description: course.description || "", category: course.category,
      is_published: course.is_published, price: course.price || 0,
      approval_mode: course.approval_mode || "manual",
      long_description: course.long_description || "",
      what_you_achieve: wya, who_is_for: wif,
      instructor_name: course.instructor_name || "",
      instructor_bio: course.instructor_bio || "",
      instructor_photo_url: course.instructor_photo_url || "",
      trailer_video_url: course.trailer_video_url || "",
      trailer_video_type: course.trailer_video_type || "url",
    });
  };

  const startEditLesson = (lesson: any) => {
    setEditingLesson(lesson);
    setLessonForm({
      title: lesson.title, content_type: lesson.content_type,
      content_text: lesson.content_text || "", content_url: lesson.file_url || "",
      module_id: lesson.module_id,
      week_number: lesson.week_number ? String(lesson.week_number) : "",
      day_number: lesson.day_number ? String(lesson.day_number) : "",
    });
    setEditFileName("");
  };

  const getTypeInfo = (val: string) => CONTENT_TYPES.find((t) => t.value === val) || CONTENT_TYPES[0];

  const needsFileUpload = (t: string) => ["video", "pdf", "image"].includes(t);
  const needsUrlField = (t: string) => ["url", "video"].includes(t); // video can also be a URL (YouTube)

  // ── Shared lesson form body (used both for create and edit) ───────
  const renderLessonFormBody = (isEdit: boolean) => {
    const typeInfo = getTypeInfo(lessonForm.content_type);
    const fileRef = isEdit ? editFileRef : createFileRef;
    const fileNameState = isEdit ? editFileName : selectedFileName;
    const setFileNameState = isEdit ? setEditFileName : setSelectedFileName;

    return (
      <div className="space-y-4">
        {/* Title */}
        <div className="space-y-1.5">
          <Label className="text-xs">Lesson Title *</Label>
          <Input
            placeholder="e.g. Introduction to Prompt Engineering"
            value={lessonForm.title}
            onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
            className="bg-secondary border-border"
          />
        </div>

        {/* Week & Day */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Week #</Label>
            <Input
              type="number" min="1" placeholder="1"
              value={lessonForm.week_number}
              onChange={(e) => setLessonForm({ ...lessonForm, week_number: e.target.value })}
              className="bg-secondary border-border"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Day #</Label>
            <Input
              type="number" min="1" max="7" placeholder="1"
              value={lessonForm.day_number}
              onChange={(e) => setLessonForm({ ...lessonForm, day_number: e.target.value })}
              className="bg-secondary border-border"
            />
          </div>
        </div>


        <div className="space-y-1.5">
          <Label className="text-xs">Content Type *</Label>
          <div className="flex flex-wrap gap-2">
            {CONTENT_TYPES.map((t) => (
              <ContentTypeButton
                key={t.value}
                type={t}
                selected={lessonForm.content_type === t.value}
                onClick={() => {
                  setLessonForm({ ...lessonForm, content_type: t.value });
                  setFileNameState("");
                  if (fileRef.current) fileRef.current.value = "";
                }}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{typeInfo.hint}</p>
        </div>

        {/* File upload — video, pdf, image */}
        {needsFileUpload(lessonForm.content_type) && (
          <div className="space-y-2">
            <Label className="text-xs">
              {isEdit ? "Replace file (optional)" : "Upload file"}
            </Label>
            <input
              ref={fileRef}
              type="file"
              accept={typeInfo.accept}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setFileNameState(f ? f.name : "");
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-secondary/50 hover:bg-secondary transition-all text-sm touch-manipulation"
            >
              <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground truncate">
                {fileNameState || `Tap to select ${typeInfo.label.toLowerCase()} file`}
              </span>
              {fileNameState && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFileNameState(""); if (fileRef.current) fileRef.current.value = ""; }}
                  className="ml-auto shrink-0 p-1 hover:bg-destructive/20 rounded text-muted-foreground hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </button>
            {isEdit && lessonForm.content_url && !fileNameState && (
              <p className="text-xs text-muted-foreground">
                Current: <a href={lessonForm.content_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">View existing file</a>
              </p>
            )}
          </div>
        )}

        {/* URL field — YouTube/external URL */}
        {needsUrlField(lessonForm.content_type) && (
          <div className="space-y-1.5">
            <Label className="text-xs">
              {lessonForm.content_type === "video" ? "Or paste YouTube / Vimeo URL" : "External URL *"}
            </Label>
            <Input
              placeholder={lessonForm.content_type === "video" ? "https://youtube.com/watch?v=..." : "https://..."}
              value={lessonForm.content_url}
              onChange={(e) => setLessonForm({ ...lessonForm, content_url: e.target.value })}
              className="bg-secondary border-border"
            />
            {lessonForm.content_type === "video" && lessonForm.content_url && isYouTubeUrl(lessonForm.content_url) && (
              <p className="text-xs text-success flex items-center gap-1">✓ YouTube URL detected — will embed automatically</p>
            )}
          </div>
        )}

        {/* Text content / notes */}
        <div className="space-y-1.5">
          <Label className="text-xs">
            {lessonForm.content_type === "text" ? "Lesson Notes / Content *" : "Supplementary notes (shown below media, optional)"}
          </Label>
          <Textarea
            placeholder={
              lessonForm.content_type === "text"
                ? "Write your lesson notes here..."
                : "Add written explanations, key points, or references..."
            }
            value={lessonForm.content_text}
            onChange={(e) => setLessonForm({ ...lessonForm, content_text: e.target.value })}
            className="bg-secondary border-border"
            rows={lessonForm.content_type === "text" ? 8 : 4}
          />
        </div>

        {/* Upload progress */}
        {uploadingFile && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Uploading...</span><span>{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-1.5 bg-secondary" />
          </div>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">Manage Courses</h1>
              <p className="text-muted-foreground">Create and manage course content, modules, lessons &amp; assignments.</p>
            </div>
            <Button variant="hero" onClick={() => { setShowCourseForm(true); setEditingCourse(null); setCourseForm(EMPTY_COURSE_FORM); }}>
              <Plus className="w-4 h-4 mr-1" /> New Course
            </Button>
          </div>

          {/* ── Course Form ── */}
          {(showCourseForm || editingCourse) && (
            <div className="glass-card p-6 mb-8">
              <h3 className="font-semibold mb-4">{editingCourse ? "Edit Course" : "New Course"}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} className="bg-secondary border-border" />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={courseForm.category} onValueChange={(v) => setCourseForm({ ...courseForm, category: v })}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Description</Label>
                  <Textarea value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} className="bg-secondary border-border" />
                </div>
                <div className="space-y-2">
                  <Label>Price (KES)</Label>
                  <Input type="number" min="0" value={courseForm.price} onChange={(e) => setCourseForm({ ...courseForm, price: parseInt(e.target.value) || 0 })} className="bg-secondary border-border" />
                </div>
                <div className="space-y-2">
                  <Label>Assignment Approval Mode</Label>
                  <Select value={courseForm.approval_mode} onValueChange={(v) => setCourseForm({ ...courseForm, approval_mode: v })}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual (Admin reviews)</SelectItem>
                      <SelectItem value="auto_basic">Auto Basic (Instant approve)</SelectItem>
                      <SelectItem value="auto_smart">Auto Smart (AI evaluation)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="published" checked={courseForm.is_published} onChange={(e) => setCourseForm({ ...courseForm, is_published: e.target.checked })} />
                  <Label htmlFor="published">Published</Label>
                </div>
              </div>

              {/* ── Landing page content ── */}
              <div className="mt-6 pt-6 border-t border-border space-y-4">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" /> Landing Page Content
                  <span className="text-xs font-normal text-muted-foreground">(shown on /courses/:id/about)</span>
                </h4>

                <div className="space-y-2">
                  <Label>Long Description</Label>
                  <Textarea
                    placeholder="Tell students more about this course — context, depth, projects, value…"
                    rows={5}
                    value={courseForm.long_description}
                    onChange={(e) => setCourseForm({ ...courseForm, long_description: e.target.value })}
                    className="bg-secondary border-border"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>What You'll Achieve <span className="text-xs text-muted-foreground">(one per line)</span></Label>
                    <Textarea
                      placeholder={"Build production-ready AI apps\nMaster prompt engineering\nDeploy your first chatbot"}
                      rows={5}
                      value={courseForm.what_you_achieve}
                      onChange={(e) => setCourseForm({ ...courseForm, what_you_achieve: e.target.value })}
                      className="bg-secondary border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Who This Is For <span className="text-xs text-muted-foreground">(one per line)</span></Label>
                    <Textarea
                      placeholder={"Developers exploring AI\nProduct managers\nStudents in tech"}
                      rows={5}
                      value={courseForm.who_is_for}
                      onChange={(e) => setCourseForm({ ...courseForm, who_is_for: e.target.value })}
                      className="bg-secondary border-border"
                    />
                  </div>
                </div>

                {/* Trailer */}
                <div className="space-y-2">
                  <Label>Trailer Video</Label>
                  <Input
                    placeholder="Paste YouTube / Vimeo / direct video URL"
                    value={courseForm.trailer_video_url}
                    onChange={(e) => setCourseForm({ ...courseForm, trailer_video_url: e.target.value, trailer_video_type: "url" })}
                    className="bg-secondary border-border"
                  />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <span>or upload an MP4 file:</span>
                    <input
                      type="file"
                      accept="video/*"
                      id="trailer-upload"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setUploadingTrailer(true);
                        const url = await handleFileUpload(f, "video");
                        setUploadingTrailer(false);
                        if (url) {
                          setCourseForm({ ...courseForm, trailer_video_url: url, trailer_video_type: "upload" });
                          toast.success("Trailer uploaded!");
                        }
                      }}
                    />
                    <Button type="button" size="sm" variant="outline" onClick={() => document.getElementById("trailer-upload")?.click()} disabled={uploadingTrailer}>
                      <Upload className="w-3 h-3 mr-1" />
                      {uploadingTrailer ? "Uploading…" : "Upload trailer"}
                    </Button>
                    {courseForm.trailer_video_url && <span className="text-success">✓ Trailer set</span>}
                  </div>
                </div>

                {/* Instructor */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Instructor Name</Label>
                    <Input
                      placeholder="e.g. Jane Mwangi"
                      value={courseForm.instructor_name}
                      onChange={(e) => setCourseForm({ ...courseForm, instructor_name: e.target.value })}
                      className="bg-secondary border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Instructor Photo</Label>
                    <Input
                      placeholder="Paste image URL or upload below"
                      value={courseForm.instructor_photo_url}
                      onChange={(e) => setCourseForm({ ...courseForm, instructor_photo_url: e.target.value })}
                      className="bg-secondary border-border"
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="file"
                        accept="image/*"
                        id="instructor-photo-upload"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const url = await handleFileUpload(f, "image");
                          if (url) {
                            setCourseForm({ ...courseForm, instructor_photo_url: url });
                            toast.success("Instructor photo uploaded!");
                          }
                        }}
                      />
                      <Button type="button" size="sm" variant="outline" onClick={() => document.getElementById("instructor-photo-upload")?.click()} disabled={uploadingFile}>
                        <Upload className="w-3 h-3 mr-1" />
                        {uploadingFile ? "Uploading…" : "Upload photo"}
                      </Button>
                      {courseForm.instructor_photo_url && (
                        <img src={courseForm.instructor_photo_url} alt="Instructor" className="w-10 h-10 rounded-full object-cover border border-border" />
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Instructor Bio</Label>
                    <Textarea
                      placeholder="Short instructor introduction, credentials, experience…"
                      rows={3}
                      value={courseForm.instructor_bio}
                      onChange={(e) => setCourseForm({ ...courseForm, instructor_bio: e.target.value })}
                      className="bg-secondary border-border"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <Button variant="hero" onClick={() => editingCourse ? updateCourse.mutate() : createCourse.mutate()}>
                  {editingCourse ? "Update Course" : "Create Course"}
                </Button>
                <Button variant="ghost" onClick={() => { setShowCourseForm(false); setEditingCourse(null); }}>Cancel</Button>
              </div>
            </div>
          )}

          {/* ── Edit Lesson Inline Panel ── */}
          {editingLesson && (
            <div className="glass-card p-6 mb-8 border-primary/30">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Edit className="w-4 h-4 text-primary" /> Edit Lesson: {editingLesson.title}
              </h3>
              {renderLessonFormBody(true)}
              <div className="flex gap-2 mt-4">
                <Button variant="hero" onClick={handleUpdateLesson} disabled={uploadingFile || !lessonForm.title}>
                  <Save className="w-4 h-4 mr-1" /> {uploadingFile ? "Uploading..." : "Save Changes"}
                </Button>
                <Button variant="ghost" onClick={() => { setEditingLesson(null); setEditFileName(""); }}>Cancel</Button>
              </div>
            </div>
          )}

          {/* ── Course List ── */}
          <div className="space-y-4">
            {courses.map((course: any) => {
              const courseModules = modules.filter((m: any) => m.course_id === course.id);
              const isExpanded = expandedCourse === course.id;

              return (
                <div key={course.id} className="glass-card overflow-hidden">
                  <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setExpandedCourse(isExpanded ? null : course.id)}>
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <div>
                        <h3 className="font-semibold">{course.title}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="secondary" className="text-xs">{course.category}</Badge>
                          <Badge className={course.is_published ? "bg-success/10 text-success border-success/20" : "bg-secondary text-muted-foreground"}>
                            {course.is_published ? "Published" : "Draft"}
                          </Badge>
                          <Badge variant="outline" className="text-xs">KES {(course.price || 0).toLocaleString()}</Badge>
                          <Badge variant="outline" className="text-xs capitalize">{((course as any).approval_mode || "manual").replace("_", " ")}</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" onClick={() => startEditCourse(course)}><Edit className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteCourse.mutate(course.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border p-4 space-y-3">
                      {courseModules.map((mod: any) => {
                        const modLessons = lessons.filter((l: any) => l.module_id === mod.id);
                        const isModExpanded = expandedModule === mod.id;

                        return (
                          <div key={mod.id} className="bg-secondary/50 rounded-lg overflow-hidden">
                            <div className="p-3 flex items-center justify-between cursor-pointer" onClick={() => setExpandedModule(isModExpanded ? null : mod.id)}>
                              <div className="flex items-center gap-2">
                                {isModExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                <span className="text-sm font-medium">{mod.title}</span>
                                <span className="text-xs text-muted-foreground">({modLessons.length} lesson{modLessons.length !== 1 ? "s" : ""})</span>
                              </div>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); deleteModule.mutate(mod.id); }}>
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </Button>
                            </div>

                            {isModExpanded && (
                              <div className="px-3 pb-3 space-y-2">
                                {modLessons.map((lesson: any) => {
                                  const lessonAssigns = assignments.filter((a: any) => a.lesson_id === lesson.id);
                                  const typeInfo = getTypeInfo(lesson.content_type);
                                  const TypeIcon = typeInfo.icon;
                                  return (
                                    <div key={lesson.id} className="bg-background/50 rounded-lg p-3 space-y-2">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                          <div className={`w-6 h-6 rounded-md ${typeInfo.bg} flex items-center justify-center shrink-0`}>
                                            <TypeIcon className={`w-3.5 h-3.5 ${typeInfo.color}`} />
                                          </div>
                                          <span className="text-sm truncate">{lesson.title}</span>
                                          {(lesson.week_number || lesson.day_number) && (
                                            <Badge variant="outline" className="text-[10px] shrink-0">
                                              W{lesson.week_number || "?"} D{lesson.day_number || "?"}
                                            </Badge>
                                          )}
                                          {lesson.file_url && (
                                            <a href={lesson.file_url} target="_blank" rel="noreferrer" className="text-primary hover:underline shrink-0 text-xs">View</a>
                                          )}
                                        </div>
                                        <div className="flex gap-1 shrink-0">
                                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEditLesson(lesson)}>
                                            <Edit className="w-3 h-3" />
                                          </Button>
                                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteLesson.mutate(lesson.id)}>
                                            <Trash2 className="w-3 h-3 text-destructive" />
                                          </Button>
                                        </div>
                                      </div>

                                      {/* Assignments */}
                                      {lessonAssigns.length > 0 && (
                                        <div className="pl-4 space-y-1">
                                          {lessonAssigns.map((a: any) => (
                                            <div key={a.id} className="flex items-center justify-between text-xs">
                                              <span className="flex items-center gap-1 text-muted-foreground">
                                                <Paperclip className="w-3 h-3" /> {a.title}
                                              </span>
                                              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => deleteAssignment.mutate(a.id)}>
                                                <Trash2 className="w-2.5 h-2.5 text-destructive" />
                                              </Button>
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {/* Add Assignment */}
                                      {showAssignmentForm === lesson.id ? (
                                        <div className="pl-4 space-y-2 pt-2 border-t border-border/30">
                                          <Input placeholder="Assignment title *" value={assignForm.title} onChange={(e) => setAssignForm({ ...assignForm, title: e.target.value, lesson_id: lesson.id })} className="bg-secondary border-border text-xs h-8" />
                                          <Input placeholder="Objective" value={assignForm.objective} onChange={(e) => setAssignForm({ ...assignForm, objective: e.target.value })} className="bg-secondary border-border text-xs h-8" />
                                          <Input placeholder="Task" value={assignForm.task} onChange={(e) => setAssignForm({ ...assignForm, task: e.target.value })} className="bg-secondary border-border text-xs h-8" />
                                          <Input placeholder="Deliverable" value={assignForm.deliverable} onChange={(e) => setAssignForm({ ...assignForm, deliverable: e.target.value })} className="bg-secondary border-border text-xs h-8" />
                                          <Textarea placeholder="Description" value={assignForm.description} onChange={(e) => setAssignForm({ ...assignForm, description: e.target.value })} className="bg-secondary border-border text-xs" rows={2} />
                                          <div className="flex gap-2">
                                            <Button size="sm" variant="hero" onClick={() => createAssignment.mutate()} disabled={!assignForm.title} className="text-xs h-7">Add</Button>
                                            <Button size="sm" variant="ghost" onClick={() => setShowAssignmentForm(null)} className="text-xs h-7">Cancel</Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <Button size="sm" variant="ghost" className="text-xs h-6 pl-4" onClick={() => { setShowAssignmentForm(lesson.id); setAssignForm({ title: "", description: "", objective: "", task: "", deliverable: "", lesson_id: lesson.id }); }}>
                                          <Paperclip className="w-3 h-3 mr-1" /> Add Assignment
                                        </Button>
                                      )}
                                    </div>
                                  );
                                })}

                                {/* Add Lesson */}
                                {showLessonForm === mod.id ? (
                                  <div className="bg-background/50 rounded-lg p-4 space-y-1">
                                    <h4 className="text-sm font-medium mb-3">New Lesson</h4>
                                    {renderLessonFormBody(false)}
                                    <div className="flex gap-2 pt-2">
                                      <Button
                                        size="sm" variant="hero"
                                        onClick={() => { setLessonForm({ ...lessonForm, module_id: mod.id }); handleCreateLesson(); }}
                                        disabled={uploadingFile || !lessonForm.title}
                                      >
                                        {uploadingFile ? "Uploading..." : "Add Lesson"}
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => { setShowLessonForm(null); setSelectedFileName(""); }}>Cancel</Button>
                                    </div>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm" variant="ghost" className="text-xs"
                                    onClick={() => {
                                      setShowLessonForm(mod.id);
                                      setLessonForm({ ...EMPTY_LESSON_FORM, module_id: mod.id });
                                      setSelectedFileName("");
                                    }}
                                  >
                                    <Plus className="w-3 h-3 mr-1" /> Add Lesson
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Add Module */}
                      {showModuleForm === course.id ? (
                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <Input placeholder="Module title" value={moduleForm.title} onChange={(e) => setModuleForm({ title: e.target.value, course_id: course.id })} className="bg-secondary border-border text-sm" />
                          </div>
                          <Button size="sm" variant="hero" onClick={() => createModule.mutate()} disabled={!moduleForm.title}>Add</Button>
                          <Button size="sm" variant="ghost" onClick={() => setShowModuleForm(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setShowModuleForm(course.id); setModuleForm({ title: "", course_id: course.id }); }}>
                          <Plus className="w-3 h-3 mr-1" /> Add Module
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {courses.length === 0 && (
              <div className="glass-card p-12 text-center">
                <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No courses yet. Create your first course to get started.</p>
                <Button variant="hero" onClick={() => setShowCourseForm(true)}><Plus className="w-4 h-4 mr-1" /> Create First Course</Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminCoursesPage;
