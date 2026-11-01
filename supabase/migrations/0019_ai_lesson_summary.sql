-- TutoringHub — keep the AI lesson summary (parent feedback + next worksheet prompt) with each lesson. Safe to run more than once.
alter table tutoring.lessons add column if not exists ai_summary jsonb;
alter table tutoring.lessons add column if not exists ai_summary_at timestamptz;
