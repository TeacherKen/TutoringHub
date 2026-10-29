-- TutoringHub — each student can have "current slides" (e.g. their ongoing Canva deck)
-- that always shows in their room, without adding the link to every lesson.
alter table tutoring.students add column if not exists slides_url text;
alter table tutoring.students add column if not exists slides_label text;
