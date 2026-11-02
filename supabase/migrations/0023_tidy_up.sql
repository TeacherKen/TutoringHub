-- 0023: tidy-up from Supabase's database checker (Nov 2026). Safe to run more than once.

-- Indexes for the links between tables (faster lookups as the lesson history grows).
create index if not exists hour_adjustments_account on tutoring.hour_adjustments (hour_account_id);
create index if not exists lesson_materials_lesson on tutoring.lesson_materials (lesson_id);
create index if not exists lessons_calendar_source on tutoring.lessons (calendar_source_id);
create index if not exists match_players_student on tutoring.match_players (student_id);
create index if not exists matches_winner on tutoring.matches (winner);
create index if not exists packages_account on tutoring.packages (hour_account_id);
create index if not exists parent_links_student on tutoring.parent_links (student_id);
create index if not exists quiz_results_student on tutoring.quiz_results (student_id);
create index if not exists student_logins_student on tutoring.student_logins (student_id);
create index if not exists students_board on tutoring.students (board_id);
create index if not exists students_hour_account on tutoring.students (hour_account_id);
create index if not exists worksheets_student on tutoring.worksheets (student_id);

-- These two only run by themselves inside the database (triggers); nobody needs to call them from outside.
revoke execute on function tutoring.board_mark_bump() from public, anon, authenticated;
revoke execute on function tutoring.clear_screen_on_close() from public, anon, authenticated;
grant execute on function tutoring.board_mark_bump() to service_role;
grant execute on function tutoring.clear_screen_on_close() to service_role;
