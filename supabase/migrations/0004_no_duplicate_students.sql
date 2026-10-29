-- TutoringHub — remove students that were added twice, and stop it happening again.
-- Keeps the first copy of each student. Lessons re-link to the kept copy on the next Refresh.

with ranked as (
  select id, row_number() over (partition by lower(first_name) order by created_at, id) as rn
  from tutoring.students
)
delete from tutoring.students where id in (select id from ranked where rn > 1);

-- Remove hour accounts nobody uses any more (only ones with no packages).
delete from tutoring.hour_accounts a
where not exists (select 1 from tutoring.students s where s.hour_account_id = a.id)
  and not exists (select 1 from tutoring.packages p where p.hour_account_id = a.id)
  and not exists (select 1 from tutoring.hour_adjustments h where h.hour_account_id = a.id);

-- From now on, two students can't have the same first name / nickname.
create unique index if not exists students_first_name_unique on tutoring.students (lower(first_name));
