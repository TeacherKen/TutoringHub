-- 0022: "Ready" for a coming lesson (Home → Coming up). Online lessons tick themselves when new smart
-- slides were uploaded since the last lesson; onsite lessons (printed worksheets) are ticked by hand.
alter table tutoring.lessons add column if not exists ready_at timestamptz;
