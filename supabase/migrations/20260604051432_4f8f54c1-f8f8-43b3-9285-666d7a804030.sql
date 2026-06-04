
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
ON public.profiles FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "System and admins insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users insert own notifications" ON public.notifications;
CREATE POLICY "Users insert own notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Students can view lessons" ON public.video_lessons;
DROP POLICY IF EXISTS "Admins can view video lessons" ON public.video_lessons;
CREATE POLICY "Admins can view video lessons"
ON public.video_lessons FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated can read active promo_codes" ON public.promo_codes;
DROP POLICY IF EXISTS "Admins can read promo codes" ON public.promo_codes;
CREATE POLICY "Admins can read promo codes"
ON public.promo_codes FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.enforce_sequential_lesson_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_id uuid;
  v_target_rn int;
  v_prev_lesson uuid;
  v_completed_prev boolean;
BEGIN
  IF has_role(NEW.user_id, 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  SELECT c.id INTO v_course_id
  FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  JOIN public.courses c ON c.id = m.course_id
  WHERE l.id = NEW.lesson_id;

  IF v_course_id IS NULL THEN RETURN NEW; END IF;

  WITH ordered AS (
    SELECT l.id AS lid,
           ROW_NUMBER() OVER (ORDER BY m.sort_order, m.order_index, l.sort_order, l.order_index) AS rn
    FROM public.lessons l
    JOIN public.modules m ON m.id = l.module_id
    WHERE m.course_id = v_course_id
  )
  SELECT rn INTO v_target_rn FROM ordered WHERE lid = NEW.lesson_id;

  IF v_target_rn IS NULL OR v_target_rn = 1 THEN RETURN NEW; END IF;

  WITH ordered AS (
    SELECT l.id AS lid,
           ROW_NUMBER() OVER (ORDER BY m.sort_order, m.order_index, l.sort_order, l.order_index) AS rn
    FROM public.lessons l
    JOIN public.modules m ON m.id = l.module_id
    WHERE m.course_id = v_course_id
  )
  SELECT lid INTO v_prev_lesson FROM ordered WHERE rn = v_target_rn - 1;

  IF v_prev_lesson IS NULL THEN RETURN NEW; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.lesson_completions
    WHERE user_id = NEW.user_id AND lesson_id = v_prev_lesson
  ) INTO v_completed_prev;

  IF NOT v_completed_prev THEN
    RAISE EXCEPTION 'Cannot complete this lesson before completing the previous one';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_sequential_lesson_completion_trigger ON public.lesson_completions;
CREATE TRIGGER enforce_sequential_lesson_completion_trigger
BEFORE INSERT ON public.lesson_completions
FOR EACH ROW EXECUTE FUNCTION public.enforce_sequential_lesson_completion();
