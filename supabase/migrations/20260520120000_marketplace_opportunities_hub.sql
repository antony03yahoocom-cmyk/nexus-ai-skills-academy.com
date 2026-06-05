-- Marketplace & Opportunities Hub core schema
create extension if not exists pgcrypto;

create table if not exists public.marketplace_student_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  headline text,
  bio text,
  skills text[] not null default '{}',
  completed_courses text[] not null default '{}',
  certificates text[] not null default '{}',
  social_links jsonb not null default '{}'::jsonb,
  whatsapp_number text,
  availability_status text not null default 'not_available' check (availability_status in ('available_for_work','available_for_internship','available_for_collaboration','not_available')),
  xp_points integer not null default 0,
  level integer not null default 1,
  rank_title text not null default 'Rookie',
  earnings_total numeric not null default 0,
  profile_views integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_employer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  company_name text not null,
  industry text,
  website text,
  about text,
  contact_email text,
  contact_phone text,
  logo_url text,
  banner_url text,
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_projects (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  tools_used text[] not null default '{}',
  live_demo_url text,
  github_url text,
  behance_url text,
  dribbble_url text,
  completion_date date,
  media_urls text[] not null default '{}',
  featured boolean not null default false,
  likes_count integer not null default 0,
  views_count integer not null default 0,
  comments_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_opportunities (
  id uuid primary key default gen_random_uuid(),
  employer_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null,
  category text not null,
  opportunity_type text not null check (opportunity_type in ('freelance','job','internship','collaboration','contest','ai_task','remote_task')),
  required_skills text[] not null default '{}',
  budget_min numeric,
  budget_max numeric,
  currency text not null default 'KES',
  location_type text not null default 'remote' check (location_type in ('remote','on_site','hybrid')),
  experience_level text not null default 'beginner' check (experience_level in ('beginner','intermediate','advanced')),
  duration text,
  deadline timestamptz,
  attachments text[] not null default '{}',
  status text not null default 'open' check (status in ('open','closed','draft')),
  views_count integer not null default 0,
  applicants_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.marketplace_opportunities(id) on delete cascade,
  student_user_id uuid not null references auth.users(id) on delete cascade,
  proposal text not null,
  cover_message text,
  portfolio_links text[] not null default '{}',
  attachment_urls text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','viewed','shortlisted','accepted','rejected')),
  employer_rating integer check (employer_rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(opportunity_id, student_user_id)
);

alter table public.marketplace_student_profiles enable row level security;
alter table public.marketplace_employer_profiles enable row level security;
alter table public.marketplace_projects enable row level security;
alter table public.marketplace_opportunities enable row level security;
alter table public.marketplace_applications enable row level security;

create or replace function public.is_admin(_uid uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.user_roles where user_id = _uid and role='admin') $$;

-- Student profiles
create policy if not exists "student_profiles_read_all" on public.marketplace_student_profiles for select using (true);
create policy if not exists "student_profiles_self_write" on public.marketplace_student_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "student_profiles_admin_write" on public.marketplace_student_profiles for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Employer profiles
create policy if not exists "employer_profiles_read_all" on public.marketplace_employer_profiles for select using (true);
create policy if not exists "employer_profiles_self_write" on public.marketplace_employer_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "employer_profiles_admin_write" on public.marketplace_employer_profiles for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy if not exists "projects_read_all" on public.marketplace_projects for select using (true);
create policy if not exists "projects_self_write" on public.marketplace_projects for all using (auth.uid() = student_user_id) with check (auth.uid() = student_user_id);
create policy if not exists "projects_admin_write" on public.marketplace_projects for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy if not exists "opportunities_read_all" on public.marketplace_opportunities for select using (true);
create policy if not exists "opportunities_employer_write" on public.marketplace_opportunities for all using (auth.uid() = employer_user_id) with check (auth.uid() = employer_user_id);
create policy if not exists "opportunities_admin_write" on public.marketplace_opportunities for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy if not exists "applications_read_own_or_owner" on public.marketplace_applications for select using (
  auth.uid() = student_user_id or exists(select 1 from public.marketplace_opportunities o where o.id = opportunity_id and o.employer_user_id = auth.uid()) or public.is_admin(auth.uid())
);
create policy if not exists "applications_student_insert" on public.marketplace_applications for insert with check (auth.uid() = student_user_id);
create policy if not exists "applications_student_update" on public.marketplace_applications for update using (auth.uid() = student_user_id) with check (auth.uid() = student_user_id);
create policy if not exists "applications_employer_update" on public.marketplace_applications for update using (
  exists(select 1 from public.marketplace_opportunities o where o.id = opportunity_id and o.employer_user_id = auth.uid()) or public.is_admin(auth.uid())
) with check (true);

create index if not exists idx_opportunities_created on public.marketplace_opportunities(created_at desc);
create index if not exists idx_opportunities_type on public.marketplace_opportunities(opportunity_type);
create index if not exists idx_opportunities_skills on public.marketplace_opportunities using gin(required_skills);
create index if not exists idx_projects_student on public.marketplace_projects(student_user_id, created_at desc);
create index if not exists idx_applications_opp on public.marketplace_applications(opportunity_id);
