-- Structured time for notification scheduling. time_slot stays as the
-- free-text display label; scheduled_time is the exact HH:MM used to fire
-- reminders.
alter table task_assignments add column if not exists scheduled_time time;
