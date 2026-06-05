
-- ============ COMMUNITY ============
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS media_urls jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill user_id from author_id and drop NOT NULL on author_id
UPDATE public.community_posts SET user_id = author_id WHERE user_id IS NULL;
ALTER TABLE public.community_posts ALTER COLUMN author_id DROP NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_posts TO authenticated;
GRANT ALL ON public.community_posts TO service_role;

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view posts" ON public.community_posts;
CREATE POLICY "Authenticated can view posts" ON public.community_posts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert own post" ON public.community_posts;
CREATE POLICY "Users can insert own post" ON public.community_posts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own post" ON public.community_posts;
CREATE POLICY "Users can update own post" ON public.community_posts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owner or admin delete post" ON public.community_posts;
CREATE POLICY "Owner or admin delete post" ON public.community_posts
  FOR DELETE TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage posts" ON public.community_posts;
CREATE POLICY "Admins manage posts" ON public.community_posts
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- community_post_likes
CREATE TABLE IF NOT EXISTS public.community_post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.community_post_likes TO authenticated;
GRANT ALL ON public.community_post_likes TO service_role;
ALTER TABLE public.community_post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View likes" ON public.community_post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert own like" ON public.community_post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own like" ON public.community_post_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- community_post_comments
CREATE TABLE IF NOT EXISTS public.community_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.community_post_comments TO authenticated;
GRANT ALL ON public.community_post_comments TO service_role;
ALTER TABLE public.community_post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View comments" ON public.community_post_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert own comment" ON public.community_post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner or admin delete comment" ON public.community_post_comments FOR DELETE TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- user_follows
CREATE TABLE IF NOT EXISTS public.user_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL,
  followee_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
GRANT SELECT, INSERT, DELETE ON public.user_follows TO authenticated;
GRANT ALL ON public.user_follows TO service_role;
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View follows" ON public.user_follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert own follow" ON public.user_follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Delete own follow" ON public.user_follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_post_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_post_comments;

-- ============ MARKETPLACE ============

-- Student profiles
CREATE TABLE IF NOT EXISTS public.marketplace_student_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  headline text,
  bio text,
  skills text[] NOT NULL DEFAULT '{}',
  completed_courses text[] NOT NULL DEFAULT '{}',
  certificates text[] NOT NULL DEFAULT '{}',
  whatsapp_number text,
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  availability_status text NOT NULL DEFAULT 'not_available',
  xp_points integer NOT NULL DEFAULT 0,
  rank_title text NOT NULL DEFAULT 'Rookie',
  earnings_total numeric NOT NULL DEFAULT 0,
  profile_views integer NOT NULL DEFAULT 0,
  featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_student_profiles TO authenticated;
GRANT ALL ON public.marketplace_student_profiles TO service_role;
ALTER TABLE public.marketplace_student_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View student profiles" ON public.marketplace_student_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert own student profile" ON public.marketplace_student_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own student profile" ON public.marketplace_student_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete student profile" ON public.marketplace_student_profiles FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Employer profiles
CREATE TABLE IF NOT EXISTS public.marketplace_employer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  company_name text NOT NULL,
  website text,
  logo_url text,
  description text,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_employer_profiles TO authenticated;
GRANT ALL ON public.marketplace_employer_profiles TO service_role;
ALTER TABLE public.marketplace_employer_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View employer profiles" ON public.marketplace_employer_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert own employer profile" ON public.marketplace_employer_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own employer profile" ON public.marketplace_employer_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete employer profile" ON public.marketplace_employer_profiles FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Marketplace portfolio projects
CREATE TABLE IF NOT EXISTS public.marketplace_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  tools_used text[] NOT NULL DEFAULT '{}',
  media_urls text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_projects TO authenticated;
GRANT ALL ON public.marketplace_projects TO service_role;
ALTER TABLE public.marketplace_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View marketplace projects" ON public.marketplace_projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert own marketplace project" ON public.marketplace_projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_user_id);
CREATE POLICY "Update own marketplace project" ON public.marketplace_projects FOR UPDATE TO authenticated USING (auth.uid() = student_user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Delete own marketplace project" ON public.marketplace_projects FOR DELETE TO authenticated USING (auth.uid() = student_user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Opportunities
CREATE TABLE IF NOT EXISTS public.marketplace_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_user_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  opportunity_type text NOT NULL DEFAULT 'freelance',
  location_type text NOT NULL DEFAULT 'remote',
  experience_level text NOT NULL DEFAULT 'entry',
  category text,
  budget_min numeric,
  budget_max numeric,
  currency text NOT NULL DEFAULT 'KES',
  required_skills text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'open',
  featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_opportunities TO authenticated;
GRANT ALL ON public.marketplace_opportunities TO service_role;
ALTER TABLE public.marketplace_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View opportunities" ON public.marketplace_opportunities FOR SELECT TO authenticated USING (status = 'open' OR auth.uid() = employer_user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Employer insert opportunity" ON public.marketplace_opportunities FOR INSERT TO authenticated WITH CHECK (auth.uid() = employer_user_id);
CREATE POLICY "Employer update opportunity" ON public.marketplace_opportunities FOR UPDATE TO authenticated USING (auth.uid() = employer_user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Employer or admin delete opportunity" ON public.marketplace_opportunities FOR DELETE TO authenticated USING (auth.uid() = employer_user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Applications
CREATE TABLE IF NOT EXISTS public.marketplace_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL,
  student_user_id uuid NOT NULL,
  proposal text,
  cover_message text,
  status text NOT NULL DEFAULT 'pending',
  employer_rating integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, student_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_applications TO authenticated;
GRANT ALL ON public.marketplace_applications TO service_role;
ALTER TABLE public.marketplace_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Student view own application" ON public.marketplace_applications FOR SELECT TO authenticated USING (auth.uid() = student_user_id OR EXISTS (SELECT 1 FROM public.marketplace_opportunities o WHERE o.id = opportunity_id AND o.employer_user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Student insert own application" ON public.marketplace_applications FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_user_id);
CREATE POLICY "Employer update application" ON public.marketplace_applications FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.marketplace_opportunities o WHERE o.id = opportunity_id AND o.employer_user_id = auth.uid()) OR auth.uid() = student_user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owner or admin delete application" ON public.marketplace_applications FOR DELETE TO authenticated USING (auth.uid() = student_user_id OR has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger reused
CREATE TRIGGER trg_marketplace_student_profiles_updated BEFORE UPDATE ON public.marketplace_student_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_marketplace_employer_profiles_updated BEFORE UPDATE ON public.marketplace_employer_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_marketplace_opportunities_updated BEFORE UPDATE ON public.marketplace_opportunities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_marketplace_applications_updated BEFORE UPDATE ON public.marketplace_applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
