-- 💬 Messages between a family and Mr Ken on the family page.
-- Parents write with their private family link (saved by the server after checking the link);
-- Mr Ken reads and replies in TutoringHub. Never sent to the AI.
create table if not exists tutoring.family_notes (
  id uuid primary key default gen_random_uuid(),
  hour_account_id uuid not null references tutoring.hour_accounts(id) on delete cascade,
  lesson_id uuid references tutoring.lessons(id) on delete set null,   -- a reply to that lesson update, or null
  author text not null check (author in ('parent', 'tutor')),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz                                                  -- when Mr Ken saw a parent's message
);
create index if not exists family_notes_account on tutoring.family_notes (hour_account_id, created_at);
alter table tutoring.family_notes enable row level security;
drop policy if exists tutor_all on tutoring.family_notes;
create policy tutor_all on tutoring.family_notes for all to authenticated using (tutoring.is_tutor()) with check (tutoring.is_tutor());
grant all on tutoring.family_notes to authenticated, service_role;

-- When a family last opened their page (for "Ms Aki opened her page" on Home, and the phone pop-up).
alter table tutoring.hour_accounts add column if not exists family_seen_at timestamptz;

-- 🔔 Phone notifications: each device where Mr Ken turned them on (from the TutoringHub home-screen app).
create table if not exists tutoring.push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table tutoring.push_subscriptions enable row level security;
drop policy if exists tutor_all on tutoring.push_subscriptions;
create policy tutor_all on tutoring.push_subscriptions for all to authenticated using (tutoring.is_tutor()) with check (tutoring.is_tutor());
grant all on tutoring.push_subscriptions to authenticated, service_role;
