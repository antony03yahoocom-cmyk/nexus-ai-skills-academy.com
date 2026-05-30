-- Aggregate marketplace hub data in one RPC to remove client-side query waterfalls.
create or replace function public.get_marketplace_student_hub(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'profile', (
      select to_jsonb(msp)
      from public.marketplace_student_profiles msp
      where msp.user_id = p_user_id
      limit 1
    ),
    'projects', coalesce((
      select jsonb_agg(to_jsonb(mp) order by mp.created_at desc)
      from (
        select *
        from public.marketplace_projects
        where student_user_id = p_user_id
        order by created_at desc
        limit 6
      ) mp
    ), '[]'::jsonb),
    'applications', coalesce((
      select jsonb_agg(to_jsonb(ma) || jsonb_build_object('marketplace_opportunities', jsonb_build_object('title', mo.title)) order by ma.created_at desc)
      from (
        select *
        from public.marketplace_applications
        where student_user_id = p_user_id
        order by created_at desc
        limit 25
      ) ma
      left join public.marketplace_opportunities mo on mo.id = ma.opportunity_id
    ), '[]'::jsonb),
    'saved_opportunities_count', (
      select count(*)
      from public.marketplace_saved_opportunities mso
      where mso.student_user_id = p_user_id
    ),
    'testimonials', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.created_at desc)
      from (
        select *
        from public.testimonials
        where is_published = true
        order by created_at desc
        limit 3
      ) t
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.get_marketplace_student_hub(uuid) to authenticated;

-- Keep opportunity applicant counts accurate for real posting/application flows.
create or replace function public.refresh_marketplace_applicants_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    update public.marketplace_opportunities
    set applicants_count = (
      select count(*) from public.marketplace_applications where opportunity_id = new.opportunity_id
    )
    where id = new.opportunity_id;
  end if;

  if tg_op in ('DELETE', 'UPDATE') then
    update public.marketplace_opportunities
    set applicants_count = (
      select count(*) from public.marketplace_applications where opportunity_id = old.opportunity_id
    )
    where id = old.opportunity_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_refresh_marketplace_applicants_count on public.marketplace_applications;
create trigger trg_refresh_marketplace_applicants_count
after insert or update of opportunity_id or delete on public.marketplace_applications
for each row execute function public.refresh_marketplace_applicants_count();
