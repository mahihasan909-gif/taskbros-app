-- TaskBros core schema
-- Run in Supabase SQL editor.

create extension if not exists "pgcrypto";

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  avatar_url text,
  person_type text not null check (person_type in ('student', 'job_holder')),
  created_at timestamptz not null default now()
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table room_members (
  room_id uuid not null references rooms(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('leader', 'member')),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table routine_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  day text not null check (day in ('sun','mon','tue','wed','thu','fri','sat')),
  start_time time not null,
  end_time time not null,
  label text not null,
  is_busy boolean not null default true
);

create table task_assignments (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  assigned_to uuid not null references profiles(id),
  day text not null check (day in ('sun','mon','tue','wed','thu','fri','sat')),
  date date not null,
  task_title text not null,
  task_note text,
  time_slot text,
  source text not null default 'ai' check (source in ('ai', 'manual')),
  status text not null default 'pending' check (status in ('pending', 'done', 'skipped')),
  created_at timestamptz not null default now()
);

-- AI memory: rolling record of who did what, used to keep rotation fair
create table task_history_summary (
  room_id uuid not null references rooms(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  task_type text not null,
  times_assigned int not null default 0,
  last_assigned_on date,
  primary key (room_id, user_id, task_type)
);

-- Row Level Security
alter table profiles enable row level security;
alter table rooms enable row level security;
alter table room_members enable row level security;
alter table routine_slots enable row level security;
alter table task_assignments enable row level security;
alter table task_history_summary enable row level security;

create policy "profiles readable by self" on profiles
  for select using (auth.uid() = id);
create policy "profiles updatable by self" on profiles
  for update using (auth.uid() = id);
create policy "profiles insertable by self" on profiles
  for insert with check (auth.uid() = id);

create policy "room members can read their room" on rooms
  for select using (
    exists (select 1 from room_members m where m.room_id = rooms.id and m.user_id = auth.uid())
  );
create policy "any authenticated user can create a room" on rooms
  for insert with check (auth.uid() = created_by);

create policy "members can read their room roster" on room_members
  for select using (
    exists (select 1 from room_members m2 where m2.room_id = room_members.room_id and m2.user_id = auth.uid())
  );
create policy "user can join a room as self" on room_members
  for insert with check (auth.uid() = user_id);

create policy "user manages own routine" on routine_slots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "room members can read task assignments" on task_assignments
  for select using (
    exists (select 1 from room_members m where m.room_id = task_assignments.room_id and m.user_id = auth.uid())
  );
create policy "leader can write task assignments" on task_assignments
  for insert with check (
    exists (
      select 1 from room_members m
      where m.room_id = task_assignments.room_id and m.user_id = auth.uid() and m.role = 'leader'
    )
  );
create policy "assignee can update own task status" on task_assignments
  for update using (auth.uid() = assigned_to);

create policy "room members can read task history" on task_history_summary
  for select using (
    exists (select 1 from room_members m where m.room_id = task_history_summary.room_id and m.user_id = auth.uid())
  );

-- Auto-create a profile row whenever someone signs up
create function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, person_type)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', 'New user'),
    coalesce(new.raw_user_meta_data ->> 'person_type', 'student')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Room creation: generates a join code and adds the creator as leader
create function create_room(room_name text)
returns rooms
language plpgsql
security definer set search_path = public
as $$
declare
  new_room rooms;
  generated_code text;
begin
  generated_code := upper(substr(md5(random()::text), 1, 6));

  insert into rooms (name, join_code, created_by)
  values (room_name, generated_code, auth.uid())
  returning * into new_room;

  insert into room_members (room_id, user_id, role)
  values (new_room.id, auth.uid(), 'leader');

  return new_room;
end;
$$;

-- Room joining by code: looks up the room (bypassing the membership-gated
-- select policy) and adds the caller as a member
create function join_room_by_code(code text)
returns rooms
language plpgsql
security definer set search_path = public
as $$
declare
  target_room rooms;
begin
  select * into target_room from rooms where join_code = upper(code);

  if target_room.id is null then
    raise exception 'Invalid room code';
  end if;

  insert into room_members (room_id, user_id, role)
  values (target_room.id, auth.uid(), 'member')
  on conflict (room_id, user_id) do nothing;

  return target_room;
end;
$$;
