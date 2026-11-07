-- 0029: Mr Ken can hide a child's times tables chart and trophies from the family page
-- (e.g. when the child wasn't playing seriously). On by default, so nothing changes for anyone else.
alter table tutoring.students add column if not exists family_show_tables boolean not null default true;
