-- So the admin's app can hear routine changes in real time.
alter table routine_slots replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'routine_slots'
  ) then
    alter publication supabase_realtime add table routine_slots;
  end if;
end $$;
