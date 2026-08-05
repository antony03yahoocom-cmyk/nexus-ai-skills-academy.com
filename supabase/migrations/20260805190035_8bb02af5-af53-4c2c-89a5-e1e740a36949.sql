-- 1. Signup opt-in defaults to true
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_wa text;
  v_opt boolean;
BEGIN
  v_wa := COALESCE(
    NEW.raw_user_meta_data->>'whatsapp_number',
    NEW.raw_user_meta_data->>'phone',
    ''
  );
  v_opt := COALESCE((NEW.raw_user_meta_data->>'whatsapp_opted_in')::boolean, true);

  INSERT INTO public.profiles (user_id, full_name, phone, whatsapp_number, whatsapp_opted_in, trial_start_date)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    v_wa,
    NULLIF(v_wa, ''),
    (v_wa <> '' AND v_opt),
    now()
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$function$;

-- 2. Automations: support wildcard triggers, and log failures instead of silently swallowing them
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
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-whatsapp-internal-key', COALESCE(v_internal_key, '')
          ),
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
          )::text,
          timeout_milliseconds := 5000
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

-- 3. Scheduler infrastructure
CREATE EXTENSION IF NOT EXISTS pg_cron;

ALTER TABLE public.whatsapp_scheduled
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_wa_scheduled_due ON public.whatsapp_scheduled (status, scheduled_at);