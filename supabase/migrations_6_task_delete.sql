create policy "leader can delete task assignments" on task_assignments
  for delete using (
    exists (
      select 1 from room_members m
      where m.room_id = task_assignments.room_id and m.user_id = auth.uid() and m.role = 'leader'
    )
  );
