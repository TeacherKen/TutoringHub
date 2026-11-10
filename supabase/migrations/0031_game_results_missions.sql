-- 🎮 Game results saved to each child (from their room link), and 🎯 homework missions.
-- Children play with their private room link (no sign-in); the server checks the link and saves
-- the result. Mr Ken reads them in TutoringHub; the family page shows a short summary.

create table if not exists tutoring.game_results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references tutoring.students(id) on delete cascade,
  game text not null check (char_length(game) between 1 and 40),        -- e.g. 'qm'
  variant text not null default '' check (char_length(variant) <= 60),   -- the game's level key, e.g. 'qm-easy'
  score numeric not null,
  unit text not null check (unit in ('ds', 's', 'pts', 'stars')),         -- tenths of a second, seconds, points, stars
  created_at timestamptz not null default now()
);
create index if not exists game_results_student on tutoring.game_results (student_id, created_at desc);
alter table tutoring.game_results enable row level security;
drop policy if exists tutor_all on tutoring.game_results;
create policy tutor_all on tutoring.game_results for all to authenticated using (tutoring.is_tutor()) with check (tutoring.is_tutor());
grant all on tutoring.game_results to authenticated, service_role;

create table if not exists tutoring.missions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references tutoring.students(id) on delete cascade,
  game text not null check (char_length(game) between 1 and 40),
  rounds int not null default 3 check (rounds between 1 and 20),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists missions_student on tutoring.missions (student_id, created_at desc);
alter table tutoring.missions enable row level security;
drop policy if exists tutor_all on tutoring.missions;
create policy tutor_all on tutoring.missions for all to authenticated using (tutoring.is_tutor()) with check (tutoring.is_tutor());
grant all on tutoring.missions to authenticated, service_role;
