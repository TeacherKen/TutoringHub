-- 0024: topics per child in a shared lesson (e.g. brothers in one lesson, one on times tables and
-- one on fractions). Empty means "the lesson's topics apply to this child" (as before).
alter table tutoring.lesson_students add column if not exists topics text[];
