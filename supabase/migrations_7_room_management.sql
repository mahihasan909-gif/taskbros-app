-- Leader removes a member from the room.
create or replace function remove_member(target_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  target_room_id uuid;
begin
  select room_id into target_room_id from room_members where user_id = auth.uid();

  if not exists (
    select 1 from room_members m
    where m.room_id = target_room_id and m.user_id = auth.uid() and m.role = 'leader'
  ) then
    raise exception 'Only the room admin can remove members';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Use leave_room to remove yourself';
  end if;

  delete from room_members where room_id = target_room_id and user_id = target_user_id;
end;
$$;

-- A member leaves their room. The leader must delete the room instead.
create or replace function leave_room()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  my_role text;
begin
  select role into my_role from room_members where user_id = auth.uid();

  if my_role is null then
    raise exception 'You are not in a room';
  end if;

  if my_role = 'leader' then
    raise exception 'Admins cannot leave - delete the room instead';
  end if;

  delete from room_members where user_id = auth.uid();
end;
$$;

-- Leader deletes the whole room (cascades to members, tasks, join requests).
create or replace function delete_room()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  target_room_id uuid;
begin
  select room_id into target_room_id from room_members
  where user_id = auth.uid() and role = 'leader';

  if target_room_id is null then
    raise exception 'Only the room admin can delete the room';
  end if;

  delete from rooms where id = target_room_id;
end;
$$;
