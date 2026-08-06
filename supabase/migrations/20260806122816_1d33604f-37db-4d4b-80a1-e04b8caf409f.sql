-- 1. Per-conversation AI agent controls
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_last_reply_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_replies_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS is_ai boolean NOT NULL DEFAULT false;

-- 2. Fix automation dispatch: pg_net signature is http_post(url, body jsonb, params, headers, timeout)
CREATE OR REPLACE FUNCTION public.fire_whatsapp_automations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_supabase_url text;
  v_internal_key text;
  v_auto record;
  v_profile record;
  v_tpl record;
  v_scheduled_at timestamptz;
  v_evt text := NEW.event_type::text;
BEGIN
  SELECT supabase_url, internal_key INTO v_supabase_url, v_internal_key
  FROM public.wa_admin_config WHERE id = true;

  SELECT user_id, whatsapp_number, COALESCE(whatsapp_opted_in, false) AS opted, full_name
    INTO v_profile
    FROM public.profiles WHERE user_id = NEW.user_id;

  FOR v_auto IN
    SELECT * FROM public.whatsapp_automations
    WHERE enabled = true
      AND template_id IS NOT NULL
      AND (event_trigger = v_evt OR event_trigger IN ('any', 'all', '*', 'new_notification'))
  LOOP
    BEGIN
      SELECT * INTO v_tpl FROM public.whatsapp_templates
        WHERE id = v_auto.template_id AND status = 'APPROVED';

      IF NOT FOUND THEN
        INSERT INTO public.whatsapp_automation_logs(automation_id, event_trigger, student_user_id, phone_number, template_name, status, error_message)
        VALUES (v_auto.id, v_evt, NEW.user_id, v_profile.whatsapp_number, NULL, 'failed', 'Template missing or not approved');
        CONTINUE;
      END IF;

      IF v_profile.whatsapp_number IS NULL OR v_profile.whatsapp_number = '' THEN
        INSERT INTO public.whatsapp_automation_logs(automation_id, event_trigger, student_user_id, phone_number, template_name, status, error_message)
        VALUES (v_auto.id, v_evt, NEW.user_id, NULL, v_tpl.name, 'skipped', 'No WhatsApp number on profile');
        CONTINUE;
      END IF;

      IF NOT v_profile.opted THEN
        INSERT INTO public.whatsapp_automation_logs(automation_id, event_trigger, student_user_id, phone_number, template_name, status, error_message)
        VALUES (v_auto.id, v_evt, NEW.user_id, v_profile.whatsapp_number, v_tpl.name, 'skipped', 'Recipient not opted in');
        CONTINUE;
      END IF;

      IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
        INSERT INTO public.whatsapp_automation_logs(automation_id, event_trigger, student_user_id, phone_number, template_name, status, error_message)
        VALUES (v_auto.id, v_evt, NEW.user_id, v_profile.whatsapp_number, v_tpl.name, 'failed', 'Backend URL not configured in WhatsApp settings');
        CONTINUE;
      END IF;

      IF v_auto.delay_minutes > 0 THEN
        v_scheduled_at := now() + (v_auto.delay_minutes || ' minutes')::interval;
        INSERT INTO public.whatsapp_scheduled (template_id, template_vars, recipients, schedule_type, scheduled_at, created_by, status)
        VALUES (
          v_tpl.id,
          v_auto.template_vars,
          jsonb_build_array(jsonb_build_object(
            'user_id', v_profile.user_id,
            'phone',   v_profile.whatsapp_number,
            'name',    v_profile.full_name
          )),
          'once', v_scheduled_at, v_auto.created_by, 'queued'
        );
        INSERT INTO public.whatsapp_automation_logs(automation_id, event_trigger, student_user_id, phone_number, template_name, status)
        VALUES (v_auto.id, v_evt, v_profile.user_id, v_profile.whatsapp_number, v_tpl.name, 'scheduled');
      ELSE
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/whatsapp-admin',
          body := jsonb_build_object(
            'action',      'send_template',
            'template_id', v_tpl.id,
            'recipients',  jsonb_build_array(jsonb_build_object(
              'user_id', v_profile.user_id,
              'phone',   v_profile.whatsapp_number,
              'name',    v_profile.full_name
            )),
            'vars',          v_auto.template_vars,
            'automation_id', v_auto.id
          ),
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-whatsapp-internal-key', COALESCE(v_internal_key, '')
          ),
          timeout_milliseconds := 8000
        );
        INSERT INTO public.whatsapp_automation_logs(automation_id, event_trigger, student_user_id, phone_number, template_name, status)
        VALUES (v_auto.id, v_evt, v_profile.user_id, v_profile.whatsapp_number, v_tpl.name, 'sent');
      END IF;

      UPDATE public.whatsapp_automations
      SET runs_count = runs_count + 1, last_run_at = now()
      WHERE id = v_auto.id;

    EXCEPTION WHEN OTHERS THEN
      BEGIN
        INSERT INTO public.whatsapp_automation_logs(automation_id, event_trigger, student_user_id, phone_number, template_name, status, error_message)
        VALUES (v_auto.id, v_evt, NEW.user_id, v_profile.whatsapp_number, NULL, 'failed', left(SQLERRM, 500));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END;
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END; $function$;

