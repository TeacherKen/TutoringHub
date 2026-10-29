-- TutoringHub — Phase 1 database
-- Run this once in Supabase: SQL Editor → New query → paste → Run.
--
-- Everything lives in its own schema called "tutoring", so it can share a
-- Supabase project with another app (e.g. Our Home) without mixing data.
-- After running this, add "tutoring" under Project Settings → Data API →
-- Exposed schemas.
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

create schema if not exists tutoring;
grant usage on schema tutoring to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Who may sign in
-- ---------------------------------------------------------------------------
create table tutoring.app_users (
  email        text primary key check (email = lower(email)),
  role         text not null check (role in ('tutor', 'viewer', 'parent', 'student')),
  display_name text,
  created_at   timestamptz not null default now()
);

create or replace function tutoring.current_app_role()
returns text
language sql stable security definer
set search_path = tutoring
as $$
  -- Only trust emails that came from Google sign-in (not email/password sign-up).
  select role from tutoring.app_users
  where email = lower(coalesce(auth.jwt() ->> 'email', ''))
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', '') = 'google'
$$;

create or replace function tutoring.is_tutor()
returns boolean
language sql stable security definer
set search_path = tutoring
as $$
  select coalesce(tutoring.current_app_role() = 'tutor', false)
$$;

-- ---------------------------------------------------------------------------
-- Hour accounts: one per student, or one shared by siblings
-- ---------------------------------------------------------------------------
create table tutoring.hour_accounts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Students (first name / nickname only — no surnames)
-- ---------------------------------------------------------------------------
create table tutoring.students (
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
  hour_account_id uuid references tutoring.hour_accounts(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Lessons (one row per calendar occurrence) + the tutor's notes
-- ---------------------------------------------------------------------------
create table tutoring.lessons (
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
create index lessons_start_idx on tutoring.lessons (start_at);

create table tutoring.lesson_students (
  lesson_id    uuid not null references tutoring.lessons(id) on delete cascade,
  student_id   uuid not null references tutoring.students(id) on delete cascade,
  match_source text not null default 'auto' check (match_source in ('auto', 'manual')),
  uses_hours   boolean not null default true,
  primary key (lesson_id, student_id)
);
create index lesson_students_student_idx on tutoring.lesson_students (student_id);

create table tutoring.lesson_materials (
  id           uuid primary key default gen_random_uuid(),
  lesson_id    uuid not null references tutoring.lessons(id) on delete cascade,
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
create table tutoring.packages (
  id              uuid primary key default gen_random_uuid(),
  hour_account_id uuid not null references tutoring.hour_accounts(id) on delete cascade,
  hours           numeric(6, 2) not null check (hours > 0),
  price_thb       numeric(10, 2) check (price_thb is null or price_thb >= 0),
  paid_on         date,
  paid_by         text check (paid_by in ('bank_transfer', 'cash', 'preply', 'other')),
  start_date      date not null,
  note            text,
  created_at      timestamptz not null default now()
);

create table tutoring.hour_adjustments (
  id              uuid primary key default gen_random_uuid(),
  hour_account_id uuid not null references tutoring.hour_accounts(id) on delete cascade,
  hours           numeric(6, 2) not null check (hours <> 0),
  reason          text not null check (length(trim(reason)) > 0),
  adjusted_on     date not null default current_date,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
create table tutoring.settings (
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
insert into tutoring.settings (id) values (1);

-- The secret calendar link lives here. RLS on + no policies = server only.
create table tutoring.private_settings (
  id       int primary key default 1 check (id = 1),
  ical_url text
);
insert into tutoring.private_settings (id) values (1);

-- ---------------------------------------------------------------------------
-- Ready for later phases (no screens yet)
-- ---------------------------------------------------------------------------
create table tutoring.parent_links (
  parent_email text not null check (parent_email = lower(parent_email)),
  student_id   uuid not null references tutoring.students(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (parent_email, student_id)
);

create table tutoring.student_logins (
  login_email text primary key check (login_email = lower(login_email)),
  student_id  uuid not null references tutoring.students(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table tutoring.skill_topics (
  id     uuid primary key default gen_random_uuid(),
  level  text not null,
  strand text,
  name   text not null,
  sort   int not null default 0
);

create table tutoring.quiz_results (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references tutoring.students(id) on delete cascade,
  topic      text,
  score      int,
  out_of     int,
  taken_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table tutoring.app_users        enable row level security;
alter table tutoring.hour_accounts    enable row level security;
alter table tutoring.students         enable row level security;
alter table tutoring.lessons          enable row level security;
alter table tutoring.lesson_students  enable row level security;
alter table tutoring.lesson_materials enable row level security;
alter table tutoring.packages         enable row level security;
alter table tutoring.hour_adjustments enable row level security;
alter table tutoring.settings         enable row level security;
alter table tutoring.private_settings enable row level security;
alter table tutoring.parent_links     enable row level security;
alter table tutoring.student_logins   enable row level security;
alter table tutoring.skill_topics     enable row level security;
alter table tutoring.quiz_results     enable row level security;

-- Everyone signed in can see their own access row (to know their role).
create policy app_users_self_read on tutoring.app_users
  for select to authenticated
  using (
    email = lower(coalesce(auth.jwt() ->> 'email', ''))
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', '') = 'google'
  );

-- Tutor-only access to everything else.
create policy tutor_all on tutoring.app_users        for all to authenticated using (tutoring.is_tutor()) with check (tutoring.is_tutor());
create policy tutor_all on tutoring.hour_accounts    for all to authenticated using (tutoring.is_tutor()) with check (tutoring.is_tutor());
create policy tutor_all on tutoring.students         for all to authenticated using (tutoring.is_tutor()) with check (tutoring.is_tutor());
create policy tutor_all on tutoring.lessons          for all to authenticated using (tutoring.is_tutor()) with check (tutoring.is_tutor());
create policy tutor_all on tutoring.lesson_students  for all to authenticated using (tutoring.is_tutor()) with check (tutoring.is_tutor());
create policy tutor_all on tutoring.lesson_materials for all to authenticated using (tutoring.is_tutor()) with check (tutoring.is_tutor());
create policy tutor_all on tutoring.packages         for all to authenticated using (tutoring.is_tutor()) with check (tutoring.is_tutor());
create policy tutor_all on tutoring.hour_adjustments for all to authenticated using (tutoring.is_tutor()) with check (tutoring.is_tutor());
create policy tutor_all on tutoring.settings         for all to authenticated using (tutoring.is_tutor()) with check (tutoring.is_tutor());
create policy tutor_all on tutoring.parent_links     for all to authenticated using (tutoring.is_tutor()) with check (tutoring.is_tutor());
create policy tutor_all on tutoring.student_logins   for all to authenticated using (tutoring.is_tutor()) with check (tutoring.is_tutor());
create policy tutor_all on tutoring.skill_topics     for all to authenticated using (tutoring.is_tutor()) with check (tutoring.is_tutor());
create policy tutor_all on tutoring.quiz_results     for all to authenticated using (tutoring.is_tutor()) with check (tutoring.is_tutor());
-- private_settings: intentionally no policies.

-- ---------------------------------------------------------------------------
-- The viewer's window: schedule only
-- ---------------------------------------------------------------------------
create or replace function tutoring.viewer_schedule(p_from timestamptz, p_to timestamptz)
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
set search_path = tutoring
as $$
begin
  if coalesce(tutoring.current_app_role(), '') not in ('tutor', 'viewer') then
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
  from tutoring.lessons l
  left join tutoring.lesson_students ls on ls.lesson_id = l.id
  left join tutoring.students s on s.id = ls.student_id
  where l.start_at < p_to
    and l.end_at > p_from
    and l.in_calendar
    and not l.ignored
    and l.status not in ('cancelled', 'cancelled_charged')
    and exists (select 1 from tutoring.lesson_students x where x.lesson_id = l.id)
  group by l.id
  order by l.start_at;
end;
$$;

revoke all on function tutoring.viewer_schedule(timestamptz, timestamptz) from public, anon;
grant execute on function tutoring.viewer_schedule(timestamptz, timestamptz) to authenticated;
revoke all on function tutoring.current_app_role() from public, anon;
grant execute on function tutoring.current_app_role() to authenticated;
revoke all on function tutoring.is_tutor() from public, anon;
grant execute on function tutoring.is_tutor() to authenticated;

-- ---------------------------------------------------------------------------
-- Access for the API roles (Row Level Security above still decides what each
-- signed-in person can actually see).
-- ---------------------------------------------------------------------------
grant all on all tables in schema tutoring to authenticated, service_role;
grant all on all sequences in schema tutoring to authenticated, service_role;
alter default privileges in schema tutoring grant all on tables to authenticated, service_role;
