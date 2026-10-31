-- TutoringHub — Football Times Tables: what each student knows, fact by fact. Safe to run more than once.
create table if not exists tutoring.fact_progress (
  student_id uuid not null references tutoring.students(id) on delete cascade,
  fact       text not null check (fact ~ '^[0-9]{1,2}x[0-9]{1,2}$'),
  box        int  not null default 1 check (box between 1 and 5),
  correct    int  not null default 0,
  wrong      int  not null default 0,
  avg_ms     int,
  due_at     timestamptz not null default now(),
  last_seen  timestamptz,
  primary key (student_id, fact)
);
create table if not exists tutoring.practice_sessions (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references tutoring.students(id) on delete cascade,
  game       text not null default 'tt',
  tables     int[] not null default '{}',
  score      int  not null check (score >= 0),
  total      int  not null check (total > 0),
  created_at timestamptz not null default now()
);
create index if not exists practice_sessions_student on tutoring.practice_sessions (student_id, created_at desc);
alter table tutoring.students add column if not exists tt_tables int[];

alter table tutoring.fact_progress enable row level security;
alter table tutoring.practice_sessions enable row level security;
drop policy if exists tutor_all on tutoring.fact_progress;
drop policy if exists tutor_all on tutoring.practice_sessions;
create policy tutor_all on tutoring.fact_progress for all to authenticated using (tutoring.is_tutor()) with check (tutoring.is_tutor());
create policy tutor_all on tutoring.practice_sessions for all to authenticated using (tutoring.is_tutor()) with check (tutoring.is_tutor());
grant all on tutoring.fact_progress, tutoring.practice_sessions to authenticated, service_role;
