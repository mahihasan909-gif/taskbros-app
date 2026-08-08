-- ensure_recurring_occurrences used current_date, which is the Postgres
-- server's UTC date, not Bangladesh's. Between midnight and 6 AM Dhaka time
-- (UTC+6), the server was still on "yesterday", so today's task occurrence
-- didn't get created until the server's date caught up — showing up hours
-- late on the assignee's Home screen.
create or replace function ensure_recurring_occurrences()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  today_date date := (now() at time zone 'Asia/Dhaka')::date;
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
