ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;

-- Protect is_banned from self-modification: ensure only admins can change it
CREATE OR REPLACE FUNCTION public.prevent_premium_self_grant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.is_premium := OLD.is_premium;
    NEW.subscription_status := OLD.subscription_status;
    NEW.trial_start_date := OLD.trial_start_date;
    NEW.is_banned := OLD.is_banned;
    IF OLD.trial_course_id IS NOT NULL AND NEW.trial_course_id IS DISTINCT FROM OLD.trial_course_id THEN
      NEW.trial_course_id := OLD.trial_course_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS prevent_premium_self_grant_trigger ON public.profiles;
CREATE TRIGGER prevent_premium_self_grant_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_premium_self_grant();