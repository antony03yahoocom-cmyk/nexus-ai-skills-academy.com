
-- 1) Lesson gating: require assignment-approved
CREATE OR REPLACE FUNCTION public.is_lesson_assignment_approved(p_user_id uuid, p_lesson_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.lesson_id = p_lesson_id
      AND NOT EXISTS (
        SELECT 1 FROM public.submissions s
        WHERE s.assignment_id = a.id AND s.user_id = p_user_id AND s.status = 'Approved'
      )
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_lesson_assignment_approved(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_sequential_lesson_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_course_id uuid; v_target_rn int; v_prev_lesson uuid;
  v_completed_prev boolean; v_current_approved boolean; v_prev_approved boolean;
BEGIN
  IF has_role(NEW.user_id, 'admin'::app_role) THEN RETURN NEW; END IF;
  SELECT public.is_lesson_assignment_approved(NEW.user_id, NEW.lesson_id) INTO v_current_approved;
  IF NOT v_current_approved THEN
    RAISE EXCEPTION 'Submit the assignment and wait for approval before completing this lesson';
  END IF;
  SELECT c.id INTO v_course_id FROM public.lessons l
    JOIN public.modules m ON m.id = l.module_id
    JOIN public.courses c ON c.id = m.course_id WHERE l.id = NEW.lesson_id;
  IF v_course_id IS NULL THEN RETURN NEW; END IF;
  WITH ordered AS (
    SELECT l.id AS lid, ROW_NUMBER() OVER (ORDER BY m.sort_order, m.order_index, l.sort_order, l.order_index) AS rn
    FROM public.lessons l JOIN public.modules m ON m.id = l.module_id WHERE m.course_id = v_course_id
  ) SELECT rn INTO v_target_rn FROM ordered WHERE lid = NEW.lesson_id;
  IF v_target_rn IS NULL OR v_target_rn = 1 THEN RETURN NEW; END IF;
  WITH ordered AS (
    SELECT l.id AS lid, ROW_NUMBER() OVER (ORDER BY m.sort_order, m.order_index, l.sort_order, l.order_index) AS rn
    FROM public.lessons l JOIN public.modules m ON m.id = l.module_id WHERE m.course_id = v_course_id
  ) SELECT lid INTO v_prev_lesson FROM ordered WHERE rn = v_target_rn - 1;
  IF v_prev_lesson IS NULL THEN RETURN NEW; END IF;
  SELECT EXISTS (SELECT 1 FROM public.lesson_completions WHERE user_id = NEW.user_id AND lesson_id = v_prev_lesson) INTO v_completed_prev;
  IF NOT v_completed_prev THEN
    RAISE EXCEPTION 'Complete the previous lesson before completing this one';
  END IF;
  SELECT public.is_lesson_assignment_approved(NEW.user_id, v_prev_lesson) INTO v_prev_approved;
  IF NOT v_prev_approved THEN
    RAISE EXCEPTION 'Previous lesson assignment must be approved before continuing';
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.can_access_lesson(p_user_id uuid, p_lesson_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_course_id uuid; v_global_index int; v_is_admin boolean;
  v_has_full boolean; v_has_trial boolean; v_prev_lesson uuid;
  v_prev_done boolean; v_prev_approved boolean;
BEGIN
  SELECT c.id INTO v_course_id FROM lessons l
    JOIN modules m ON m.id = l.module_id
    JOIN courses c ON c.id = m.course_id WHERE l.id = p_lesson_id;
  IF v_course_id IS NULL THEN RETURN FALSE; END IF;
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = 'admin') INTO v_is_admin;
  IF v_is_admin THEN RETURN TRUE; END IF;
  WITH ordered AS (
    SELECT l.id AS lid, ROW_NUMBER() OVER (ORDER BY m.sort_order, m.order_index, l.sort_order, l.order_index) AS rn
    FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = v_course_id
  ) SELECT rn INTO v_global_index FROM ordered WHERE lid = p_lesson_id;
  SELECT (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = p_user_id AND p.is_premium = true)
    OR EXISTS (SELECT 1 FROM public.course_purchases cp WHERE cp.user_id = p_user_id AND cp.course_id = v_course_id AND cp.status = 'paid')
    OR EXISTS (
      SELECT 1 FROM public.courses c JOIN public.enrollments e ON e.course_id = c.id AND e.user_id = p_user_id
      WHERE c.id = v_course_id AND c.price = 0
    )
  ) INTO v_has_full;
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments e
    JOIN public.profiles p ON p.user_id = e.user_id
    JOIN public.courses c ON c.id = e.course_id
    WHERE e.user_id = p_user_id AND e.course_id = v_course_id AND c.price > 0
      AND p.trial_course_id = v_course_id
      AND p.trial_start_date + interval '7 days' > now()
      AND v_global_index BETWEEN 1 AND 7
  ) INTO v_has_trial;
  IF NOT (v_has_full OR v_has_trial) THEN RETURN FALSE; END IF;
  IF v_global_index = 1 THEN RETURN TRUE; END IF;
  WITH ordered AS (
    SELECT l.id AS lid, ROW_NUMBER() OVER (ORDER BY m.sort_order, m.order_index, l.sort_order, l.order_index) AS rn
    FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = v_course_id
  ) SELECT lid INTO v_prev_lesson FROM ordered WHERE rn = v_global_index - 1;
  SELECT EXISTS (SELECT 1 FROM public.lesson_completions WHERE user_id = p_user_id AND lesson_id = v_prev_lesson) INTO v_prev_done;
  SELECT public.is_lesson_assignment_approved(p_user_id, v_prev_lesson) INTO v_prev_approved;
  RETURN v_prev_done AND v_prev_approved;
END; $$;

-- 2) Privacy: profiles
DROP POLICY IF EXISTS "Authenticated users can view profile names" ON public.profiles;

CREATE OR REPLACE VIEW public.profiles_public AS
  SELECT user_id, full_name, avatar_url, created_at, updated_at
  FROM public.profiles
  WHERE COALESCE(is_banned, false) = false;
GRANT SELECT ON public.profiles_public TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.profiles LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.profiles WHERE user_id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- 3) Privacy: marketplace_student_profiles
DROP POLICY IF EXISTS "View student profiles" ON public.marketplace_student_profiles;

CREATE POLICY "Owner or admin can view student profile"
  ON public.marketplace_student_profiles FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE VIEW public.marketplace_student_profiles_public AS
  SELECT user_id, headline, bio, skills, completed_courses, certificates,
         social_links, availability_status, xp_points, rank_title, featured,
         profile_views, created_at, updated_at
  FROM public.marketplace_student_profiles;
GRANT SELECT ON public.marketplace_student_profiles_public TO authenticated, anon;
