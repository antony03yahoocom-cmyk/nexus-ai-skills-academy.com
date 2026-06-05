
-- 1. app_settings: restrict reads to authenticated users
DROP POLICY IF EXISTS "Anyone can read app_settings" ON public.app_settings;
CREATE POLICY "Authenticated users can read app_settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

-- 2. Recreate public views with security_invoker so they respect caller RLS
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
  WITH (security_invoker = true) AS
  SELECT user_id, full_name, avatar_url, created_at, updated_at
  FROM public.profiles
  WHERE COALESCE(is_banned, false) = false;
GRANT SELECT ON public.profiles_public TO authenticated, anon;

DROP VIEW IF EXISTS public.marketplace_student_profiles_public;
CREATE VIEW public.marketplace_student_profiles_public
  WITH (security_invoker = true) AS
  SELECT user_id, headline, bio, skills, completed_courses, certificates,
         social_links, availability_status, xp_points, rank_title, featured,
         profile_views, created_at, updated_at
  FROM public.marketplace_student_profiles;
GRANT SELECT ON public.marketplace_student_profiles_public TO authenticated, anon;

DROP VIEW IF EXISTS public.course_modules_with_lessons;
CREATE VIEW public.course_modules_with_lessons
  WITH (security_invoker = true) AS
  SELECT m.id AS module_id, m.title AS module_title,
         l.id AS lesson_id, l.title AS lesson_title
  FROM public.modules m
  LEFT JOIN public.lessons l ON l.module_id = m.id
  ORDER BY m.sort_order, l.sort_order;
GRANT SELECT ON public.course_modules_with_lessons TO authenticated, anon;

-- 3. lesson_completions: remove self-delete (admin policy still allows admin cleanup via has_role if added; add explicit admin policy)
DROP POLICY IF EXISTS "Users can delete own completions" ON public.lesson_completions;
CREATE POLICY "Admins manage lesson completions"
  ON public.lesson_completions FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 4. followup_log: allow owners to read their own rows
CREATE POLICY "Users can view own followup log"
  ON public.followup_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 5. group-files storage: enforce group membership on upload
DROP POLICY IF EXISTS "Authenticated users can upload group files" ON storage.objects;
CREATE POLICY "Group members can upload group files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'group-files'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.user_id = auth.uid()
        AND gm.group_id::text = (storage.foldername(name))[1]
    )
  );
