-- Expand community/networking and notifications backend with idempotent, scalable primitives.
create extension if not exists pgcrypto;

-- Ensure community_posts has required collaboration/support columns.
alter table if exists public.community_posts
  add column if not exists description text,
  add column if not exists post_type text not null default 'progress_update' check (post_type in ('collaboration','showcase','achievement','design','website','ai_project','video','progress_update')),
  add column if not exists tags text[] not null default '{}';

create index if not exists idx_community_posts_type_created_at on public.community_posts(post_type, created_at desc);
create index if not exists idx_community_posts_category_created_at on public.community_posts(category, created_at desc);

-- Saved opportunities for marketplace hub metrics and bookmarks.
create table if not exists public.marketplace_saved_opportunities (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null references public.marketplace_opportunities(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(student_user_id, opportunity_id)
);

alter table public.marketplace_saved_opportunities enable row level security;
create policy if not exists "saved_opportunities_read_own" on public.marketplace_saved_opportunities
  for select using (auth.uid() = student_user_id or public.is_admin(auth.uid()));
create policy if not exists "saved_opportunities_write_own" on public.marketplace_saved_opportunities
  for all using (auth.uid() = student_user_id or public.is_admin(auth.uid())) with check (auth.uid() = student_user_id or public.is_admin(auth.uid()));

create index if not exists idx_saved_opportunities_student_created_at on public.marketplace_saved_opportunities(student_user_id, created_at desc);
create index if not exists idx_saved_opportunities_opportunity on public.marketplace_saved_opportunities(opportunity_id);

-- Notifications core (in-app, email, push, whatsapp-ready channels).
do $$ begin
  create type public.notification_event_type as enum (
    'new_opportunity','new_message','application_update','shortlisted','hired','profile_view','comment','like'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_channel as enum ('in_app','email','push','whatsapp');
exception when duplicate_object then null; end $$;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type public.notification_event_type not null,
  title text not null,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default true,
  push_enabled boolean not null default true,
  whatsapp_enabled boolean not null default false,
  new_opportunity boolean not null default true,
  new_message boolean not null default true,
  application_update boolean not null default true,
  shortlisted boolean not null default true,
  hired boolean not null default true,
  profile_view boolean not null default true,
  comment_like boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel public.notification_channel not null,
  status text not null default 'pending' check (status in ('pending','queued','sent','delivered','failed')),
  provider text,
  provider_message_id text,
  error_message text,
  attempted_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_deliveries enable row level security;

create policy if not exists "notifications_read_own" on public.notifications
  for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy if not exists "notifications_update_own" on public.notifications
  for update using (auth.uid() = user_id or public.is_admin(auth.uid())) with check (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy if not exists "notifications_insert_admin" on public.notifications
  for insert with check (public.is_admin(auth.uid()));

create policy if not exists "notification_preferences_own_all" on public.notification_preferences
  for all using (auth.uid() = user_id or public.is_admin(auth.uid())) with check (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy if not exists "notification_deliveries_read_own" on public.notification_deliveries
  for select using (
    exists(select 1 from public.notifications n where n.id = notification_id and (n.user_id = auth.uid() or public.is_admin(auth.uid())))
  );
create policy if not exists "notification_deliveries_admin_write" on public.notification_deliveries
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create index if not exists idx_notifications_user_created_at on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_user_unread on public.notifications(user_id, is_read);
create index if not exists idx_notification_deliveries_notification on public.notification_deliveries(notification_id, channel);

-- Profile views analytics primitive.
create table if not exists public.marketplace_profile_views (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users(id) on delete cascade,
  viewer_user_id uuid references auth.users(id) on delete set null,
  source text,
  created_at timestamptz not null default now()
);

alter table public.marketplace_profile_views enable row level security;
create policy if not exists "profile_views_select_owner_admin" on public.marketplace_profile_views
  for select using (auth.uid() = student_user_id or public.is_admin(auth.uid()));
create policy if not exists "profile_views_insert_any_auth" on public.marketplace_profile_views
  for insert with check (auth.uid() is not null);

create index if not exists idx_profile_views_student_created_at on public.marketplace_profile_views(student_user_id, created_at desc);

-- Skills & badges primitives.
create table if not exists public.marketplace_skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_badges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  icon_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id uuid not null references public.marketplace_badges(id) on delete cascade,
  awarded_by uuid references auth.users(id) on delete set null,
  awarded_at timestamptz not null default now(),
  unique(user_id, badge_id)
);

alter table public.marketplace_skills enable row level security;
alter table public.marketplace_badges enable row level security;
alter table public.marketplace_user_badges enable row level security;

create policy if not exists "skills_read_all" on public.marketplace_skills for select using (true);
create policy if not exists "skills_admin_write" on public.marketplace_skills for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy if not exists "badges_read_all" on public.marketplace_badges for select using (true);
create policy if not exists "badges_admin_write" on public.marketplace_badges for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy if not exists "user_badges_read_all" on public.marketplace_user_badges for select using (true);
create policy if not exists "user_badges_admin_write" on public.marketplace_user_badges for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create index if not exists idx_user_badges_user on public.marketplace_user_badges(user_id, awarded_at desc);
