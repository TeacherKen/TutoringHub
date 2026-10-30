-- TutoringHub — smart slides: a PDF turned into pages a student can write on,
-- while Mr Ken watches live and writes too. Safe to run more than once.

-- One uploaded set of slides for one student.
create table if not exists tutoring.boards (
  id         uuid primary key,
  student_id uuid not null references tutoring.students(id) on delete cascade,
  title      text not null check (length(title) between 1 and 120),
  pages      int  not null check (pages between 1 and 60),
  aspect     numeric not null check (aspect > 0.2 and aspect < 5), -- page height ÷ width
  created_at timestamptz not null default now()
);
create index if not exists boards_student on tutoring.boards (student_id, created_at desc);

-- The smart slides showing in the student's room right now.
alter table tutoring.students add column if not exists board_id uuid references tutoring.boards(id) on delete set null;

-- Every pen line, highlight or typed word. "rev" goes up on every change, so screens
-- only fetch what is new since they last looked.
create sequence if not exists tutoring.board_rev;
create table if not exists tutoring.board_marks (
  id         uuid primary key,
  board_id   uuid not null references tutoring.boards(id) on delete cascade,
  page       int  not null check (page >= 0 and page < 60),
  author     text not null check (author in ('student', 'tutor')),
  data       jsonb not null,
  deleted    boolean not null default false,
  rev        bigint not null default nextval('tutoring.board_rev'),
  created_at timestamptz not null default now()
);
create index if not exists board_marks_rev on tutoring.board_marks (board_id, rev);

-- What each person is doing right now: page, tool, colour, the line being drawn.
create table if not exists tutoring.board_live (
  board_id   uuid not null references tutoring.boards(id) on delete cascade,
  who        text not null check (who in ('student', 'tutor')),
  page       int  not null default 0,
  tool       text,
  color      text,
  stroke     jsonb,
  go_to      int,          -- tutor only: "come to this page"
  go_at      timestamptz,
  updated_at timestamptz not null default now(),
  primary key (board_id, who)
);

alter table tutoring.boards      enable row level security;
alter table tutoring.board_marks enable row level security;
alter table tutoring.board_live  enable row level security;
drop policy if exists tutor_all on tutoring.boards;
drop policy if exists tutor_all on tutoring.board_marks;
drop policy if exists tutor_all on tutoring.board_live;
create policy tutor_all on tutoring.boards      for all to authenticated using (tutoring.is_tutor()) with check (tutoring.is_tutor());
create policy tutor_all on tutoring.board_marks for all to authenticated using (tutoring.is_tutor()) with check (tutoring.is_tutor());
create policy tutor_all on tutoring.board_live  for all to authenticated using (tutoring.is_tutor()) with check (tutoring.is_tutor());
grant all on tutoring.boards, tutoring.board_marks, tutoring.board_live to authenticated, service_role;
grant usage, select on sequence tutoring.board_rev to authenticated, service_role;

-- Rubbing something out also counts as a change.
create or replace function tutoring.board_mark_bump() returns trigger
language plpgsql security definer set search_path = tutoring as $$
begin
  new.rev := nextval('tutoring.board_rev');
  return new;
end;
$$;
drop trigger if exists board_mark_bump on tutoring.board_marks;
create trigger board_mark_bump before update on tutoring.board_marks
  for each row execute function tutoring.board_mark_bump();
