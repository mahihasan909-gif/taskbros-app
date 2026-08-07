import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { ScreenContainer } from "../../components/ui/ScreenContainer";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { supabase } from "../../lib/supabase";
import { useRoom } from "../../contexts/RoomContext";
import type { RecurringTask, RoutineSlot, Weekday } from "../../types/db";

function to12(t: string) {
  const [hStr, mStr] = t.split(":");
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${mStr} ${ampm}`;
}

function freeWindowsFor(busy: { start_time: string; end_time: string }[]): string {
  if (busy.length === 0) return "Free all day";

  const intervals = busy
    .map((b) => ({ start: b.start_time.slice(0, 5), end: b.end_time.slice(0, 5) }))
    .sort((a, b) => a.start.localeCompare(b.start));

  const busyText = intervals.map((b) => `${to12(b.start)}-${to12(b.end)}`).join(", ");
  const lastEnd = intervals.reduce((max, b) => (b.end > max ? b.end : max), "00:00");

  if (lastEnd >= "23:59") return `Busy ${busyText}`;
  return `Busy ${busyText} · Free after ${to12(lastEnd)}`;
}

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

type RecurringWithName = RecurringTask & { assignee_name: string };

export default function Schedule() {
  const { room, members, myRole } = useRoom();
  const [assignments, setAssignments] = useState<RecurringWithName[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [freeTableOpen, setFreeTableOpen] = useState(false);
  const [freeTableLoading, setFreeTableLoading] = useState(false);
  const [routineSlots, setRoutineSlots] = useState<RoutineSlot[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<Weekday>("sat");
  const [taskTitle, setTaskTitle] = useState("");
  const [hasTime, setHasTime] = useState(false);
  const [taskTime, setTaskTime] = useState(new Date(2000, 0, 1, 18, 0));
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    if (!room) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("recurring_tasks")
      .select("*")
      .eq("room_id", room.id)
      .eq("active", true);

    const withNames = ((data as RecurringTask[]) ?? []).map((a) => ({
      ...a,
      assignee_name: members.find((m) => m.user_id === a.assigned_to)?.profile.full_name ?? "Unknown",
    }));
    setAssignments(withNames);
    setLoading(false);
  }, [room, members]);

  useEffect(() => {
    load();
  }, [load]);

  function requireAdmin(): boolean {
    if (myRole !== "leader") {
      Alert.alert("Not allowed", "You're not admin. Only the admin can do this.");
      return false;
    }
    return true;
  }

  async function handleShowFreeTable() {
    if (!requireAdmin()) return;
    if (!room || members.length === 0) return;
    setError("");
    setFreeTableLoading(true);
    const memberIds = members.map((m) => m.user_id);
    const { data, error: fetchError } = await supabase
      .from("routine_slots")
      .select("*")
      .in("user_id", memberIds);
    setFreeTableLoading(false);
    if (fetchError) {
      setError(fetchError.message);
      return;
    }
    setRoutineSlots((data as RoutineSlot[]) ?? []);
    setFreeTableOpen(true);
  }

  function openAddModal() {
    if (!requireAdmin()) return;
    setSelectedMember(members[0]?.user_id ?? null);
    setSelectedDay("sat");
    setTaskTitle("");
    setHasTime(false);
    setTaskTime(new Date(2000, 0, 1, 18, 0));
    setFormError("");
    setModalOpen(true);
  }

  async function handleAddTask() {
    if (!requireAdmin()) return;
    setFormError("");
    if (!selectedMember) {
      setFormError("Pick who this task is for.");
      return;
    }
    if (!taskTitle.trim()) {
      setFormError("Give the task a name.");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error: insertError } = await supabase.from("recurring_tasks").insert({
      room_id: room!.id,
      assigned_to: selectedMember,
      day: selectedDay,
      task_title: taskTitle.trim(),
      time_slot: hasTime ? to12(`${taskTime.getHours()}:${String(taskTime.getMinutes()).padStart(2, "0")}`) : null,
      scheduled_time: hasTime
        ? `${String(taskTime.getHours()).padStart(2, "0")}:${String(taskTime.getMinutes()).padStart(2, "0")}:00`
        : null,
      created_by: userData.user!.id,
    });
    setSaving(false);
    if (insertError) {
      setFormError(insertError.message);
      return;
    }
    setModalOpen(false);
    load();
  }

  async function handleDeleteTask(id: string) {
    if (!requireAdmin()) return;
    await supabase.from("recurring_tasks").delete().eq("id", id);
    load();
  }

  const grouped = dayOrder
    .map((day) => ({ day, items: assignments.filter((a) => a.day === day) }))
    .filter((g) => g.items.length > 0);

  return (
    <ScreenContainer>
      <View className="pt-4 pb-2 flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-text text-3xl font-extrabold">AI Schedule</Text>
          <Text className="text-textMuted text-base mt-1">
            Weekly rota — repeats every week until the admin changes it.
          </Text>
        </View>
        <View className="w-11 h-11 rounded-2xl bg-primary/20 items-center justify-center">
          <Ionicons name="sparkles" size={20} color="#6C5CE7" />
        </View>
      </View>

      {!room ? (
        <Card className="mt-4 items-center py-10">
          <Text className="text-textMuted text-sm text-center">Join or create a room first.</Text>
        </Card>
      ) : (
        <>
          {myRole === "leader" ? (
            <>
              <Card className="mt-4 flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-text font-semibold">AI suggest</Text>
                  <Text className="text-textMuted text-xs mt-1">
                    See everyone's free time this week, then assign tasks yourself
                  </Text>
                </View>
                <View className="w-32">
                  <Button label="AI Suggest" onPress={handleShowFreeTable} loading={freeTableLoading} />
                </View>
              </Card>

              <TouchableOpacity
                onPress={openAddModal}
                className="mt-3 border border-dashed border-border rounded-2xl py-4 items-center flex-row justify-center gap-2"
              >
                <Ionicons name="add-circle-outline" size={20} color="#6C5CE7" />
                <Text className="text-primary font-semibold">Assign a task</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {error ? <Text className="text-danger text-sm mt-3">{error}</Text> : null}

          {loading ? (
            <View className="mt-10 items-center">
              <ActivityIndicator color="#6C5CE7" />
            </View>
          ) : grouped.length === 0 ? (
            <Card className="mt-6 items-center py-10">
              <Text className="text-textMuted text-sm text-center">
                No schedule yet.{" "}
                {myRole === "leader" ? "Assign a task above to set the weekly rota." : "Ask your admin to set one up."}
              </Text>
            </Card>
          ) : (
            <View className="mt-6">
              {grouped.map(({ day, items }) => (
                <View key={day} className="mb-5">
                  <Text className="text-text font-bold text-base mb-2">{dayLabels[day]}</Text>
                  {items.map((item) => (
                    <Card key={item.id} className="mb-2 flex-row items-center justify-between">
                      <View className="flex-row items-center flex-1">
                        <View className="w-10 h-10 rounded-full bg-surface2 items-center justify-center mr-3">
                          <Text className="text-text text-xs font-bold">{item.assignee_name[0]}</Text>
                        </View>
                        <View className="flex-1">
                          <Text className="text-text font-semibold">{item.assignee_name}</Text>
                          <Text className="text-textMuted text-xs mt-1">{item.task_title}</Text>
                        </View>
                      </View>
                      <View className="flex-row items-center gap-3">
                        <Badge label={item.time_slot ?? "Anytime"} tone="accent" />
                        {myRole === "leader" ? (
                          <Ionicons
                            name="trash-outline"
                            size={18}
                            color="#FF5C72"
                            onPress={() => handleDeleteTask(item.id)}
                          />
                        ) : null}
                      </View>
                    </Card>
                  ))}
                </View>
              ))}
            </View>
          )}
        </>
      )}

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-bg rounded-t-3xl p-5 pb-8 border-t border-border">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-text text-xl font-bold">Assign a task</Text>
              <Ionicons name="close" size={22} color="#8A8D9A" onPress={() => setModalOpen(false)} />
            </View>

            <Text className="text-textMuted text-sm mb-2 ml-1">Who</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-4"
              contentContainerStyle={{ gap: 8 }}
            >
              {members.map((m) => {
                const active = m.user_id === selectedMember;
                return (
                  <TouchableOpacity
                    key={m.user_id}
                    onPress={() => setSelectedMember(m.user_id)}
                    className={`px-4 py-3 rounded-2xl border ${
                      active ? "bg-primary border-primary" : "bg-surface border-border"
                    }`}
                  >
                    <Text className={`font-semibold text-sm ${active ? "text-white" : "text-textMuted"}`}>
                      {m.profile.full_name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text className="text-textMuted text-sm mb-2 ml-1">Day</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-4"
              contentContainerStyle={{ gap: 8 }}
            >
              {dayOrder.map((d) => {
                const active = d === selectedDay;
                return (
                  <TouchableOpacity
                    key={d}
                    onPress={() => setSelectedDay(d)}
                    className={`px-4 py-3 rounded-2xl border ${
                      active ? "bg-primary border-primary" : "bg-surface border-border"
                    }`}
                  >
                    <Text className={`font-semibold text-sm ${active ? "text-white" : "text-textMuted"}`}>
                      {dayLabels[d].slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TextField
              label="Task"
              placeholder="e.g. Grocery run, Clean kitchen"
              value={taskTitle}
              onChangeText={setTaskTitle}
            />

            <Text className="text-textMuted text-sm mb-2 ml-1">Time (optional)</Text>
            <View className="flex-row gap-3 mb-4">
              <TouchableOpacity
                onPress={() => setHasTime(false)}
                className={`flex-1 px-4 py-3 rounded-2xl border items-center ${
                  !hasTime ? "bg-primary border-primary" : "bg-surface border-border"
                }`}
              >
                <Text className={`font-semibold text-sm ${!hasTime ? "text-white" : "text-textMuted"}`}>
                  Anytime
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setHasTime(true);
                  setShowTimePicker(true);
                }}
                className={`flex-1 px-4 py-3 rounded-2xl border items-center ${
                  hasTime ? "bg-primary border-primary" : "bg-surface border-border"
                }`}
              >
                <Text className={`font-semibold text-sm ${hasTime ? "text-white" : "text-textMuted"}`}>
                  {hasTime ? to12(`${taskTime.getHours()}:${String(taskTime.getMinutes()).padStart(2, "0")}`) : "Set a time"}
                </Text>
              </TouchableOpacity>
            </View>
            {hasTime ? (
              <Text className="text-textMuted text-xs -mt-3 mb-4 ml-1">
                A notification with sound reminds them at this time, repeating until they tap Done.
              </Text>
            ) : null}

            {showTimePicker ? (
              <DateTimePicker
                value={taskTime}
                mode="time"
                is24Hour={false}
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_event, selected) => {
                  if (Platform.OS === "android") setShowTimePicker(false);
                  if (selected) setTaskTime(selected);
                }}
              />
            ) : null}

            {formError ? <Text className="text-danger text-sm mb-3">{formError}</Text> : null}

            <Button label="Assign task" onPress={handleAddTask} loading={saving} />
          </View>
        </View>
      </Modal>

      <Modal
        visible={freeTableOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFreeTableOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-bg rounded-t-3xl p-5 pb-8 border-t border-border" style={{ maxHeight: "85%" }}>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-text text-xl font-bold">Who's free when</Text>
              <Ionicons name="close" size={22} color="#8A8D9A" onPress={() => setFreeTableOpen(false)} />
            </View>
            <Text className="text-textMuted text-xs mb-4">
              Free time this week — pick someone and tap "Assign a task" above.
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                <View className="flex-row">
                  <View className="w-16 justify-end pb-2">
                    <Text className="text-textMuted text-xs font-bold">Day</Text>
                  </View>
                  {members.map((m) => (
                    <View key={m.user_id} className="w-40 px-2 pb-2 justify-end">
                      <Text className="text-text text-xs font-bold" numberOfLines={1}>
                        {m.profile.full_name}
                      </Text>
                    </View>
                  ))}
                </View>
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                  {dayOrder.map((day) => (
                    <View key={day} className="flex-row border-t border-border py-3">
                      <View className="w-16">
                        <Text className="text-text text-xs font-semibold">{dayLabels[day].slice(0, 3)}</Text>
                      </View>
                      {members.map((m) => {
                        const busy = routineSlots.filter((s) => s.user_id === m.user_id && s.day === day);
                        return (
                          <View key={m.user_id} className="w-40 px-2">
                            <Text className="text-textMuted text-xs">{freeWindowsFor(busy)}</Text>
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </ScrollView>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
