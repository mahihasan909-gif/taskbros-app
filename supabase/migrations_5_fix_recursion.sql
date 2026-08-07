-- Fix: the room_members SELECT policy referenced room_members from within
-- itself, causing "infinite recursion detected in policy for relation
-- room_members" on every query. Use a SECURITY DEFINER helper instead so
-- the membership lookup bypasses RLS internally.

create or replace function my_room_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select room_id from room_members where user_id = auth.uid();
$$;

drop policy if exists "members can read their room roster" on room_members;
create policy "members can read their room roster" on room_members
  for select using (room_id in (select my_room_ids()));
