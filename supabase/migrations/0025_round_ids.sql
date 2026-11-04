-- Each practice round carries an id made on the child's device, so a round sent twice
-- (weak internet, "send it later") is saved once and its answers aren't counted twice.
alter table tutoring.practice_sessions add column if not exists round_id uuid;
create unique index if not exists practice_sessions_round_id_key on tutoring.practice_sessions (round_id) where round_id is not null;
