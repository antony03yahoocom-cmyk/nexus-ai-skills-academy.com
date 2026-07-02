-- Drop any existing permissive policies on course-content
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND (qual LIKE '%course-content%' OR with_check LIKE '%course-content%'
           OR policyname ILIKE '%course-content%' OR policyname ILIKE '%course_content%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

-- Helper: is this storage object referenced by a lesson the user can access?
CREATE OR REPLACE FUNCTION public.can_read_course_content_object(p_user_id uuid, p_object_name text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(p_user_id, 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      WHERE l.file_url LIKE '%/course-content/' || p_object_name
        AND public.has_course_access(p_user_id, m.course_id)
    );
$$;

REVOKE ALL ON FUNCTION public.can_read_course_content_object(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_course_content_object(uuid, text) TO authenticated, service_role;

-- Read policy: gated by enrollment/purchase/trial/premium/admin
CREATE POLICY "course_content_read_gated"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'course-content'
  AND public.can_read_course_content_object(auth.uid(), name)
);

-- Admins manage uploads/updates/deletes
CREATE POLICY "course_content_admin_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'course-content' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "course_content_admin_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'course-content' AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'course-content' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "course_content_admin_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'course-content' AND public.has_role(auth.uid(), 'admin'::app_role));