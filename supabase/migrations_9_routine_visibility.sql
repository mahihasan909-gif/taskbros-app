-- routine_slots was only readable by the owner, so a leader building the
-- free-time table couldn't see other members' busy slots at all.
create policy "roommates can read each other's routine slots" on routine_slots
  for select using (
    user_id in (select user_id from room_members where room_id in (select my_room_ids()))
  );
