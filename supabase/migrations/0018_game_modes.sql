-- TutoringHub — times tables game modes (times, divide, missing number, mixed). Safe to run more than once.
alter table tutoring.students add column if not exists tt_mode text check (tt_mode in ('times', 'divide', 'missing', 'mixed'));
alter table tutoring.match_players add column if not exists mode text not null default 'times' check (mode in ('times', 'divide', 'missing', 'mixed'));
