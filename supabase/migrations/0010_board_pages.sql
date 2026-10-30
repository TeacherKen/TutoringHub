-- TutoringHub — smart slides: add blank or squared-paper pages anywhere.
-- Safe to run more than once.
alter table tutoring.boards add column if not exists layout int[];
alter table tutoring.board_marks drop constraint if exists board_marks_page_check;
alter table tutoring.board_marks add constraint board_marks_page_check check (page >= 0 and page < 3000);