-- 3. Real platform events -> notifications (which drive automations)

-- 3a. New assignment posted on a lesson
CREATE OR REPLACE FUNCTION public.notify_new_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_course_id uuid; v_course_title text; v_lesson_title text;
BEGIN
  SELECT m.course_id, c.title, l.title
    INTO v_course_id, v_course_title, v_lesson_title
  FROM public.lessons l
  JOIN public.modules m ON m.id = l.module_id
  JOIN public.courses c ON c.id = m.course_id
  WHERE l.id = NEW.lesson_id;

  IF v_course_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.notifications (user_id, event_type, title, message, metadata)
  SELECT e.user_id, 'new_assignment', 'New assignment: ' || NEW.title,
         'A new assignment was added to ' || COALESCE(v_lesson_title, 'a lesson') || ' in ' || COALESCE(v_course_title, 'your course') || '.',
         jsonb_build_object('assignment_id', NEW.id, 'lesson_id', NEW.lesson_id, 'course_id', v_course_id)
  FROM public.enrollments e
  WHERE e.course_id = v_course_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_new_assignment ON public.assignments;
CREATE TRIGGER trg_notify_new_assignment
AFTER INSERT ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.notify_new_assignment();

-- 3b. Assignment reviewed
CREATE OR REPLACE FUNCTION public.notify_assignment_reviewed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_title text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF lower(NEW.status) NOT IN ('approved', 'rejected') THEN RETURN NEW; END IF;

  SELECT a.title INTO v_title FROM public.assignments a WHERE a.id = NEW.assignment_id;

  INSERT INTO public.notifications (user_id, event_type, title, message, metadata)
  VALUES (
    NEW.user_id, 'assignment_review_complete',
    'Assignment ' || lower(NEW.status) || ': ' || COALESCE(v_title, 'your submission'),
    COALESCE(NULLIF(NEW.feedback, ''), 'Your submission has been reviewed.'),
    jsonb_build_object('submission_id', NEW.id, 'assignment_id', NEW.assignment_id, 'status', NEW.status)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_assignment_reviewed ON public.submissions;
CREATE TRIGGER trg_notify_assignment_reviewed
AFTER UPDATE OF status ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.notify_assignment_reviewed();

-- 3c. New announcement
CREATE OR REPLACE FUNCTION public.notify_new_announcement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, event_type, title, message, metadata)
  SELECT p.user_id, 'new_announcement', NEW.title, left(NEW.content, 500),
         jsonb_build_object('announcement_id', NEW.id)
  FROM public.profiles p
  WHERE COALESCE(p.is_banned, false) = false;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_new_announcement ON public.announcements;
CREATE TRIGGER trg_notify_new_announcement
AFTER INSERT ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.notify_new_announcement();

-- 3d. New lesson / content added to a course
CREATE OR REPLACE FUNCTION public.notify_course_content_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_course_id uuid; v_course_title text;
BEGIN
  SELECT m.course_id, c.title INTO v_course_id, v_course_title
  FROM public.modules m JOIN public.courses c ON c.id = m.course_id
  WHERE m.id = NEW.module_id;

  IF v_course_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.notifications (user_id, event_type, title, message, metadata)
  SELECT e.user_id, 'course_content_updated', 'New lesson in ' || COALESCE(v_course_title, 'your course'),
         'A new lesson "' || NEW.title || '" is now available.',
         jsonb_build_object('lesson_id', NEW.id, 'course_id', v_course_id)
  FROM public.enrollments e
  WHERE e.course_id = v_course_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_course_content_updated ON public.lessons;
CREATE TRIGGER trg_notify_course_content_updated
AFTER INSERT ON public.lessons
FOR EACH ROW EXECUTE FUNCTION public.notify_course_content_updated();

-- 3e. Certificate issued
CREATE OR REPLACE FUNCTION public.notify_certificate_issued()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_course_title text;
BEGIN
  IF NEW.status::text <> 'Issued' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status::text = 'Issued' THEN RETURN NEW; END IF;

  SELECT title INTO v_course_title FROM public.courses WHERE id = NEW.course_id;

  INSERT INTO public.notifications (user_id, event_type, title, message, metadata)
  VALUES (NEW.student_id, 'certificate_earned',
          'Certificate ready 🎓',
          'Your certificate for ' || COALESCE(v_course_title, 'your course') || ' has been issued.',
          jsonb_build_object('certificate_id', NEW.id, 'course_id', NEW.course_id));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_certificate_issued ON public.certificates;
CREATE TRIGGER trg_notify_certificate_issued
AFTER INSERT OR UPDATE OF status ON public.certificates
FOR EACH ROW EXECUTE FUNCTION public.notify_certificate_issued();