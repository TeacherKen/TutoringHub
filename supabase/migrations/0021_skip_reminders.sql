-- TutoringHub — "Clear all" on Home: lessons that don't need a note, or don't need feedback sent. Safe to run more than once.
alter table tutoring.lessons add column if not exists note_skipped boolean not null default false;
alter table tutoring.lessons add column if not exists feedback_skipped boolean not null default false;
