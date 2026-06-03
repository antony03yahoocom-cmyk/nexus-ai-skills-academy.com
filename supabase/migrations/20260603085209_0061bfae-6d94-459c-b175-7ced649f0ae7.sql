
-- Award XP and update rank when application is accepted (student hired)
CREATE OR REPLACE FUNCTION public.award_xp_on_hire()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    INSERT INTO public.marketplace_student_profiles (user_id, xp_points)
    VALUES (NEW.student_user_id, 100)
    ON CONFLICT (user_id) DO UPDATE SET xp_points = marketplace_student_profiles.xp_points + 100;
  END IF;
  RETURN NEW;
END;
$$;

-- Award XP when a project gets approved
CREATE OR REPLACE FUNCTION public.award_xp_on_project_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'Approved' AND OLD.status IS DISTINCT FROM 'Approved' THEN
    INSERT INTO public.marketplace_student_profiles (user_id, xp_points)
    VALUES (NEW.student_id, 50)
    ON CONFLICT (user_id) DO UPDATE SET xp_points = marketplace_student_profiles.xp_points + 50;
  END IF;
  RETURN NEW;
END;
$$;

-- Update rank_title based on xp_points
CREATE OR REPLACE FUNCTION public.update_rank_title()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.rank_title := CASE
    WHEN NEW.xp_points >= 1000 THEN 'Legend'
    WHEN NEW.xp_points >= 500 THEN 'Pro'
    WHEN NEW.xp_points >= 200 THEN 'Rising Star'
    WHEN NEW.xp_points >= 50 THEN 'Apprentice'
    ELSE 'Rookie'
  END;
  RETURN NEW;
END;
$$;

-- Unique constraint needed for ON CONFLICT
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_student_profiles_user_id_key'
  ) THEN
    ALTER TABLE public.marketplace_student_profiles
      ADD CONSTRAINT marketplace_student_profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_award_xp_on_hire ON public.marketplace_applications;
CREATE TRIGGER trg_award_xp_on_hire
AFTER UPDATE OF status ON public.marketplace_applications
FOR EACH ROW EXECUTE FUNCTION public.award_xp_on_hire();

DROP TRIGGER IF EXISTS trg_award_xp_on_project_approval ON public.projects;
CREATE TRIGGER trg_award_xp_on_project_approval
AFTER UPDATE OF status ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.award_xp_on_project_approval();

DROP TRIGGER IF EXISTS trg_update_rank_title ON public.marketplace_student_profiles;
CREATE TRIGGER trg_update_rank_title
BEFORE INSERT OR UPDATE OF xp_points ON public.marketplace_student_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_rank_title();
