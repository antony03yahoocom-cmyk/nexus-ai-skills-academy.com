-- Keep OAuth signups, the 7-day trial, and free-course access reliable.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, trial_start_date)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      NULLIF(split_part(NEW.email, '@', 1), ''),
      'Student'
    ),
    now()
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_course_access(_user_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = _course_id AND c.price = 0 AND _user_id IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.user_id = _user_id AND e.course_id = _course_id
    AND (
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = _user_id AND p.is_premium = true)
      OR EXISTS (SELECT 1 FROM public.course_purchases cp WHERE cp.user_id = _user_id AND cp.course_id = _course_id AND cp.status = 'paid')
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = _user_id
          AND p.trial_course_id = _course_id
          AND p.trial_start_date + interval '7 days' > now()
      )
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_lesson(p_user_id uuid, p_lesson_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_course_id UUID;
  v_course_price INTEGER;
  v_global_index INT;
  v_has_full_course_access BOOLEAN;
  v_has_trial_access BOOLEAN;
BEGIN
  SELECT c.id, c.price INTO v_course_id, v_course_price
  FROM lessons l
  JOIN modules m ON m.id = l.module_id
  JOIN courses c ON c.id = m.course_id
  WHERE l.id = p_lesson_id;

  IF v_course_id IS NULL OR p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF COALESCE(v_course_price, 0) = 0 THEN
    RETURN TRUE;
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

GRANT EXECUTE ON FUNCTION public.has_course_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_lesson(uuid, uuid) TO authenticated;
