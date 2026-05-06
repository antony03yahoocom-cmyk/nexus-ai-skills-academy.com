
-- 1. Recreate view without SECURITY DEFINER (use security_invoker)
DROP VIEW IF EXISTS public.course_modules_with_lessons;
CREATE VIEW public.course_modules_with_lessons
WITH (security_invoker = true) AS
SELECT m.id AS module_id, m.title AS module_title,
       l.id AS lesson_id, l.title AS lesson_title
FROM public.modules m
LEFT JOIN public.lessons l ON l.module_id = m.id
ORDER BY m.order_index, l.order_index;

-- 2. Tighten permissive RLS policies (USING true / WITH CHECK true on write ops)

-- testimonials: replace blanket service_role-style ALL policy with admin-only
DROP POLICY IF EXISTS "Service role all testimonials" ON public.testimonials;
CREATE POLICY "Admins manage testimonials"
ON public.testimonials FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- site_feedback: restrict admin read/update to actual admins
DROP POLICY IF EXISTS "Admin read feedback" ON public.site_feedback;
DROP POLICY IF EXISTS "Admin update feedback" ON public.site_feedback;
CREATE POLICY "Admins read feedback"
ON public.site_feedback FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update feedback"
ON public.site_feedback FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Revoke EXECUTE on SECURITY DEFINER functions from anon & authenticated.
--    Trigger functions don't need direct execute. Helpers used inside RLS
--    still work because RLS evaluates as table owner regardless of EXECUTE grants.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.auto_publish_approved_project() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_new_course() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_payment_success() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.prevent_premium_self_grant() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.protect_premium_fields() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.restrict_enrollment_update() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.can_access_course(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.can_access_lesson(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_next_lesson(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_course_access(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated, public;
