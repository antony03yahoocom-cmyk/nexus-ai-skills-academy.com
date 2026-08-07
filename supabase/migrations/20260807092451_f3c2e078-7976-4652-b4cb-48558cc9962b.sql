-- 1) Assignment files: remove public read
DROP POLICY IF EXISTS "Public read access for assignment files" ON storage.objects;

-- 2) Public buckets: remove broad listing policies (public URLs keep working)
DROP POLICY IF EXISTS "Public read access for avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view project files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view group files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view employer assets" ON storage.objects;

-- 3) Fix mutable search_path
ALTER FUNCTION public.trigger_set_timestamp() SET search_path = public;
ALTER FUNCTION public.add_read_to_message(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.fetch_trending_posts(integer) SET search_path = public;
ALTER FUNCTION public.get_posts_for_user(uuid, integer) SET search_path = public;

-- 4) Revoke EXECUTE on trigger functions from API roles
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated', r.sig);
  END LOOP;
END $$;

-- 5) Revoke internal / unused SECURITY DEFINER helpers from API roles
REVOKE ALL ON FUNCTION public.resend_whatsapp_notification(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_opportunity_views(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_profile() FROM anon;
REVOKE ALL ON FUNCTION public.add_read_to_message(uuid, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.fetch_trending_posts(integer) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.get_posts_for_user(uuid, integer) FROM anon, authenticated;

-- 6) Anonymous callers lose access to authenticated-only helpers
REVOKE ALL ON FUNCTION public.can_read_course_content_object(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE ALL ON FUNCTION public.is_group_member(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_lesson_assignment_approved(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_employer_analytics(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_group_member_counts() FROM anon;
REVOKE ALL ON FUNCTION public.get_whatsapp_analytics() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.url_decode(text) FROM anon;

-- 7) Public feedback: bounded input instead of unconditional true
DROP POLICY IF EXISTS "Anyone submit feedback" ON public.site_feedback;
CREATE POLICY "Anyone submit bounded feedback" ON public.site_feedback
FOR INSERT TO anon, authenticated
WITH CHECK (
  length(message) BETWEEN 5 AND 4000
  AND (name IS NULL OR length(name) <= 120)
  AND (email IS NULL OR length(email) <= 200)
  AND (category IS NULL OR length(category) <= 60)
  AND COALESCE(is_read, false) = false
);

-- 8) Legacy/unused tables with RLS and no policies: remove all API access
REVOKE ALL ON public.conversations, public.conversation_members, public.messages,
  public.message_attachments, public.follows, public.post_likes, public.post_comments,
  public.post_attachments, public.user_presence, public.wa_admin_config
  FROM anon, authenticated;

COMMENT ON TABLE public.wa_admin_config IS 'Holds WhatsApp gateway credentials. Server-side (service_role) access only; no API grants.';