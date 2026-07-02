import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Convert a public/legacy course-content URL into a fresh signed URL.
 * External URLs (YouTube, http links to other origins) are returned unchanged.
 * The bucket "course-content" is private — callers must have an active session
 * and the RLS policy checks `has_course_access` on the referenced course.
 */
export function useSignedCourseUrl(rawUrl: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(rawUrl ?? null);

  useEffect(() => {
    if (!rawUrl) { setUrl(null); return; }

    // External / non-storage URLs: use as-is.
    const marker = "/storage/v1/object/";
    const idx = rawUrl.indexOf(marker);
    if (idx === -1) { setUrl(rawUrl); return; }

    // Extract "<bucket>/<path>" after either /public/ or /sign/ segments.
    const rest = rawUrl.slice(idx + marker.length).replace(/^public\//, "").replace(/^sign\//, "");
    const [bucket, ...pathParts] = rest.split("/");
    const objectPath = pathParts.join("/").split("?")[0];

    if (bucket !== "course-content" || !objectPath) { setUrl(rawUrl); return; }

    let cancelled = false;
    supabase.storage.from("course-content").createSignedUrl(objectPath, 60 * 60).then(({ data }) => {
      if (!cancelled) setUrl(data?.signedUrl ?? rawUrl);
    });
    return () => { cancelled = true; };
  }, [rawUrl]);

  return url;
}
