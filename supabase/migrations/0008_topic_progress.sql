-- TutoringHub — topic progress for each student: coming up / learning / got it.
-- Safe to run more than once.

create table if not exists tutoring.student_topics (
  student_id uuid not null references tutoring.students(id) on delete cascade,
  name       text not null check (length(trim(name)) between 1 and 40),
  status     text not null check (status in ('next', 'learning', 'got_it')),
  updated_at timestamptz not null default now(),
  primary key (student_id, name)
);

alter table tutoring.student_topics enable row level security;
drop policy if exists tutor_all on tutoring.student_topics;
create policy tutor_all on tutoring.student_topics for all to authenticated
  using (tutoring.is_tutor()) with check (tutoring.is_tutor());
grant all on tutoring.student_topics to authenticated, service_role;
