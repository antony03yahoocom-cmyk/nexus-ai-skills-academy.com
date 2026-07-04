-- 1) Manual contacts table for admins to message people without accounts
CREATE TABLE IF NOT EXISTS public.whatsapp_manual_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone_number text NOT NULL,
  email text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_manual_contacts_phone_unique UNIQUE (phone_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_manual_contacts TO authenticated;
GRANT ALL ON public.whatsapp_manual_contacts TO service_role;

ALTER TABLE public.whatsapp_manual_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage manual contacts" ON public.whatsapp_manual_contacts;
CREATE POLICY "Admins manage manual contacts"
  ON public.whatsapp_manual_contacts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_manual_contacts_updated ON public.whatsapp_manual_contacts;
CREATE TRIGGER trg_manual_contacts_updated
  BEFORE UPDATE ON public.whatsapp_manual_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Automation engine — fire matching WhatsApp automations on new notifications
CREATE OR REPLACE FUNCTION public.fire_whatsapp_automations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text := current_setting('app.supabase_url', true);
  v_internal_key text := current_setting('app.internal_whatsapp_key', true);
  v_auto record;
  v_profile record;
  v_tpl record;
  v_scheduled_at timestamptz;
BEGIN
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    RETURN NEW;
  END IF;

  SELECT user_id, whatsapp_number, COALESCE(whatsapp_opted_in, false) AS opted, full_name
    INTO v_profile
    FROM public.profiles WHERE user_id = NEW.user_id;

  IF v_profile.whatsapp_number IS NULL OR NOT v_profile.opted THEN
    RETURN NEW;
  END IF;

  FOR v_auto IN
    SELECT * FROM public.whatsapp_automations
    WHERE enabled = true AND event_trigger = NEW.event_type AND template_id IS NOT NULL
  LOOP
    SELECT * INTO v_tpl FROM public.whatsapp_templates
      WHERE id = v_auto.template_id AND status = 'APPROVED';
    IF NOT FOUND THEN CONTINUE; END IF;

    IF v_auto.delay_minutes > 0 THEN
      v_scheduled_at := now() + (v_auto.delay_minutes || ' minutes')::interval;
      INSERT INTO public.whatsapp_scheduled (template_id, template_vars, recipients, schedule_type, scheduled_at, created_by, status)
      VALUES (
        v_tpl.id,
        v_auto.template_vars,
        jsonb_build_array(jsonb_build_object(
          'user_id', v_profile.user_id,
          'phone', v_profile.whatsapp_number,
          'name', v_profile.full_name
        )),
        'once', v_scheduled_at, v_auto.created_by, 'queued'
      );
      INSERT INTO public.whatsapp_automation_logs(automation_id, event_trigger, student_user_id, phone_number, template_name, status)
      VALUES (v_auto.id, NEW.event_type, v_profile.user_id, v_profile.whatsapp_number, v_tpl.name, 'scheduled');
    ELSE
      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/whatsapp-admin',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-whatsapp-internal-key', COALESCE(v_internal_key, '')
        ),
        body := jsonb_build_object(
          'action', 'send_template',
          'template_id', v_tpl.id,
          'recipients', jsonb_build_array(jsonb_build_object(
            'user_id', v_profile.user_id,
            'phone', v_profile.whatsapp_number,
            'name', v_profile.full_name
          )),
          'vars', v_auto.template_vars,
          'automation_id', v_auto.id
        )::text,
        timeout_milliseconds := 5000
      );
      INSERT INTO public.whatsapp_automation_logs(automation_id, event_trigger, student_user_id, phone_number, template_name, status)
      VALUES (v_auto.id, NEW.event_type, v_profile.user_id, v_profile.whatsapp_number, v_tpl.name, 'sent');
    END IF;

    UPDATE public.whatsapp_automations
    SET runs_count = runs_count + 1, last_run_at = now()
    WHERE id = v_auto.id;
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_fire_whatsapp_automations ON public.notifications;
CREATE TRIGGER trg_fire_whatsapp_automations
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.fire_whatsapp_automations();
