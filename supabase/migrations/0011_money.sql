-- TutoringHub — Money page: price per hour for students without a package (e.g. Preply),
-- and how many weeks before a package runs out to remind you. Safe to run more than once.
alter table tutoring.students add column if not exists hourly_rate_thb numeric(10, 2) check (hourly_rate_thb is null or hourly_rate_thb >= 0);
alter table tutoring.settings add column if not exists renew_weeks numeric(4, 1) not null default 2;
