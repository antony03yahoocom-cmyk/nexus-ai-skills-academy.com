-- Make the first-time paid-course trial exactly 7 days and first 5 lessons.
-- Also add manually managed blog posts for the admin blog editor.

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_course_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_lesson(uuid, uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  content TEXT,
  category TEXT NOT NULL DEFAULT 'AI Tips',
  read_time TEXT NOT NULL DEFAULT '5 min read',
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  emoji TEXT NOT NULL DEFAULT '📝',
  external_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read published blog posts" ON public.blog_posts;
CREATE POLICY "Anyone can read published blog posts"
ON public.blog_posts FOR SELECT
USING (is_published = true OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins manage blog posts" ON public.blog_posts;
CREATE POLICY "Admins manage blog posts"
ON public.blog_posts FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

INSERT INTO public.app_settings(key, value) VALUES
  ('trial_lesson_limit', '5'::jsonb),
  ('trial_duration_days', '7'::jsonb),
  ('support_email', '"support@nexusaiskillsacademy.com"'::jsonb),
  ('default_currency', '"KES"'::jsonb),
  ('maintenance_mode', 'false'::jsonb),
  ('allow_registrations', 'true'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

CREATE OR REPLACE FUNCTION public.can_access_lesson(p_user_id uuid, p_lesson_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_course_id UUID;
  v_global_index INT;
  v_has_full_course_access BOOLEAN;
  v_has_trial_access BOOLEAN;
BEGIN
  SELECT c.id INTO v_course_id
  FROM lessons l
  JOIN modules m ON m.id = l.module_id
  JOIN courses c ON c.id = m.course_id
  WHERE l.id = p_lesson_id;

  IF v_course_id IS NULL THEN
    RETURN FALSE;
  END IF;

  WITH ordered_lessons AS (
    SELECT l.id as lesson_id,
           ROW_NUMBER() OVER (ORDER BY m.sort_order, m.order_index, l.sort_order, l.order_index) as rn
    FROM lessons l
    JOIN modules m ON m.id = l.module_id
    WHERE m.course_id = v_course_id
  )
  SELECT rn INTO v_global_index
  FROM ordered_lessons
  WHERE lesson_id = p_lesson_id;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user_id = p_user_id AND p.is_premium = true
  ) OR EXISTS (
    SELECT 1 FROM public.course_purchases cp
    WHERE cp.user_id = p_user_id AND cp.course_id = v_course_id AND cp.status = 'paid'
  ) OR EXISTS (
    SELECT 1 FROM public.courses c
    JOIN public.enrollments e ON e.course_id = c.id AND e.user_id = p_user_id
    WHERE c.id = v_course_id AND c.price = 0
  ) INTO v_has_full_course_access;

  IF v_has_full_course_access THEN
    RETURN TRUE;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.enrollments e
    JOIN public.profiles p ON p.user_id = e.user_id
    JOIN public.courses c ON c.id = e.course_id
    WHERE e.user_id = p_user_id
      AND e.course_id = v_course_id
      AND c.price > 0
      AND p.trial_course_id = v_course_id
      AND p.trial_start_date + interval '7 days' > now()
      AND v_global_index BETWEEN 1 AND 5
  ) INTO v_has_trial_access;

  RETURN v_has_trial_access;
END;
$$;

DROP POLICY IF EXISTS "Enrolled users can view lessons" ON public.lessons;
CREATE POLICY "Enrolled users can view lessons" ON public.lessons
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.can_access_lesson(auth.uid(), lessons.id)
);

DROP POLICY IF EXISTS "Enrolled users can view assignments" ON public.assignments;
CREATE POLICY "Enrolled users can view assignments" ON public.assignments
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.lessons l
    WHERE l.id = assignments.lesson_id
      AND public.can_access_lesson(auth.uid(), l.id)
  )
);
