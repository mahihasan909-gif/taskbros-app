// Supabase Edge Function: send-reminders
// Runs on a cron schedule (every minute). Sends task-time push reminders and
// "X done the work" pings to the room admin — entirely server-side, so it
// works even if nobody has opened the app that day.
//
// Deploy: supabase functions deploy send-reminders --no-verify-jwt
// Secret:  supabase secrets set CRON_SECRET=<random-string>

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const REPEAT_COUNT = 5;
const REPEAT_GAP_MINUTES = 2;
const DHAKA_OFFSET = "+06:00";

type PushMessage = {
  to: string;
  title: string;
  body: string;
  sound: "default";
  priority: "high";
  channelId?: string;
  data?: Record<string, unknown>;
};

async function sendPush(messages: PushMessage[]) {
  if (messages.length === 0) return;
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(batch),
    });
  }
}

Deno.serve(async (req) => {
  if (CRON_SECRET) {
    const provided = req.headers.get("x-cron-secret");
    if (provided !== CRON_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const dhakaNow = new Date(Date.now() + 6 * 60 * 60 * 1000);
  const todayStr = dhakaNow.toISOString().slice(0, 10);
  const yesterday = new Date(dhakaNow.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const messages: PushMessage[] = [];

  // --- Task-time reminders ---
  const { data: pending } = await admin
    .from("task_assignments")
    .select("id, room_id, assigned_to, task_title, date, scheduled_time, reminders_sent")
    .eq("status", "pending")
    .in("date", [yesterday, todayStr])
    .not("scheduled_time", "is", null);

  const reminderUpdates: { id: string; reminders_sent: number }[] = [];

  for (const task of pending ?? []) {
    const scheduledAt = new Date(`${task.date}T${task.scheduled_time}${DHAKA_OFFSET}`);
    const elapsedMinutes = (Date.now() - scheduledAt.getTime()) / 60000;
    if (elapsedMinutes < 0 || elapsedMinutes >= REPEAT_COUNT * REPEAT_GAP_MINUTES) continue;

    const step = Math.floor(elapsedMinutes / REPEAT_GAP_MINUTES);
    if (step < (task.reminders_sent ?? 0)) continue;

    const { data: tokens } = await admin
      .from("push_tokens")
      .select("token")
      .eq("user_id", task.assigned_to);

    for (const t of tokens ?? []) {
      messages.push({
        to: t.token,
        title: step === 0 ? `⏰ Time for: ${task.task_title}` : `⏰ Reminder: ${task.task_title}`,
        body: "Tap Done on Today's tasks once you've finished.",
        sound: "default",
        priority: "high",
        channelId: "task-alarms",
        data: { taskId: task.id },
      });
    }
    reminderUpdates.push({ id: task.id, reminders_sent: step + 1 });
  }

  for (const u of reminderUpdates) {
    await admin.from("task_assignments").update({ reminders_sent: u.reminders_sent }).eq("id", u.id);
  }

  // --- "Done the work" pings to the admin ---
  const { data: doneTasks } = await admin
    .from("task_assignments")
    .select("id, room_id, assigned_to, task_title")
    .eq("status", "done")
    .eq("admin_notified", false)
    .in("date", [yesterday, todayStr]);

  const doneIds: string[] = [];

  for (const task of doneTasks ?? []) {
    const { data: leaderRow } = await admin
      .from("room_members")
      .select("user_id")
      .eq("room_id", task.room_id)
      .eq("role", "leader")
      .maybeSingle();

    const { data: assigneeProfile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", task.assigned_to)
      .maybeSingle();

    if (leaderRow) {
      const { data: tokens } = await admin
        .from("push_tokens")
        .select("token")
        .eq("user_id", leaderRow.user_id);

      for (const t of tokens ?? []) {
        messages.push({
          to: t.token,
          title: `${assigneeProfile?.full_name ?? "Someone"} done the work`,
          body: task.task_title,
          sound: "default",
          priority: "high",
        });
      }
    }
    doneIds.push(task.id);
  }

  if (doneIds.length > 0) {
    await admin.from("task_assignments").update({ admin_notified: true }).in("id", doneIds);
  }

  await sendPush(messages);

  return new Response(JSON.stringify({ sent: messages.length }), {
    headers: { "content-type": "application/json" },
  });
});
