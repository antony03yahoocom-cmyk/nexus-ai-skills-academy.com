import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Buckets that are private and therefore need short-lived signed URLs. */
const PRIVATE_BUCKETS = ["assignment-files", "course-content", "lesson-attachments", "certificates"];

function parseStorageUrl(raw: string): { bucket: string; path: string } | null {
  const marker = "/storage/v1/object/";
  const idx = raw.indexOf(marker);
  if (idx === -1) return null;
  const rest = raw.slice(idx + marker.length).replace(/^public\//, "").replace(/^sign\//, "");
  const [bucket, ...parts] = rest.split("/");
  const path = parts.join("/").split("?")[0];
  if (!bucket || !path) return null;
  return { bucket, path };
}

/**
 * Turns a stored storage URL into a fresh signed URL when it points at a
 * private bucket. Public/external URLs are returned unchanged.
 */
export function useSignedStorageUrl(rawUrl: string | null | undefined, expiresIn = 3600): string | null {
  const [url, setUrl] = useState<string | null>(rawUrl ?? null);

  useEffect(() => {
    if (!rawUrl) { setUrl(null); return; }
    const parsed = parseStorageUrl(rawUrl);
    if (!parsed || !PRIVATE_BUCKETS.includes(parsed.bucket)) { setUrl(rawUrl); return; }

    let cancelled = false;
    supabase.storage.from(parsed.bucket).createSignedUrl(decodeURIComponent(parsed.path), expiresIn)
      .then(({ data }) => { if (!cancelled) setUrl(data?.signedUrl ?? null); });
    return () => { cancelled = true; };
  }, [rawUrl, expiresIn]);

  return url;
}
