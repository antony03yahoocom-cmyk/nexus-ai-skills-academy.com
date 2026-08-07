-- 1 ── Dedupe whatsapp_templates: keep the newest row per (name, language)
CREATE TEMP TABLE tpl_keep AS
SELECT DISTINCT ON (name, language) id AS keep_id, name, language
FROM public.whatsapp_templates
ORDER BY name, language, created_at DESC;

CREATE TEMP TABLE tpl_map AS
SELECT t.id AS old_id, k.keep_id
FROM public.whatsapp_templates t
JOIN tpl_keep k ON k.name = t.name AND k.language = t.language
WHERE t.id <> k.keep_id;

UPDATE public.whatsapp_automations a
SET template_id = m.keep_id
FROM tpl_map m WHERE a.template_id = m.old_id;

UPDATE public.whatsapp_scheduled s
SET template_id = m.keep_id
FROM tpl_map m WHERE s.template_id = m.old_id;

DELETE FROM public.whatsapp_templates t
USING tpl_map m WHERE t.id = m.old_id;

-- 2 ── Prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_templates_name_lang_key
  ON public.whatsapp_templates (name, language);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_templates_meta_id_key
  ON public.whatsapp_templates (meta_id);

-- 3 ── Private academy message when a submission is reviewed
CREATE OR REPLACE FUNCTION public.notify_assignment_reviewed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_title text;
  v_admin uuid;
  v_status text := lower(COALESCE(NEW.status, ''));
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF v_status NOT IN ('approved', 'rejected') THEN RETURN NEW; END IF;

  SELECT a.title INTO v_title FROM public.assignments a WHERE a.id = NEW.assignment_id;

  INSERT INTO public.notifications (user_id, event_type, title, message, metadata)
  VALUES (
    NEW.user_id, 'assignment_review_complete',
    'Assignment ' || v_status || ': ' || COALESCE(v_title, 'your submission'),
    COALESCE(NULLIF(NEW.feedback, ''), 'Your submission has been reviewed.'),
    jsonb_build_object('submission_id', NEW.id, 'assignment_id', NEW.assignment_id, 'status', NEW.status)
  );

  -- Private in-academy message from the admin account
  SELECT user_id INTO v_admin FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  IF v_admin IS NOT NULL AND v_admin <> NEW.user_id THEN
    INSERT INTO public.private_messages (sender_id, receiver_id, content, is_read)
    VALUES (
      v_admin, NEW.user_id,
      CASE WHEN v_status = 'approved'
        THEN '✅ Assignment Approved — "' || COALESCE(v_title, 'your submission') || E'"\n\nGreat work! Your submission has been reviewed and approved. The next lesson is now unlocked. 🚀'
        ELSE '📝 Assignment Needs Revision — "' || COALESCE(v_title, 'your submission') || E'"\n\nYour submission was reviewed and needs some changes before it can be approved.'
      END
      || CASE WHEN COALESCE(NEW.feedback, '') <> ''
           THEN E'\n\nInstructor feedback:\n' || NEW.feedback
           ELSE '' END,
      false
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END; $function$;

-- 4 ── Realtime for the WhatsApp inbox
ALTER TABLE public.whatsapp_messages REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_conversations REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;