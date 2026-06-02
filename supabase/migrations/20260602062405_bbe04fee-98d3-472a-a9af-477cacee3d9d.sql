
-- =========================================================
-- 1. NOTIFICATIONS TABLE (referenced by app but missing)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  title text NOT NULL,
  message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id) WHERE is_read = false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System and admins insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR auth.uid() IS NOT NULL);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- =========================================================
-- 2. SAVED OPPORTUNITIES (bookmark)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.marketplace_saved_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  opportunity_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, opportunity_id)
);

GRANT SELECT, INSERT, DELETE ON public.marketplace_saved_opportunities TO authenticated;
GRANT ALL ON public.marketplace_saved_opportunities TO service_role;

ALTER TABLE public.marketplace_saved_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own saved opportunities"
  ON public.marketplace_saved_opportunities FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Save own opportunity"
  ON public.marketplace_saved_opportunities FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Unsave own opportunity"
  ON public.marketplace_saved_opportunities FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- =========================================================
-- 3. CONTENT REPORTS (trust & safety)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);

CREATE INDEX IF NOT EXISTS idx_content_reports_status ON public.content_reports(status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.content_reports TO authenticated;
GRANT ALL ON public.content_reports TO service_role;

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own reports"
  ON public.content_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Reporter or admin view"
  ON public.content_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update reports"
  ON public.content_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================================
-- 4. PROFILE VIEWS (engagement)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.marketplace_profile_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_user_id uuid NOT NULL,
  viewer_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_views_profile ON public.marketplace_profile_views(profile_user_id, created_at DESC);

GRANT SELECT, INSERT ON public.marketplace_profile_views TO authenticated;
GRANT ALL ON public.marketplace_profile_views TO service_role;

ALTER TABLE public.marketplace_profile_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profile owner or admin view"
  ON public.marketplace_profile_views FOR SELECT TO authenticated
  USING (auth.uid() = profile_user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone authenticated insert view"
  ON public.marketplace_profile_views FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- =========================================================
-- 5. TRIGGERS: auto-create notifications
-- =========================================================

-- New application -> notify employer
CREATE OR REPLACE FUNCTION public.notify_new_application()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_employer_id uuid;
  v_title text;
BEGIN
  SELECT employer_user_id, title INTO v_employer_id, v_title
  FROM public.marketplace_opportunities WHERE id = NEW.opportunity_id;
  IF v_employer_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, event_type, title, message, metadata)
    VALUES (v_employer_id, 'application_update',
      'New application received',
      'You have a new applicant for "' || COALESCE(v_title, 'your opportunity') || '"',
      jsonb_build_object('link', '/employer/dashboard', 'application_id', NEW.id, 'opportunity_id', NEW.opportunity_id));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_application ON public.marketplace_applications;
CREATE TRIGGER trg_notify_new_application
AFTER INSERT ON public.marketplace_applications
FOR EACH ROW EXECUTE FUNCTION public.notify_new_application();

-- Application status change -> notify student
CREATE OR REPLACE FUNCTION public.notify_application_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_title text;
  v_event text;
  v_msg text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT title INTO v_title FROM public.marketplace_opportunities WHERE id = NEW.opportunity_id;
    v_event := CASE NEW.status
      WHEN 'shortlisted' THEN 'shortlisted'
      WHEN 'accepted' THEN 'hired'
      ELSE 'application_update' END;
    v_msg := CASE NEW.status
      WHEN 'shortlisted' THEN '🎉 You were shortlisted for "' || COALESCE(v_title,'an opportunity') || '"'
      WHEN 'accepted' THEN '🚀 You were hired for "' || COALESCE(v_title,'an opportunity') || '"'
      WHEN 'rejected' THEN 'Your application for "' || COALESCE(v_title,'an opportunity') || '" was not selected this time.'
      WHEN 'viewed' THEN 'An employer viewed your application for "' || COALESCE(v_title,'an opportunity') || '"'
      ELSE 'Your application status was updated.' END;
    INSERT INTO public.notifications (user_id, event_type, title, message, metadata)
    VALUES (NEW.student_user_id, v_event, 'Application update', v_msg,
      jsonb_build_object('link', '/opportunities/' || NEW.opportunity_id, 'status', NEW.status));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_application_status ON public.marketplace_applications;
CREATE TRIGGER trg_notify_application_status
AFTER UPDATE ON public.marketplace_applications
FOR EACH ROW EXECUTE FUNCTION public.notify_application_status();

-- New opportunity -> notify available students (sample broadcast: top 200)
CREATE OR REPLACE FUNCTION public.notify_new_opportunity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'open' THEN
    INSERT INTO public.notifications (user_id, event_type, title, message, metadata)
    SELECT sp.user_id, 'new_opportunity',
      'New opportunity: ' || NEW.title,
      LEFT(COALESCE(NEW.description,''), 140),
      jsonb_build_object('link', '/opportunities/' || NEW.id, 'opportunity_id', NEW.id)
    FROM public.marketplace_student_profiles sp
    WHERE sp.availability_status IN ('available_for_work','available_for_internship','available_for_collaboration')
    LIMIT 500;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_opportunity ON public.marketplace_opportunities;
CREATE TRIGGER trg_notify_new_opportunity
AFTER INSERT ON public.marketplace_opportunities
FOR EACH ROW EXECUTE FUNCTION public.notify_new_opportunity();

-- Profile view counter
CREATE OR REPLACE FUNCTION public.bump_profile_view_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.marketplace_student_profiles
  SET profile_views = COALESCE(profile_views,0) + 1
  WHERE user_id = NEW.profile_user_id;
  -- Optional notification (don't notify on self-view)
  IF NEW.viewer_user_id IS NOT NULL AND NEW.viewer_user_id <> NEW.profile_user_id THEN
    INSERT INTO public.notifications (user_id, event_type, title, message, metadata)
    VALUES (NEW.profile_user_id, 'profile_view', 'Someone viewed your profile',
      'Your marketplace profile got a new visitor.',
      jsonb_build_object('link', '/marketplace'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_profile_view ON public.marketplace_profile_views;
CREATE TRIGGER trg_bump_profile_view
AFTER INSERT ON public.marketplace_profile_views
FOR EACH ROW EXECUTE FUNCTION public.bump_profile_view_count();
