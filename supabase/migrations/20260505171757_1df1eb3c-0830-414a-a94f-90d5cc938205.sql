
-- Account deletion feedback table
CREATE TABLE public.account_deletion_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT,
  full_name TEXT,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.account_deletion_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view deletion feedback"
  ON public.account_deletion_feedback FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert their own deletion feedback"
  ON public.account_deletion_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Track follow-up nudges so we don't spam
CREATE TABLE public.followup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nudge_key TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, nudge_key)
);

ALTER TABLE public.followup_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage followup log"
  ON public.followup_log FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Auto-publish approved projects to portfolio
CREATE OR REPLACE FUNCTION public.auto_publish_approved_project()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'Approved' AND (OLD.status IS DISTINCT FROM 'Approved') THEN
    NEW.public_visibility := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_publish_approved ON public.projects;
CREATE TRIGGER trg_auto_publish_approved
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.auto_publish_approved_project();

-- Backfill: any already-approved projects become visible
UPDATE public.projects SET public_visibility = true WHERE status = 'Approved' AND public_visibility = false;
