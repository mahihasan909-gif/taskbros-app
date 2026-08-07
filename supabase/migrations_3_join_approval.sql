-- Cleanup test data: keep only the most recently created room per user,
-- then drop any rooms left with no members.
delete from room_members a
using room_members b
where a.user_id = b.user_id
  and a.joined_at < b.joined_at;

delete from rooms where id not in (select room_id from room_members);

-- Enforce: a user can only belong to one room at a time.
alter table room_members add constraint room_members_user_id_key unique (user_id);

-- Join requests: joining a room now requires leader approval.
create table room_join_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (room_id, user_id)
);

alter table room_join_requests enable row level security;

create policy "users read their own join requests" on room_join_requests
  for select using (auth.uid() = user_id);

create policy "leaders read requests for their room" on room_join_requests
  for select using (
    exists (
      select 1 from room_members m
      where m.room_id = room_join_requests.room_id and m.user_id = auth.uid() and m.role = 'leader'
    )
  );

-- Replace create_room: block if already in a room.
create or replace function create_room(room_name text)
returns rooms
language plpgsql
security definer set search_path = public
as $$
declare
  new_room rooms;
  generated_code text;
begin
  if exists (select 1 from room_members where user_id = auth.uid()) then
    raise exception 'You are already in a room. Leave it first.';
  end if;

  generated_code := upper(substr(md5(random()::text), 1, 6));

  insert into rooms (name, join_code, created_by)
  values (room_name, generated_code, auth.uid())
  returning * into new_room;

  insert into room_members (room_id, user_id, role)
  values (new_room.id, auth.uid(), 'leader');

  return new_room;
end;
$$;

-- Replace join_room_by_code: creates a pending request instead of joining directly.
create or replace function join_room_by_code(code text)
returns room_join_requests
language plpgsql
security definer set search_path = public
as $$
declare
  target_room rooms;
  new_request room_join_requests;
begin
  if exists (select 1 from room_members where user_id = auth.uid()) then
    raise exception 'You are already in a room. Leave it first.';
  end if;

  select * into target_room from rooms where join_code = upper(code);
  if target_room.id is null then
    raise exception 'Invalid room code';
  end if;

  insert into room_join_requests (room_id, user_id, status)
  values (target_room.id, auth.uid(), 'pending')
  on conflict (room_id, user_id) do update set status = 'pending', requested_at = now(), decided_at = null
  returning * into new_request;

  return new_request;
end;
$$;

-- Leader approves a pending request: adds the requester as a member.
create or replace function approve_join_request(request_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  req room_join_requests;
begin
  select * into req from room_join_requests where id = request_id;
  if req.id is null then
    raise exception 'Request not found';
  end if;

  if not exists (
    select 1 from room_members m
    where m.room_id = req.room_id and m.user_id = auth.uid() and m.role = 'leader'
  ) then
    raise exception 'Only the room leader can approve requests';
  end if;

  insert into room_members (room_id, user_id, role)
  values (req.room_id, req.user_id, 'member')
  on conflict (user_id) do nothing;

  update room_join_requests set status = 'approved', decided_at = now() where id = request_id;
end;
$$;

-- Leader rejects a pending request.
create or replace function reject_join_request(request_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  req room_join_requests;
begin
  select * into req from room_join_requests where id = request_id;
  if req.id is null then
    raise exception 'Request not found';
  end if;

  if not exists (
    select 1 from room_members m
    where m.room_id = req.room_id and m.user_id = auth.uid() and m.role = 'leader'
  ) then
    raise exception 'Only the room leader can reject requests';
  end if;

  update room_join_requests set status = 'rejected', decided_at = now() where id = request_id;
end;
$$;
