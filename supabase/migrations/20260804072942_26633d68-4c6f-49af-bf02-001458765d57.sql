
CREATE OR REPLACE FUNCTION public.protect_student_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND auth.uid() = OLD.user_id
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.earnings_total := OLD.earnings_total;
    NEW.xp_points := OLD.xp_points;
    NEW.rank_title := OLD.rank_title;
    NEW.profile_views := OLD.profile_views;
    NEW.featured := OLD.featured;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_student_profile_fields ON public.marketplace_student_profiles;
CREATE TRIGGER trg_protect_student_profile_fields
BEFORE UPDATE ON public.marketplace_student_profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_student_profile_fields();

CREATE OR REPLACE FUNCTION public.protect_employer_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.verified := OLD.verified;
    NEW.featured := OLD.featured;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_employer_profile_fields ON public.marketplace_employer_profiles;
CREATE TRIGGER trg_protect_employer_profile_fields
BEFORE UPDATE ON public.marketplace_employer_profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_employer_profile_fields();

CREATE OR REPLACE FUNCTION public.protect_opportunity_featured()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.featured := OLD.featured;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_opportunity_featured ON public.marketplace_opportunities;
CREATE TRIGGER trg_protect_opportunity_featured
BEFORE UPDATE ON public.marketplace_opportunities
FOR EACH ROW EXECUTE FUNCTION public.protect_opportunity_featured();

REVOKE EXECUTE ON FUNCTION public.protect_student_profile_fields() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_employer_profile_fields() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_opportunity_featured() FROM anon, authenticated;
