-- TutoringHub — packages that started before the app, and a price per class (e.g. Preply).
-- Safe to run more than once.
alter table tutoring.packages add column if not exists hours_used_before numeric(6, 2) not null default 0 check (hours_used_before >= 0);
alter table tutoring.students add column if not exists class_price_thb numeric(10, 2) check (class_price_thb is null or class_price_thb >= 0);
