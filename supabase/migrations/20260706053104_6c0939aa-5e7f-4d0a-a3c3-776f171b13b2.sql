
CREATE OR REPLACE FUNCTION public.url_decode(txt text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $fn$
DECLARE
  result text := '';
  i int := 1;
  n int;
  c text;
  hex text;
BEGIN
  IF txt IS NULL THEN RETURN NULL; END IF;
  n := length(txt);
  WHILE i <= n LOOP
    c := substr(txt, i, 1);
    IF c = '%' AND i + 2 <= n THEN
      hex := substr(txt, i + 1, 2);
      BEGIN
        result := result || convert_from(decode(hex, 'hex'), 'UTF8');
        i := i + 3;
      EXCEPTION WHEN OTHERS THEN
        result := result || c;
        i := i + 1;
      END;
    ELSIF c = '+' THEN
      result := result || ' ';
      i := i + 1;
    ELSE
      result := result || c;
      i := i + 1;
    END IF;
  END LOOP;
  RETURN result;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.url_decode(text) TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.can_read_course_content_object(p_user_id uuid, p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT
    public.has_role(p_user_id, 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      WHERE l.file_url IS NOT NULL
        AND (
          l.file_url LIKE '%/course-content/' || p_object_name
          OR public.url_decode(l.file_url) LIKE '%/course-content/' || p_object_name
        )
        AND public.has_course_access(p_user_id, m.course_id)
    );
$fn$;
