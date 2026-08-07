-- Push tokens, one row per device.
create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  token text not null unique,
  updated_at timestamptz not null default now()
);

alter table push_tokens enable row level security;

create policy "user manages own push tokens" on push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Server-side reminder tracking, mirrors the client's repeat/step logic so a
-- cron-driven edge function can send reminders even if nobody opens the app.
alter table task_assignments add column if not exists reminders_sent integer not null default 0;
alter table task_assignments add column if not exists admin_notified boolean not null default false;
