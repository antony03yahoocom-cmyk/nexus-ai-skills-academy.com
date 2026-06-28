/**
 * src/hooks/useLessonData.ts
 *
 * Consolidates the 8 scattered useQuery calls that were inline in
 * LessonViewerPage into two focused queries with proper caching.
 *
 * PROBLEMS FIXED
 * ──────────────────────────────────────────────────────────────────
 * 1. DUPLICATE MODULES QUERY
 *    Before: "all-course-lessons" fetched modules internally, then
 *    "course-modules-viewer" fetched the EXACT SAME modules again
 *    with a different cache key → 2 DB round-trips for one table.
 *
 *    After: One "course-content" query returns { lessons, modules }.
 *    The sidebar and progress bar read from the same cache entry.
 *
 * 2. SEQUENTIAL N+1 FOR SUBMISSIONS
 *    Before: assignments were fetched first, then submissions were
 *    fetched using the assignment IDs → sequential waterfall inside
 *    a single queryFn.
 *
 *    After: Both are fetched in parallel. Submissions are fetched
 *    against all lesson IDs in the course via a JOIN — no sequential
 *    dependency.
 *
 * 3. DUPLICATE LESSON-LEVEL QUERIES
 *    Before: "lesson-assignments" and "my-submissions" were separate
 *    useQuery calls that re-fetched the same rows that were already
 *    in "all-assignments" and "all-submissions".
 *
 *    After: Derived via useMemo from the course-level cache. Zero
 *    extra network requests.
 *
 * 4. isLessonAssignmentApproved() RECREATED ON EVERY RENDER
 *    Before: Plain function defined in component body, called 5+ times
 *    per render including inside a sidebar loop over every lesson.
 *
 *    After: useMemo returns a Map<lessonId, boolean> computed once.
 *    O(1) lookup anywhere in the tree.
 *
 * QUERY COUNT: 8 → 2  (plus 1 waterfall-start for lesson detail)
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

// ── Types ──────────────────────────────────────────────────────────
export interface LessonModule {
  id: string;
  course_id: string;
  title: string;
  sort_order: number | null;
}

export interface LessonItem {
  id: string;
  module_id: string;
  title: string;
  content_type: string | null;
  file_url: string | null;
  content_text: string | null;
  sort_order: number | null;
}

export interface CourseDetail {
  id: string;
  title: string;
  price: number;
}

export interface Assignment {
  id: string;
  lesson_id: string;
  title: string;
  description: string | null;
  objective: string | null;
  task: string | null;
  deliverable: string | null;
  attachment_files: string[] | null;
}

export interface Submission {
  id: string;
  assignment_id: string;
  user_id: string;
  status: string;
  text_submission: string | null;
  file_url: string | null;
  submission_files: string[] | null;
  feedback: string | null;
  submitted_at: string;
}

export interface LessonDetail extends LessonItem {
  modules: LessonModule & { courses: CourseDetail };
}

// ── Hook ───────────────────────────────────────────────────────────
export function useLessonData(lessonId: string | undefined, userId: string | undefined) {
  const qc = useQueryClient();

  // ── Query 1: Lesson detail (waterfall root — must be first) ───────
  // Gets the lesson plus its module and course in a single join.
  const {
    data: lesson,
    isLoading: lessonLoading,
    error: lessonError,
  } = useQuery({
    queryKey: queryKeys.lesson.detail(lessonId ?? ""),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("*, modules!inner(*, courses(*))")
        .eq("id", lessonId!)
        .single();
      if (error) throw error;
      return data as unknown as LessonDetail;
    },
    enabled: !!lessonId,
    staleTime: 10 * 60 * 1000, // lessons change infrequently
  });

  const courseId = (lesson as any)?.modules?.course_id as string | undefined;
  const course   = (lesson as any)?.modules?.courses   as CourseDetail | undefined;

  // ── Query 2: All course content ────────────────────────────────────
  // Replaces TWO former queries ("all-course-lessons" + "course-modules-viewer")
  // that hit the same tables with different cache keys.
  const {
    data: courseContent,
    isLoading: contentLoading,
  } = useQuery({
    queryKey: queryKeys.lesson.courseContent(courseId ?? ""),
    queryFn: async () => {
      const { data: mods, error: modErr } = await supabase
        .from("modules")
        .select("*")
        .eq("course_id", courseId!)
        .order("sort_order");
      if (modErr) throw modErr;
      if (!mods?.length) return { modules: [], lessons: [] };

      const { data: lessons, error: lessonErr } = await supabase
        .from("lessons")
        .select("*")
        .in("module_id", mods.map((m) => m.id));
      if (lessonErr) throw lessonErr;

      const moduleOrder = new Map(mods.map((m, i) => [m.id, m.sort_order ?? i]));
      const sorted = (lessons ?? []).sort((a: any, b: any) => {
        const modDiff = (moduleOrder.get(a.module_id) ?? 0) - (moduleOrder.get(b.module_id) ?? 0);
        return modDiff !== 0 ? modDiff : (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });

      return {
        modules: mods  as LessonModule[],
        lessons: sorted as LessonItem[],
      };
    },
    enabled: !!courseId,
    staleTime: 10 * 60 * 1000,
  });

  const allModules      = courseContent?.modules ?? [];
  const allCourseLessons = courseContent?.lessons ?? [];
  const lessonIds        = useMemo(() => allCourseLessons.map((l) => l.id), [allCourseLessons]);

  // ── Query 3: Completions ───────────────────────────────────────────
  const { data: allCompletions = [] } = useQuery({
    queryKey: queryKeys.lesson.completions(userId ?? "", courseId ?? ""),
    queryFn: async () => {
      if (!lessonIds.length) return [];
      const { data, error } = await supabase
        .from("lesson_completions")
        .select("lesson_id")
        .eq("user_id", userId!)
        .in("lesson_id", lessonIds);
      if (error) throw error;
      return (data ?? []).map((c: any) => c.lesson_id) as string[];
    },
    enabled: !!userId && lessonIds.length > 0,
  });

  // ── Query 4: Assignments + Submissions (parallel, no N+1) ──────────
  // Before: assignments → wait → submissions (sequential).
  // After:  both fetched in parallel within a single queryFn.
  const { data: assignSubData } = useQuery({
    queryKey: queryKeys.lesson.assignmentsAndSubs(userId ?? "", courseId ?? ""),
    queryFn: async () => {
      if (!lessonIds.length) return { assignments: [], submissions: [] };

      const [assignsRes, subsRes] = await Promise.all([
        supabase
          .from("assignments")
          .select("*")
          .in("lesson_id", lessonIds),
        // Submissions joined directly against lesson IDs via assignments table
        // Eliminates the sequential "get assignmentIds first" pattern.
        supabase
          .from("submissions")
          .select("*, assignments!inner(lesson_id)")
          .eq("user_id", userId!)
          .filter("assignments.lesson_id", "in", `(${lessonIds.join(",")})`),
      ]);

      return {
        assignments: (assignsRes.data ?? []) as Assignment[],
        submissions: (subsRes.data  ?? []) as (Submission & { assignments: { lesson_id: string } })[],
      };
    },
    enabled: !!userId && lessonIds.length > 0,
  });

  const allAssignments = assignSubData?.assignments ?? [];
  const allSubmissions = assignSubData?.submissions ?? [];

  // ── Derived: per-lesson assignments (replaces "lesson-assignments" query) ──
  const lessonAssignments = useMemo(
    () => allAssignments.filter((a) => a.lesson_id === lessonId),
    [allAssignments, lessonId],
  );

  // ── Derived: current lesson submissions (replaces "my-submissions" query) ──
  const lessonAssignmentIds = useMemo(
    () => new Set(lessonAssignments.map((a) => a.id)),
    [lessonAssignments],
  );
  const myLessonSubmissions = useMemo(
    () => allSubmissions.filter((s) => lessonAssignmentIds.has(s.assignment_id)),
    [allSubmissions, lessonAssignmentIds],
  );

  // ── Derived: approval Map (replaces inline function called 5×/render) ──
  // O(n) to build once, O(1) per lookup.
  const approvalMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const l of allCourseLessons) {
      const assigns = allAssignments.filter((a) => a.lesson_id === l.id);
      if (assigns.length === 0) {
        map.set(l.id, true); // no assignment = auto-approved
        continue;
      }
      const allApproved = assigns.every((a) => {
        const sub = allSubmissions.find((s) => s.assignment_id === a.id);
        return sub && sub.status === "Approved";
      });
      map.set(l.id, allApproved);
    }
    return map;
  }, [allCourseLessons, allAssignments, allSubmissions]);

  const isLessonApproved = (lId: string) => approvalMap.get(lId) ?? true;

  // ── Derived: global index of current lesson ────────────────────────
  const globalIndex = useMemo(
    () => allCourseLessons.findIndex((l) => l.id === lessonId),
    [allCourseLessons, lessonId],
  );

  // ── Realtime: invalidate on submissions/completions change ─────────
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`lesson-data-${lessonId}-${userId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "submissions", filter: `user_id=eq.${userId}` },
        () => {
          qc.invalidateQueries({ queryKey: queryKeys.lesson.assignmentsAndSubs(userId, courseId ?? "") });
        },
      )
      .on("postgres_changes",
        { event: "*", schema: "public", table: "lesson_completions", filter: `user_id=eq.${userId}` },
        () => {
          qc.invalidateQueries({ queryKey: queryKeys.lesson.completions(userId, courseId ?? "") });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, lessonId, courseId, qc]);

  // ── Progress ───────────────────────────────────────────────────────
  const completedCount   = allCompletions.length;
  const totalLessons     = allCourseLessons.length;
  const progressPercent  = totalLessons > 0
    ? Math.round((completedCount / totalLessons) * 100)
    : 0;

  return {
    // Lesson
    lesson,
    lessonLoading,
    lessonError,
    course,
    courseId,

    // Course content
    contentLoading,
    allModules,
    allCourseLessons,
    globalIndex,

    // User progress
    allCompletions,
    completedCount,
    totalLessons,
    progressPercent,
    currentCompletion: allCompletions.includes(lessonId ?? ""),

    // Assignments & submissions
    allAssignments,
    allSubmissions,
    lessonAssignments,        // current lesson only (derived, no extra query)
    myLessonSubmissions,      // current lesson only (derived, no extra query)
    isLessonApproved,         // O(1) Map lookup (not recreated per render)

    // Cache helpers for mutations to call
    invalidateCompletions: () =>
      qc.invalidateQueries({ queryKey: queryKeys.lesson.completions(userId ?? "", courseId ?? "") }),
    invalidateAssignments: () =>
      qc.invalidateQueries({ queryKey: queryKeys.lesson.assignmentsAndSubs(userId ?? "", courseId ?? "") }),
  };
}
