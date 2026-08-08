import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import notifee, {
  AndroidCategory,
  AndroidImportance,
  AndroidVisibility,
  TriggerType,
  type TimestampTrigger,
} from "@notifee/react-native";
import { Platform } from "react-native";
import { supabase } from "./supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const ALARM_CHANNEL_ID = "task-alarms";
const REPEAT_COUNT = 5;
const REPEAT_GAP_MINUTES = 2;

export async function ensureNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    await Notifications.requestPermissionsAsync();
  }
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus >= 1;
}

export async function setupNotificationChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("task-reminders", {
    name: "Task reminders",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
  });
  await notifee.createChannel({
    id: ALARM_CHANNEL_ID,
    name: "Task alarms",
    importance: AndroidImportance.HIGH,
    sound: "default",
    vibration: true,
    vibrationPattern: [300, 500, 300, 500],
    bypassDnd: true,
  });
}

// Registers this device for server-driven push reminders (works even if the
// app was never opened that day, unlike the local alarm scheduling above).
export async function registerPushToken(userId: string) {
  if (!Device.isDevice) {
    console.log("[push] not a physical device, skipping");
    return;
  }
  const { status } = await Notifications.getPermissionsAsync();
  console.log("[push] permission status:", status);
  if (status !== "granted") return;

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    console.log("[push] requesting token with projectId:", projectId);
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log("[push] got token:", tokenData.data);
    const { error } = await supabase
      .from("push_tokens")
      .upsert({ user_id: userId, token: tokenData.data, updated_at: new Date().toISOString() }, { onConflict: "token" });
    if (error) console.log("[push] upsert error:", JSON.stringify(error));
    else console.log("[push] token saved for user:", userId);
  } catch (err) {
    console.log("[push] token registration failed:", JSON.stringify(err), err instanceof Error ? err.message : err);
  }
}

export async function cancelTaskReminders(taskId: string) {
  const triggerIds = await notifee.getTriggerNotificationIds();
  const mine = triggerIds.filter((id) => id.startsWith(`task-${taskId}-`));
  await Promise.all(mine.map((id) => notifee.cancelTriggerNotification(id)));
  await Promise.all(mine.map((id) => notifee.cancelDisplayedNotification(id)));
}

// Fires immediately (used to alert the admin the moment someone taps Done).
export async function notifyTaskDone(assigneeName: string, taskTitle: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${assigneeName} done the work`,
      body: taskTitle,
      sound: "default",
    },
    trigger: null,
  });
}

// Fires immediately (used to alert the admin when a member's routine changes).
export async function notifyRoutineChanged(memberName: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${memberName} updated their routine`,
      body: "Tap AI Suggest to see the new free-time table.",
      sound: "default",
    },
    trigger: null,
  });
}

// Cancels any scheduled reminder whose task is no longer in the active set —
// covers a task being deleted or reassigned away from this device's owner.
export async function cancelOrphanedReminders(activeTaskIds: string[]) {
  const triggerIds = await notifee.getTriggerNotificationIds();
  const orphaned = triggerIds.filter((id) => {
    const match = id.match(/^task-(.+)-\d+$/);
    return match && !activeTaskIds.includes(match[1]);
  });
  await Promise.all(orphaned.map((id) => notifee.cancelTriggerNotification(id)));
  await Promise.all(orphaned.map((id) => notifee.cancelDisplayedNotification(id)));
}

// task.date: "YYYY-MM-DD", task.scheduled_time: "HH:MM:SS" (24hr)
// Alarm-style: full-screen alert, loops its sound, marked as an alarm so it
// bypasses Do Not Disturb (once the user grants that access once).
export async function scheduleTaskReminders(task: {
  id: string;
  task_title: string;
  date: string;
  scheduled_time: string | null;
}) {
  await cancelTaskReminders(task.id);
  if (!task.scheduled_time) {
    console.log(`[notif] "${task.task_title}" has no scheduled_time, skipping`);
    return;
  }

  const [h, m] = task.scheduled_time.split(":").map(Number);
  const [y, mo, d] = task.date.split("-").map(Number);
  const baseTime = new Date(y, mo - 1, d, h, m, 0, 0);

  const now = new Date();
  let scheduledCount = 0;

  for (let i = 0; i < REPEAT_COUNT; i++) {
    const fireAt = new Date(baseTime.getTime() + i * REPEAT_GAP_MINUTES * 60 * 1000);
    if (fireAt.getTime() <= now.getTime()) continue;

    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: fireAt.getTime(),
      alarmManager: { allowWhileIdle: true },
    };

    await notifee.createTriggerNotification(
      {
        id: `task-${task.id}-${i}`,
        title: i === 0 ? `⏰ Time for: ${task.task_title}` : `⏰ Reminder: ${task.task_title}`,
        body: "Tap Done on Today's tasks once you've finished.",
        android: {
          channelId: ALARM_CHANNEL_ID,
          category: AndroidCategory.ALARM,
          importance: AndroidImportance.HIGH,
          visibility: AndroidVisibility.PUBLIC,
          fullScreenAction: { id: "default" },
          pressAction: { id: "default" },
          sound: "default",
          loopSound: true,
          autoCancel: false,
        },
      },
      trigger
    );
    scheduledCount++;
    console.log(`[notif] scheduled "${task.task_title}" #${i} at ${fireAt.toString()}`);
  }
  console.log(`[notif] "${task.task_title}": baseTime=${baseTime.toString()} now=${now.toString()} scheduled=${scheduledCount}/${REPEAT_COUNT}`);
}
