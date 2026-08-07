-- profiles currently only readable by self. That silently breaks:
--   - room members seeing each other's names
--   - a leader reviewing a pending join request (requester's profile is hidden)
-- Add visibility for roommates and for leaders reviewing a pending request.
create policy "roommates and reviewing leaders can read profiles" on profiles
  for select using (
    id in (select user_id from room_members where room_id in (select my_room_ids()))
    or exists (
      select 1 from room_join_requests r
      join room_members m on m.room_id = r.room_id and m.role = 'leader'
      where r.user_id = profiles.id and r.status = 'pending' and m.user_id = auth.uid()
    )
  );
