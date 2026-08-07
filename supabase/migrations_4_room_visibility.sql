-- Let a user see the room's name/code while their join request is pending,
-- even though they aren't a member yet.
create policy "pending requester can read the room" on rooms
  for select using (
    exists (
      select 1 from room_join_requests r
      where r.room_id = rooms.id and r.user_id = auth.uid() and r.status = 'pending'
    )
  );
