-- TutoringHub — price list for renewals, and a private link for each family. Safe to run more than once.
alter table tutoring.settings add column if not exists price_options jsonb not null default '[]'::jsonb;
alter table tutoring.hour_accounts add column if not exists family_token text unique;
alter table tutoring.hour_accounts add column if not exists family_consent_at timestamptz;
