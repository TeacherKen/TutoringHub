-- TutoringHub — mark classes done automatically, PromptPay, receipts, weekly backups.
-- Safe to run more than once.
alter table tutoring.settings add column if not exists auto_done boolean not null default false;
alter table tutoring.settings add column if not exists promptpay_id text;
alter table tutoring.settings add column if not exists last_backup_at timestamptz;

alter table tutoring.packages add column if not exists receipt_no text unique;
alter table tutoring.packages drop constraint if exists packages_paid_by_check;
alter table tutoring.packages add constraint packages_paid_by_check
  check (paid_by in ('bank_transfer', 'promptpay', 'cash', 'preply', 'other'));

-- Private folder for weekly backups. No policies: only the app's server can read or write it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tutoring-backups', 'tutoring-backups', false, 52428800, array['application/json'])
on conflict (id) do nothing;
