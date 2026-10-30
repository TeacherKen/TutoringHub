-- TutoringHub — a countdown timer Mr Ken starts on the smart slides. Safe to run more than once.
alter table tutoring.board_live add column if not exists timer_end timestamptz;
alter table tutoring.board_live add column if not exists timer_secs int check (timer_secs is null or timer_secs between 1 and 3600);
