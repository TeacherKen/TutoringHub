-- TutoringHub — Phase 1 database
-- Run this once in Supabase: SQL Editor → New query → paste → Run.
--
-- Security model
--   * Every table has Row Level Security (RLS) switched on.
--   * The tutor can read and change everything.
--   * The viewer (family member) can NOT read any table directly. The only
--     thing a viewer can call is viewer_schedule(), which returns times,
--     first names, onsite/online and place — nothing else.
--   * private_settings (the secret calendar link) has NO policies at all, so
--     only the server (service role key) can read it. Browsers never can.
--   * parent and student roles exist for Phase 2/3 but have no access yet.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Who may sign in
-- ---------------------------------------------------------------------------
create table public.app_users (
  email        text primary key check (email = lower(email)),
  role         text not null check (role in ('tutor', 'viewer', 'parent', 'student')),
  display_name text,
  created_at   timestamptz not null default now()
);

create or replace function public.current_app_role()
returns text
language sql stable security definer
set search_path = public
as $$
  -- Only trust emails that came from Google sign-in (not email/password sign-up).
  select role from public.app_users
  where email = lower(coalesce(auth.jwt() ->> 'email', ''))
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', '') = 'google'
$$;

create or replace function public.is_tutor()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = 'tutor', false)
$$;

