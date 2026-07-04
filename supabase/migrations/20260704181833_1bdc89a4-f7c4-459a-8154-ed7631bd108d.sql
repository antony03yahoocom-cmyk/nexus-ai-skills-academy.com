-- Backend-only config table (no anon/authenticated GRANT ⇒ not reachable via PostgREST)
CREATE TABLE IF NOT EXISTS public.wa_admin_config (
  id boolean PRIMARY KEY DEFAULT true,
  supabase_url text,
  internal_key text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wa_admin_config_singleton CHECK (id = true)
);

-- Intentionally NO grants to anon/authenticated — only service_role and SECURITY DEFINER functions read it.
GRANT ALL ON public.wa_admin_config TO service_role;
ALTER TABLE public.wa_admin_config ENABLE ROW LEVEL SECURITY;

-- Rewire existing WhatsApp notification trigger to read from the config table
CREATE OR REPLACE FUNCTION public.trigger_whatsapp_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone         text;
  v_opted_in      boolean;
  v_supabase_url  text;
  v_internal_key  text;
BEGIN
  SELECT whatsapp_number, whatsapp_opted_in
  INTO v_phone, v_opted_in
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  IF v_phone IS NULL OR NOT COALESCE(v_opted_in, false) THEN
    RETURN NEW;
  END IF;

  SELECT supabase_url, internal_key INTO v_supabase_url, v_internal_key
  FROM public.wa_admin_config WHERE id = true;

  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_supabase_url || '/functions/v1/send-whatsapp',
    headers := jsonb_build_object(
      'Content-Type',             'application/json',
      'x-whatsapp-internal-key',  COALESCE(v_internal_key, '')
    ),
    body    := jsonb_build_object(
      'notification_id', NEW.id,
      'user_id',         NEW.user_id,
      'event_type',      NEW.event_type,
      'title',           NEW.title,
      'message',         COALESCE(NEW.message, ''),
      'metadata',        COALESCE(NEW.metadata, '{}'::jsonb),
      'phone_number',    v_phone
    )::text,
    timeout_milliseconds := 5000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- Rewire the automation trigger to also use the config table
CREATE OR REPLACE FUNCTION public.fire_whatsapp_automations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text;
  v_internal_key text;
  v_auto record;
  v_profile record;
  v_tpl record;
  v_scheduled_at timestamptz;
BEGIN
  SELECT supabase_url, internal_key INTO v_supabase_url, v_internal_key
  FROM public.wa_admin_config WHERE id = true;
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
          'phone',   v_profile.whatsapp_number,
          'name',    v_profile.full_name
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
