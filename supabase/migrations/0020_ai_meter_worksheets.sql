-- TutoringHub — AI meter (what each AI use cost), the photo switch, and saved worksheets. Safe to run more than once.

-- Includes 0019 (in case it wasn't run): the AI lesson summary kept with each lesson.
alter table tutoring.lessons add column if not exists ai_summary jsonb;
alter table tutoring.lessons add column if not exists ai_summary_at timestamptz;

-- Let the AI read pictures of written work? Off until Mr Ken turns it on in Settings.
alter table tutoring.settings add column if not exists ai_pictures boolean not null default false;

-- One row per AI use: which feature, which model, how much text went in and out, and the cost in US dollars.
create table if not exists tutoring.ai_usage (
  id            uuid primary key default gen_random_uuid(),
  feature       text not null,
  model         text not null,
  input_tokens  int  not null default 0,
  output_tokens int  not null default 0,
  cost_usd      numeric(10, 5) not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists ai_usage_created on tutoring.ai_usage (created_at desc);

-- Worksheets made by the AI (the content; the app lays it out as an A4 page to print or save as PDF).
create table if not exists tutoring.worksheets (
  id         uuid primary key default gen_random_uuid(),
  lesson_id  uuid references tutoring.lessons(id) on delete set null,
  student_id uuid references tutoring.students(id) on delete set null,
  title      text not null,
  content    jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists worksheets_lesson on tutoring.worksheets (lesson_id, created_at desc);

alter table tutoring.ai_usage enable row level security;
alter table tutoring.worksheets enable row level security;
drop policy if exists tutor_all on tutoring.ai_usage;
drop policy if exists tutor_all on tutoring.worksheets;
create policy tutor_all on tutoring.ai_usage for all to authenticated using (tutoring.is_tutor()) with check (tutoring.is_tutor());
create policy tutor_all on tutoring.worksheets for all to authenticated using (tutoring.is_tutor()) with check (tutoring.is_tutor());
grant all on tutoring.ai_usage, tutoring.worksheets to authenticated, service_role;
