
-- 1. Allow students to set their trial_course_id ONCE; everything else still locked.
CREATE OR REPLACE FUNCTION public.prevent_premium_self_grant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.is_premium := OLD.is_premium;
    NEW.subscription_status := OLD.subscription_status;
    NEW.trial_start_date := OLD.trial_start_date;
    -- Allow setting trial_course_id only if it was NULL (first-time selection)
    IF OLD.trial_course_id IS NOT NULL AND NEW.trial_course_id IS DISTINCT FROM OLD.trial_course_id THEN
      NEW.trial_course_id := OLD.trial_course_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Ensure trigger exists on profiles
DROP TRIGGER IF EXISTS trg_prevent_premium_self_grant ON public.profiles;
CREATE TRIGGER trg_prevent_premium_self_grant
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_premium_self_grant();

-- 2. Promo codes
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_percent INT NOT NULL CHECK (discount_percent BETWEEN 1 AND 100),
  course_id UUID,
  max_uses INT DEFAULT 0,
  uses INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage promo_codes" ON public.promo_codes
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can read active promo_codes" ON public.promo_codes
FOR SELECT TO authenticated
USING (is_active = true);

-- 3. App settings
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read app_settings" ON public.app_settings
FOR SELECT USING (true);
CREATE POLICY "Admins manage app_settings" ON public.app_settings
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed some defaults
INSERT INTO public.app_settings(key, value) VALUES
  ('whatsapp_group_url', '"https://chat.whatsapp.com/GdHfJutCYlX7xitn3gC71o"'::jsonb),
  ('platform_announcement', '""'::jsonb)
ON CONFLICT (key) DO NOTHING;
