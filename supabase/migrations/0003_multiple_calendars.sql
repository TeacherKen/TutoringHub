-- TutoringHub — read more than one calendar (e.g. private lessons + Preply).
-- Run after 0001 and 0002. Safe to run once.

create table tutoring.calendar_sources (
  id         uuid primary key default gen_random_uuid(),
  label      text not null check (length(trim(label)) > 0),
  ical_url   text not null,
  is_preply  boolean not null default false,
  created_at timestamptz not null default now()
);

-- Secret links: RLS on and NO policies = only the server can read them.
alter table tutoring.calendar_sources enable row level security;
revoke all on tutoring.calendar_sources from anon, authenticated;
grant all on tutoring.calendar_sources to service_role;

-- Which calendar each lesson came from.
alter table tutoring.lessons
  add column calendar_source_id uuid references tutoring.calendar_sources(id) on delete set null;

-- Move the calendar you already connected into the new list.
with moved as (
  insert into tutoring.calendar_sources (label, ical_url)
  select 'Lessons', ical_url from tutoring.private_settings where id = 1 and ical_url is not null
  returning id
)
update tutoring.lessons set calendar_source_id = (select id from moved) where exists (select 1 from moved);

update tutoring.private_settings set ical_url = null where id = 1;
