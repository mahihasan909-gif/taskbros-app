-- Recurring weekly task templates. An admin assigns a task to a person on a
-- given weekday once, and it keeps recurring every week until the admin
-- deletes it (or replaces it with a new assignment).
create table recurring_tasks (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  assigned_to uuid not null references profiles(id) on delete cascade,
  day text not null check (day in ('sat','sun','mon','tue','wed','thu','fri')),
  task_title text not null,
  time_slot text,
  scheduled_time time,
  active boolean not null default true,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

alter table recurring_tasks enable row level security;

create policy "room members can read recurring tasks" on recurring_tasks
  for select using (room_id in (select my_room_ids()));

create policy "leader can write recurring tasks" on recurring_tasks
  for insert with check (
    exists (select 1 from room_members m where m.room_id = recurring_tasks.room_id and m.user_id = auth.uid() and m.role = 'leader')
  );

create policy "leader can delete recurring tasks" on recurring_tasks
  for delete using (
    exists (select 1 from room_members m where m.room_id = recurring_tasks.room_id and m.user_id = auth.uid() and m.role = 'leader')
  );

-- Each day's concrete, trackable instance of a recurring task.
alter table task_assignments add column if not exists recurring_task_id uuid references recurring_tasks(id) on delete cascade;

create unique index if not exists task_assignments_recurring_date_uq
  on task_assignments (recurring_task_id, date)
  where recurring_task_id is not null;

-- Called by any room member (e.g. on app open) to materialize today's
-- occurrence of every active recurring task in their room(s), if it doesn't
-- already exist. Safe to call repeatedly.
create or replace function ensure_recurring_occurrences()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  today_date date := current_date;
  today_day text;
begin
  today_day := (array['sun','mon','tue','wed','thu','fri','sat'])[extract(dow from today_date)::int + 1];

  insert into task_assignments (room_id, assigned_to, day, date, task_title, time_slot, scheduled_time, source, status, recurring_task_id)
  select rt.room_id, rt.assigned_to, rt.day, today_date, rt.task_title, rt.time_slot, rt.scheduled_time, 'manual', 'pending', rt.id
  from recurring_tasks rt
  where rt.day = today_day
    and rt.active = true
    and rt.room_id in (select my_room_ids())
    and not exists (
      select 1 from task_assignments ta
      where ta.recurring_task_id = rt.id and ta.date = today_date
    );
end;
$$;

-- So the admin's app can hear "status changed to done" in real time.
alter table task_assignments replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_assignments'
  ) then
    alter publication supabase_realtime add table task_assignments;
  end if;
end $$;