-- ---------------------------------------------------------------------------
-- Hour accounts: one per student, or one shared by siblings
-- ---------------------------------------------------------------------------
create table public.hour_accounts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Students (first name / nickname only — no surnames)
-- ---------------------------------------------------------------------------
create table public.students (
  id              uuid primary key default gen_random_uuid(),
  first_name      text not null check (length(trim(first_name)) > 0),
  level           text,
  parent_name     text,
  contact_app     text check (contact_app in ('whatsapp', 'line', 'wechat', 'other')),
  contact         text,
  mode            text not null default 'onsite' check (mode in ('onsite', 'online')),
  source          text not null default 'private' check (source in ('private', 'preply')),
  place           text,
  keywords        text[] not null default '{}',
  book            text,
  private_notes   text,
  active          boolean not null default true,
  hour_account_id uuid references public.hour_accounts(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Lessons (one row per calendar occurrence) + the tutor's notes
-- ---------------------------------------------------------------------------
create table public.lessons (
  id              uuid primary key default gen_random_uuid(),
  event_uid       text not null,
  occurrence_key  text not null,
  start_at        timestamptz not null,
  end_at          timestamptz not null,
  title           text,
  location        text,
  is_preply       boolean not null default false,
  in_calendar     boolean not null default true,
  ignored         boolean not null default false,
  students_locked boolean not null default false,
  status          text not null default 'scheduled'
                  check (status in ('scheduled', 'done', 'cancelled', 'cancelled_charged', 'no_show')),
  length_hours    numeric(5, 2) check (length_hours is null or length_hours >= 0),
  learned         text,
  next_time       text,
  homework        text,
  how_it_went     text check (how_it_went in ('great', 'good', 'needs_practice')),
  topics          text[] not null default '{}',
  final_message   text,
  sent_at         timestamptz,
  note_updated_at timestamptz,
  created_at      timestamptz not null default now(),
  unique (event_uid, occurrence_key)
);
create index lessons_start_idx on public.lessons (start_at);

create table public.lesson_students (
  lesson_id    uuid not null references public.lessons(id) on delete cascade,
  student_id   uuid not null references public.students(id) on delete cascade,
  match_source text not null default 'auto' check (match_source in ('auto', 'manual')),
  uses_hours   boolean not null default true,
  primary key (lesson_id, student_id)
);
create index lesson_students_student_idx on public.lesson_students (student_id);

create table public.lesson_materials (
  id           uuid primary key default gen_random_uuid(),
  lesson_id    uuid not null references public.lessons(id) on delete cascade,
  kind         text not null check (kind in ('canva', 'pdf', 'photo', 'link')),
  url          text,
  storage_path text,
  label        text,
  created_at   timestamptz not null default now(),
  check (url is not null or storage_path is not null)
);

-- ---------------------------------------------------------------------------
-- Packages (Thai baht) and manual adjustments
-- ---------------------------------------------------------------------------
create table public.packages (
  id              uuid primary key default gen_random_uuid(),
  hour_account_id uuid not null references public.hour_accounts(id) on delete cascade,
  hours           numeric(6, 2) not null check (hours > 0),
  price_thb       numeric(10, 2) check (price_thb is null or price_thb >= 0),
  paid_on         date,
  paid_by         text check (paid_by in ('bank_transfer', 'cash', 'preply', 'other')),
  start_date      date not null,
  note            text,
  created_at      timestamptz not null default now()
);

create table public.hour_adjustments (
  id              uuid primary key default gen_random_uuid(),
  hour_account_id uuid not null references public.hour_accounts(id) on delete cascade,
  hours           numeric(6, 2) not null check (hours <> 0),
  reason          text not null check (length(trim(reason)) > 0),
  adjusted_on     date not null default current_date,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
create table public.settings (
  id                  int primary key default 1 check (id = 1),
  prompt_template     text,
  tone                text not null default 'warm',
  allow_emoji         boolean not null default false,
  low_hours_threshold numeric(5, 2) not null default 2,
  calendar_connected  boolean not null default false,
  last_synced_at      timestamptz,
  last_attempt_at     timestamptz,
  last_sync_error     text
);
insert into public.settings (id) values (1);

-- The secret calendar link lives here. RLS on + no policies = server only.
create table public.private_settings (
  id       int primary key default 1 check (id = 1),
  ical_url text
);
insert into public.private_settings (id) values (1);

-- ---------------------------------------------------------------------------
-- Ready for later phases (no screens yet)
-- ---------------------------------------------------------------------------
create table public.parent_links (
  parent_email text not null check (parent_email = lower(parent_email)),
  student_id   uuid not null references public.students(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (parent_email, student_id)
);

create table public.student_logins (
  login_email text primary key check (login_email = lower(login_email)),
  student_id  uuid not null references public.students(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table public.skill_topics (
  id     uuid primary key default gen_random_uuid(),
  level  text not null,
  strand text,
  name   text not null,
  sort   int not null default 0
);

create table public.quiz_results (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  topic      text,
  score      int,
  out_of     int,
  taken_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.app_users        enable row level security;
alter table public.hour_accounts    enable row level security;
alter table public.students         enable row level security;
alter table public.lessons          enable row level security;
alter table public.lesson_students  enable row level security;
alter table public.lesson_materials enable row level security;
alter table public.packages         enable row level security;
alter table public.hour_adjustments enable row level security;
alter table public.settings         enable row level security;
alter table public.private_settings enable row level security;
alter table public.parent_links     enable row level security;
alter table public.student_logins   enable row level security;
alter table public.skill_topics     enable row level security;
alter table public.quiz_results     enable row level security;

-- Everyone signed in can see their own access row (to know their role).
create policy app_users_self_read on public.app_users
  for select to authenticated
  using (
    email = lower(coalesce(auth.jwt() ->> 'email', ''))
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', '') = 'google'
  );

-- Tutor-only access to everything else.
create policy tutor_all on public.app_users        for all to authenticated using (public.is_tutor()) with check (public.is_tutor());
create policy tutor_all on public.hour_accounts    for all to authenticated using (public.is_tutor()) with check (public.is_tutor());
create policy tutor_all on public.students         for all to authenticated using (public.is_tutor()) with check (public.is_tutor());
create policy tutor_all on public.lessons          for all to authenticated using (public.is_tutor()) with check (public.is_tutor());
create policy tutor_all on public.lesson_students  for all to authenticated using (public.is_tutor()) with check (public.is_tutor());
create policy tutor_all on public.lesson_materials for all to authenticated using (public.is_tutor()) with check (public.is_tutor());
create policy tutor_all on public.packages         for all to authenticated using (public.is_tutor()) with check (public.is_tutor());
create policy tutor_all on public.hour_adjustments for all to authenticated using (public.is_tutor()) with check (public.is_tutor());
create policy tutor_all on public.settings         for all to authenticated using (public.is_tutor()) with check (public.is_tutor());
create policy tutor_all on public.parent_links     for all to authenticated using (public.is_tutor()) with check (public.is_tutor());
create policy tutor_all on public.student_logins   for all to authenticated using (public.is_tutor()) with check (public.is_tutor());
create policy tutor_all on public.skill_topics     for all to authenticated using (public.is_tutor()) with check (public.is_tutor());
create policy tutor_all on public.quiz_results     for all to authenticated using (public.is_tutor()) with check (public.is_tutor());
-- private_settings: intentionally no policies.

-- ---------------------------------------------------------------------------
-- The viewer's window: schedule only
-- ---------------------------------------------------------------------------
create or replace function public.viewer_schedule(p_from timestamptz, p_to timestamptz)
returns table (
  lesson_id uuid,
  start_at  timestamptz,
  end_at    timestamptz,
  students  text,
  mode      text,
  place     text,
  is_preply boolean
)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if coalesce(public.current_app_role(), '') not in ('tutor', 'viewer') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_to - p_from > interval '62 days' then
    raise exception 'range too long';
  end if;

  return query
  select
    l.id,
    l.start_at,
    l.end_at,
    coalesce(string_agg(s.first_name, ' & ' order by s.first_name), 'Lesson') as students,
    case
      when l.is_preply then 'online'
      when bool_or(s.mode = 'onsite') then 'onsite'
      when bool_or(s.mode = 'online') then 'online'
      else null
    end as mode,
    case
      when l.is_preply or bool_and(s.mode = 'online') then null
      else min(s.place)  -- never the raw calendar location (could hold addresses or meeting links)
    end as place,
    l.is_preply
  from public.lessons l
  left join public.lesson_students ls on ls.lesson_id = l.id
  left join public.students s on s.id = ls.student_id
  where l.start_at < p_to
    and l.end_at > p_from
    and l.in_calendar
    and not l.ignored
    and l.status not in ('cancelled', 'cancelled_charged')
    and exists (select 1 from public.lesson_students x where x.lesson_id = l.id)
  group by l.id
  order by l.start_at;
end;
$$;

revoke all on function public.viewer_schedule(timestamptz, timestamptz) from public, anon;
grant execute on function public.viewer_schedule(timestamptz, timestamptz) to authenticated;
revoke all on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated;
revoke all on function public.is_tutor() from public, anon;
grant execute on function public.is_tutor() to authenticated;
