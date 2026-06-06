
CREATE OR REPLACE VIEW public.modules_public
WITH (security_invoker = true) AS
SELECT m.id, m.course_id, m.title, m.sort_order, m.order_index, m.created_at
FROM public.modules m
JOIN public.courses c ON c.id = m.course_id
WHERE c.is_published = true;

CREATE OR REPLACE VIEW public.lessons_public
WITH (security_invoker = true) AS
SELECT l.id, l.module_id, l.title, l.content_type, l.sort_order, l.order_index,
       l.week_number, l.day_number, l.created_at
FROM public.lessons l
JOIN public.modules m ON m.id = l.module_id
JOIN public.courses c ON c.id = m.course_id
WHERE c.is_published = true;

-- Allow modules + lessons base SELECT to anon/authenticated ONLY for published courses,
-- so the security_invoker views work for everyone. The lessons base table also keeps the
-- enrollment-gated policy for full content reads (we expose only safe cols in the view).
DROP POLICY IF EXISTS "Public can view modules of published courses" ON public.modules;
CREATE POLICY "Public can view modules of published courses"
  ON public.modules FOR SELECT
  TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = modules.course_id AND c.is_published = true));

DROP POLICY IF EXISTS "Public can view lesson metadata of published courses" ON public.lessons;
CREATE POLICY "Public can view lesson metadata of published courses"
  ON public.lessons FOR SELECT
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.modules m
    JOIN public.courses c ON c.id = m.course_id
    WHERE m.id = lessons.module_id AND c.is_published = true
  ));

GRANT SELECT ON public.modules_public TO anon, authenticated;
GRANT SELECT ON public.lessons_public TO anon, authenticated;
