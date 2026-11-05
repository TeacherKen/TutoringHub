-- 🟣 Preply numbers per student, copied from Preply's "My students" page (Preply has no link to read them).
-- Mr Ken updates them now and then; the app adds lessons taught since from the calendar.
create table if not exists tutoring.preply_stats (
  student_id uuid primary key references tutoring.students(id) on delete cascade,
  account_name text,
  plan text not null default 'subscription' check (plan in ('subscription', 'package', 'trial')),
  lesson_price_usd numeric(8,2),
  list_price_usd numeric(8,2),
  income_usd numeric(10,2) not null default 0,
  lessons int not null default 0,
  months int not null default 0,
  per_four_weeks int,          -- subscription: lessons every 4 weeks
  booked int,                  -- "13 of 13 scheduled or completed"
  booked_of int,
  renews_on date,
  as_of date not null default current_date,
  updated_at timestamptz not null default now()
);
alter table tutoring.preply_stats enable row level security;
drop policy if exists tutor_all on tutoring.preply_stats;
create policy tutor_all on tutoring.preply_stats for all to authenticated using (tutoring.is_tutor()) with check (tutoring.is_tutor());
grant all on tutoring.preply_stats to authenticated, service_role;
