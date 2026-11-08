-- 0030: speed — the database checker flagged parent messages' link to a lesson as having no index.
create index if not exists family_notes_lesson on tutoring.family_notes (lesson_id);
