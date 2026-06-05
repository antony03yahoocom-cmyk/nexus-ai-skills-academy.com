import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RatingSummary {
  avg: number;
  count: number;
}

export const useCourseRatings = () => {
  return useQuery({
    queryKey: ["course-rating-summary"],
    queryFn: async () => {
      const { data } = await supabase.from("course_reviews" as any).select("course_id, rating");
      const map: Record<string, RatingSummary> = {};
      (data ?? []).forEach((r: any) => {
        const e = map[r.course_id] || { avg: 0, count: 0 };
        e.avg = (e.avg * e.count + r.rating) / (e.count + 1);
        e.count += 1;
        map[r.course_id] = e;
      });
      return map;
    },
  });
};
