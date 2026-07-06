
-- Helper to check membership without recursive RLS
CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group_id AND user_id = _user_id
  );
$$;

-- Aggregate counts function (safe to expose to authenticated users)
CREATE OR REPLACE FUNCTION public.get_group_member_counts()
RETURNS TABLE(group_id uuid, member_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT group_id, COUNT(*)::bigint FROM public.group_members GROUP BY group_id;
$$;

GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_member_counts() TO authenticated;

-- Replace overly permissive SELECT policy: only members of a group (or platform admins) can see its raw membership rows
DROP POLICY IF EXISTS "Anyone can count group members" ON public.group_members;

CREATE POLICY "Members can view their group's members"
ON public.group_members
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_group_member(group_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);
