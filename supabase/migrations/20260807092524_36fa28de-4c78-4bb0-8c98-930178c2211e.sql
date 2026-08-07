-- Remove the implicit PUBLIC execute grant from every function in public schema
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

-- Grant back only what the app needs
GRANT EXECUTE ON FUNCTION public.get_platform_stats() TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_course_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_course(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_lesson(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_course_content_object(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_lesson_assignment_approved(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_lesson(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_member_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employer_analytics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.url_decode(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated;