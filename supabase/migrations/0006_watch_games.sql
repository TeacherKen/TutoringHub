-- TutoringHub — lets Mr Ken watch a student's game screen while break-time games are open.
-- Only the latest picture of the screen is kept (one row per student).

create table if not exists tutoring.room_screens (
  student_id uuid primary key references tutoring.students(id) on delete cascade,
  game       text not null,
  html       text not null,
  updated_at timestamptz not null default now()
);

alter table tutoring.room_screens enable row level security;
create policy tutor_all on tutoring.room_screens for all to authenticated
  using (tutoring.is_tutor()) with check (tutoring.is_tutor());
grant all on tutoring.room_screens to authenticated, service_role;

-- Clear old screens when games are closed.
create or replace function tutoring.clear_screen_on_close() returns trigger
language plpgsql security definer set search_path = tutoring as $$
begin
  if old.games_open and not new.games_open then
    delete from tutoring.room_screens where student_id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists clear_screen_on_close on tutoring.students;
create trigger clear_screen_on_close after update of games_open on tutoring.students
  for each row execute function tutoring.clear_screen_on_close();
