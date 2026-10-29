-- TutoringHub — student rooms (private link per student) and a "start tracking from" date.
-- Run after 0001–0004. Safe to run once.

-- Lessons before this date never show up in "Needs attention".
alter table tutoring.settings add column if not exists track_from date;
update tutoring.settings set track_from = coalesce(track_from, current_date) where id = 1;

-- Each student's private room link, and whether break-time games are open.
alter table tutoring.students add column if not exists room_token text;
alter table tutoring.students add column if not exists games_open boolean not null default false;
alter table tutoring.students add column if not exists games_opened_at timestamptz;
create unique index if not exists students_room_token_unique on tutoring.students (room_token);
