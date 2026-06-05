-- Admin moderation fields and report management

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.marketplace_student_profiles
  ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.marketplace_opportunities
  ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'profile', 'opportunity', 'project', 'message', 'group', 'course', 'comment')),
  target_id UUID NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow reporters to manage own reports" ON public.content_reports
  FOR SELECT USING (auth.uid() = reporter_user_id)
  FOR INSERT WITH CHECK (auth.uid() = reporter_user_id)
  FOR UPDATE USING (auth.uid() = reporter_user_id)
  WITH CHECK (auth.uid() = reporter_user_id);

CREATE POLICY IF NOT EXISTS "Admins can manage all reports" ON public.content_reports
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_content_reports_status ON public.content_reports(status);
CREATE INDEX IF NOT EXISTS idx_content_reports_target_type ON public.content_reports(target_type);
CREATE INDEX IF NOT EXISTS idx_opportunities_featured ON public.marketplace_opportunities(featured);
CREATE INDEX IF NOT EXISTS idx_student_profiles_featured ON public.marketplace_student_profiles(featured);
