CREATE TABLE IF NOT EXISTS public.project_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
ALTER TABLE public.project_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view project likes" ON public.project_likes;
CREATE POLICY "Anyone can view project likes" ON public.project_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated can like" ON public.project_likes;
CREATE POLICY "Authenticated can like" ON public.project_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can unlike own" ON public.project_likes;
CREATE POLICY "Users can unlike own" ON public.project_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.project_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view project comments" ON public.project_comments;
CREATE POLICY "Anyone can view project comments" ON public.project_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated can comment" ON public.project_comments;
CREATE POLICY "Authenticated can comment" ON public.project_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users delete own comments" ON public.project_comments;
CREATE POLICY "Users delete own comments" ON public.project_comments FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.notify_new_course()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  admin_id uuid;
  student record;
BEGIN
  IF NEW.is_published = true AND (TG_OP = 'INSERT' OR OLD.is_published = false) THEN
    SELECT user_id INTO admin_id FROM public.user_roles WHERE role = 'admin' LIMIT 1;
    IF admin_id IS NULL THEN RETURN NEW; END IF;
    FOR student IN SELECT user_id FROM public.profiles WHERE user_id <> admin_id LOOP
      INSERT INTO public.private_messages (sender_id, receiver_id, content, is_read)
      VALUES (admin_id, student.user_id,
        '🎓 New Course Available — "' || NEW.title || E'"\n\n' || COALESCE(NEW.description, '') || E'\n\nVisit the Courses page to enroll and start learning!',
        false);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notify_new_course_trigger ON public.courses;
CREATE TRIGGER notify_new_course_trigger AFTER INSERT OR UPDATE OF is_published ON public.courses
FOR EACH ROW EXECUTE FUNCTION public.notify_new_course();

CREATE OR REPLACE FUNCTION public.notify_payment_success()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  admin_id uuid;
  course_title text;
BEGIN
  IF NEW.status = 'paid' THEN
    SELECT user_id INTO admin_id FROM public.user_roles WHERE role = 'admin' LIMIT 1;
    SELECT title INTO course_title FROM public.courses WHERE id = NEW.course_id;
    IF admin_id IS NOT NULL AND course_title IS NOT NULL THEN
      INSERT INTO public.private_messages (sender_id, receiver_id, content, is_read)
      VALUES (admin_id, NEW.user_id,
        '✅ Payment Received — "' || course_title || E'"\n\nThank you! Your payment of KES ' || (NEW.amount/100)::text || ' has been confirmed and you now have full lifetime access to this course. Open the course to continue learning! 🚀',
        false);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notify_payment_success_trigger ON public.course_purchases;
CREATE TRIGGER notify_payment_success_trigger AFTER INSERT OR UPDATE OF status ON public.course_purchases
FOR EACH ROW EXECUTE FUNCTION public.notify_payment_success();