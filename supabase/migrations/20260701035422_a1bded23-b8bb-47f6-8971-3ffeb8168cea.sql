
-- 1. Fix lessons table: drop the overly-permissive public policy that exposes content_text/file_url.
-- The lessons_public view already exposes safe metadata columns for anon/authenticated.
DROP POLICY IF EXISTS "Public can view lesson metadata of published courses" ON public.lessons;

-- 2. Fix lesson-attachments storage bucket: remove permissive anon/public SELECT policies
-- and restrict reads to admins + users with course access to the associated lesson.
DROP POLICY IF EXISTS "Anyone can view lesson attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public Access to Lesson Attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Attachments" ON storage.objects;

-- Attachments are stored under paths beginning with "<lesson_id>/..." (uuid prefix).
CREATE POLICY "Users with lesson access can view lesson attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'lesson-attachments'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE l.id::text = split_part(storage.objects.name, '/', 1)
        AND public.can_access_lesson(auth.uid(), l.id)
    )
  )
);
