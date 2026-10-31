-- TutoringHub — head-to-head matches, and extra round details for trophies. Safe to run more than once.

-- Each round remembers its best goal streak, power shots, and (in a match) whether the child won.
alter table tutoring.practice_sessions add column if not exists best_streak int not null default 0 check (best_streak >= 0);
alter table tutoring.practice_sessions add column if not exists powers int not null default 0 check (powers >= 0);
alter table tutoring.practice_sessions add column if not exists won boolean;

-- A match: two to four children race to score a number of goals, each on their own device.
create table if not exists tutoring.matches (
  id         uuid primary key default gen_random_uuid(),
  token      text not null unique check (token ~ '^[A-Za-z0-9_-]{24,64}$'),
  target     int  not null default 10 check (target between 3 and 30),
  status     text not null default 'waiting' check (status in ('waiting', 'playing', 'done')),
  starts_at  timestamptz,
  winner     uuid references tutoring.students(id) on delete set null,
  next_token text,
  created_at timestamptz not null default now()
);
create index if not exists matches_created on tutoring.matches (created_at);

create table if not exists tutoring.match_players (
  match_id    uuid not null references tutoring.matches(id) on delete cascade,
  student_id  uuid not null references tutoring.students(id) on delete cascade,
  seat        int  not null check (seat between 0 and 3),
  tables      int[] not null check (cardinality(tables) between 1 and 11),
  device      text check (device ~ '^[A-Za-z0-9_-]{8,64}$'),
  goals       int  not null default 0 check (goals >= 0),
  misses      int  not null default 0 check (misses >= 0),
  powers      int  not null default 0 check (powers >= 0),
  streak      int  not null default 0 check (streak >= 0),
  best_streak int  not null default 0 check (best_streak >= 0),
  updated_at  timestamptz not null default now(),
  primary key (match_id, student_id),
  unique (match_id, seat)
);

alter table tutoring.matches enable row level security;
alter table tutoring.match_players enable row level security;
drop policy if exists tutor_all on tutoring.matches;
drop policy if exists tutor_all on tutoring.match_players;
create policy tutor_all on tutoring.matches for all to authenticated using (tutoring.is_tutor()) with check (tutoring.is_tutor());
create policy tutor_all on tutoring.match_players for all to authenticated using (tutoring.is_tutor()) with check (tutoring.is_tutor());
grant all on tutoring.matches, tutoring.match_players to authenticated, service_role;
