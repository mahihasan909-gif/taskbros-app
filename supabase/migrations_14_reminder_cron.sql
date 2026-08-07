create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'send-reminders-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://dzbwuqnxxpgylkmnuuuw.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '9dc1b23ef60971ba74b5b85dbaa8784475128c0006a2fef5'),
    body := '{}'::jsonb
  );
  $$
);
