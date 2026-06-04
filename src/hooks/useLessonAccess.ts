// src/hooks/useLessonAccess.ts
//
// PURPOSE: Single source of truth for lesson access control.
// Rules (apply to ALL plans — free, free-trial, single-course purchase, premium):
//   • Lesson 1 of every course is always accessible once enrolled.
//   • Lesson N (N > 1) is accessible only when lesson N-1 is "completed"
//     (assignment submitted AND approved).
//   • Lessons are ordered globally across modules by (module.order, lesson.order).
//   • A completed lesson has a row in lesson_completions with status = 'approved'.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export interface LessonWithOrder {
  id: string;
  title: string;
  module_id: string;
  order_index: number;
  moduleOrder: number;   // parent module's order_index
  globalIndex: number;   // 0-based position in the flat sorted list
}

export interface LessonAccessMap {
  [lessonId: string]: {
    isUnlocked: boolean;
    isCompleted: boolean;
    globalIndex: number;
  };
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────
export function useLessonAccess(courseId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["lesson-access", courseId, user?.id],
    enabled: !!courseId && !!user?.id,
    // Re-fetch quickly so the "Next Lesson" button appears promptly after approval
    staleTime: 0,
    refetchInterval: 5000, // poll every 5 s so approval reflects fast
    queryFn: async (): Promise<LessonAccessMap> => {
      if (!courseId || !user?.id) return {};

      // 1. Load all modules for this course (ordered)
      const { data: modules, error: modErr } = await supabase
        .from("modules")
        .select("id, order_index")
        .eq("course_id", courseId)
        .order("order_index", { ascending: true });

      if (modErr) throw modErr;
      if (!modules?.length) return {};

      const moduleIds = modules.map((m) => m.id);

      // 2. Load all lessons for those modules
      const { data: lessons, error: lesErr } = await supabase
        .from("lessons")
        .select("id, title, module_id, order_index")
        .in("module_id", moduleIds);

      if (lesErr) throw lesErr;
      if (!lessons?.length) return {};

      // 3. Build module lookup for sort key
      const moduleOrderMap: Record<string, number> = {};
      modules.forEach((m) => (moduleOrderMap[m.id] = m.order_index));

      // 4. Sort lessons: first by module order, then by lesson order
      const sorted: LessonWithOrder[] = lessons
        .map((l) => ({
          ...l,
          moduleOrder: moduleOrderMap[l.module_id] ?? 0,
          globalIndex: 0, // filled below
        }))
        .sort((a, b) =>
          a.moduleOrder !== b.moduleOrder
            ? a.moduleOrder - b.moduleOrder
            : a.order_index - b.order_index
        );

      sorted.forEach((l, i) => (l.globalIndex = i));

      // 5. Load completions for this student in this course
      //    A completion row with status='approved' means that lesson is done.
      const { data: completions, error: compErr } = await supabase
        .from("lesson_completions")
        .select("lesson_id, status")
        .eq("user_id", user.id)
        .in(
          "lesson_id",
          sorted.map((l) => l.id)
        );

      if (compErr) throw compErr;

      const approvedSet = new Set<string>();
      const submittedSet = new Set<string>();
      (completions ?? []).forEach((c) => {
        if (c.status === "approved") approvedSet.add(c.lesson_id);
        if (c.status === "submitted" || c.status === "approved")
          submittedSet.add(c.lesson_id);
      });

      // 6. Build access map
      //    globalIndex 0 → always unlocked (first lesson)
      //    globalIndex N → unlocked only if lesson at (N-1) is approved
      const accessMap: LessonAccessMap = {};

      sorted.forEach((lesson, idx) => {
        const isCompleted = approvedSet.has(lesson.id);
        let isUnlocked = false;

        if (idx === 0) {
          // First lesson always accessible
          isUnlocked = true;
        } else {
          // Previous lesson must be approved
          const prevLesson = sorted[idx - 1];
          isUnlocked = approvedSet.has(prevLesson.id);
        }

        accessMap[lesson.id] = {
          isUnlocked,
          isCompleted,
          globalIndex: idx,
        };
      });

      return accessMap;
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Helper: check single lesson access (used in LessonViewer)
// ─────────────────────────────────────────────────────────────
export function isLessonUnlocked(
  accessMap: LessonAccessMap | undefined,
  lessonId: string
): boolean {
  if (!accessMap) return false;
  return accessMap[lessonId]?.isUnlocked ?? false;
}
