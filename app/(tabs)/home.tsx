import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "../../components/ui/ScreenContainer";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../contexts/AuthContext";
import { useRoom } from "../../contexts/RoomContext";
import { supabase } from "../../lib/supabase";
import { localDateString } from "../../lib/date";
import {
  cancelOrphanedReminders,
  cancelTaskReminders,
  ensureNotificationPermission,
  scheduleTaskReminders,
  setupNotificationChannel,
} from "../../lib/notifications";
import type { TaskAssignment, Weekday } from "../../types/db";

const dayLabels: Record<Weekday, string> = {
  sat: "Saturday",
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
};
const dayOrder: Weekday[] = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"];

type AssignmentWithName = TaskAssignment & { assignee_name: string };

export default function Home() {
  const { session } = useAuth();
  const { loading, profile, room, members, myRole, pendingRequest, pendingRoomName } = useRoom();
  const [todayTasks, setTodayTasks] = useState<TaskAssignment[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [weekAssignments, setWeekAssignments] = useState<AssignmentWithName[]>([]);
  const [weekLoading, setWeekLoading] = useState(true);

  const loadTodayTasks = useCallback(async () => {
    if (!room || !session?.user) {
      setTasksLoading(false);
      return;
    }
    setTasksLoading(true);
    await supabase.rpc("ensure_recurring_occurrences");
    const today = localDateString(new Date());
    const { data } = await supabase
      .from("task_assignments")
      .select("*")
      .eq("room_id", room.id)
      .eq("assigned_to", session.user.id)
      .eq("date", today);
    setTodayTasks((data as TaskAssignment[]) ?? []);
    setTasksLoading(false);
  }, [room, session?.user]);

  const loadWeekAssignments = useCallback(async () => {
    if (!room || !session?.user) {
      setWeekLoading(false);
      return;
    }
    setWeekLoading(true);
    const { data } = await supabase
      .from("task_assignments")
      .select("*")
      .eq("room_id", room.id)
      .eq("assigned_to", session.user.id)
      .order("date", { ascending: true });

    const withNames = ((data as TaskAssignment[]) ?? []).map((a) => ({
      ...a,
      assignee_name: profile?.full_name ?? "You",
    }));
    setWeekAssignments(withNames);
    setWeekLoading(false);
  }, [room, session?.user, profile]);

  useEffect(() => {
    loadTodayTasks();
  }, [loadTodayTasks]);

  useEffect(() => {
    loadWeekAssignments();
  }, [loadWeekAssignments]);

  useEffect(() => {
    ensureNotificationPermission();
    setupNotificationChannel();
  }, []);

  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (appStateRef.current !== "active" && nextState === "active") {
        loadTodayTasks();
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [loadTodayTasks]);

  async function handleRefresh() {
    await Promise.all([loadTodayTasks(), loadWeekAssignments()]);
  }

  useEffect(() => {
    const activeIds = todayTasks.filter((t) => t.status !== "done").map((t) => t.id);
    cancelOrphanedReminders(activeIds);
    for (const task of todayTasks) {
      if (task.status === "done") {
        cancelTaskReminders(task.id);
      } else {
        scheduleTaskReminders(task);
      }
    }
  }, [todayTasks]);

  async function toggleDone(task: TaskAssignment) {
    const nextStatus = task.status === "done" ? "pending" : "done";
    if (nextStatus === "done") {
      await cancelTaskReminders(task.id);
    }
    await supabase.from("task_assignments").update({ status: nextStatus }).eq("id", task.id);
    loadTodayTasks();
    loadWeekAssignments();
  }

  const pendingTodayTasks = todayTasks.filter((t) => t.status !== "done");

  const weekGrouped = dayOrder
    .map((day) => ({ day, items: weekAssignments.filter((a) => a.day === day) }))
    .filter((g) => g.items.length > 0);

  if (loading) {
    return (
      <ScreenContainer scroll={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#6C5CE7" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View className="pt-4 pb-2 flex-row items-start justify-between">
        <View>
          <Text className="text-textMuted text-sm">Welcome back</Text>
          <Text className="text-text text-3xl font-extrabold mt-1">
            Hey, {profile?.full_name?.split(" ")[0] ?? "there"} 👋
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleRefresh}
          disabled={tasksLoading || weekLoading}
          className="w-10 h-10 mt-1 rounded-full bg-surface2 items-center justify-center"
        >
          {tasksLoading || weekLoading ? (
            <ActivityIndicator size="small" color="#6C5CE7" />
          ) : (
            <Ionicons name="refresh" size={18} color="#F2F2F7" />
          )}
        </TouchableOpacity>
      </View>

      {pendingRequest ? (
        <Card className="mt-4">
          <Text className="text-text text-lg font-bold">Waiting for approval</Text>
          <Text className="text-textMuted text-sm mt-1">
            Your request to join {pendingRoomName ?? "this room"} is pending admin approval.
          </Text>
        </Card>
      ) : !room ? (
        <Card className="mt-4">
          <Text className="text-text text-lg font-bold">No room yet</Text>
          <Text className="text-textMuted text-sm mt-1 mb-4">
            Create a room as admin, or join one with a code your admin shared.
          </Text>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button label="Create Room" onPress={() => router.push("/room/create")} />
            </View>
            <View className="flex-1">
              <Button label="Join Room" variant="outline" onPress={() => router.push("/room/join")} />
            </View>
          </View>
        </Card>
      ) : (
        <>
          <Card className="mt-4">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-2 flex-1 pr-2">
                <Text className="text-text text-lg font-bold" numberOfLines={1}>
                  {room.name}
                </Text>
                {myRole === "leader" ? <Badge label="Admin" tone="primary" /> : null}
              </View>
              <Badge label={`${members.length} member${members.length === 1 ? "" : "s"}`} tone="accent" />
            </View>
            <Text className="text-textMuted text-sm">
              Room code: <Text className="text-text font-semibold">{room.join_code}</Text>
            </Text>
          </Card>

          <View className="flex-row items-center justify-between mt-6 mb-3">
            <Text className="text-text text-lg font-bold">Today's tasks</Text>
            <Text className="text-primary text-sm font-semibold" onPress={() => router.push("/(tabs)/schedule")}>
              View all
            </Text>
          </View>

          {tasksLoading ? (
            <ActivityIndicator color="#6C5CE7" />
          ) : pendingTodayTasks.length === 0 ? (
            <Card className="items-center py-8">
              <Text className="text-textMuted text-sm text-center">
                {todayTasks.length > 0
                  ? "All done for today. Nice work!"
                  : "Nothing assigned to you today. Check the AI Schedule tab for the full week."}
              </Text>
            </Card>
          ) : (
            pendingTodayTasks.map((t) => (
              <Card
                key={t.id}
                className="mb-3 flex-row items-center justify-between"
                onTouchEnd={() => toggleDone(t)}
              >
                <View>
                  <Text className="text-text font-semibold">{t.task_title}</Text>
                  {t.time_slot ? <Text className="text-textMuted text-xs mt-1">{t.time_slot}</Text> : null}
                </View>
                <Badge label="Pending" tone="warn" />
              </Card>
            ))
          )}

          <View className="flex-row items-center justify-between mt-6 mb-3">
            <Text className="text-text text-lg font-bold">Your week</Text>
            <Text className="text-primary text-sm font-semibold" onPress={() => router.push("/(tabs)/schedule")}>
              Full schedule
            </Text>
          </View>

          {weekLoading ? (
            <ActivityIndicator color="#6C5CE7" />
          ) : weekGrouped.length === 0 ? (
            <Card className="items-center py-8">
              <Text className="text-textMuted text-sm text-center">
                Nothing assigned to you this week.
              </Text>
            </Card>
          ) : (
            weekGrouped.map(({ day, items }) => (
              <View key={day} className="mb-4">
                <Text className="text-textMuted text-xs font-bold mb-2">{dayLabels[day]}</Text>
                {items.map((item) => (
                  <Card key={item.id} className="mb-2 flex-row items-center justify-between">
                    <View className="flex-1 pr-3">
                      <Text className="text-text text-sm font-semibold">{item.task_title}</Text>
                      {item.time_slot ? (
                        <Text className="text-textMuted text-xs mt-0.5">{item.time_slot}</Text>
                      ) : null}
                    </View>
                    <Badge
                      label={item.status === "done" ? "Done" : "Pending"}
                      tone={item.status === "done" ? "accent" : "warn"}
                    />
                  </Card>
                ))}
              </View>
            ))
          )}
        </>
      )}
    </ScreenContainer>
  );
}
