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
import { useAuth } from "../../contexts/AuthContext";
import type { RoutineSlot, Weekday } from "../../types/db";

const labelSuggestions = ["Class", "Tuition", "Office", "Job", "Exam", "Lab", "Prayer"];

const days: { key: Weekday; label: string }[] = [
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
];

export default function Routine() {
  const { session } = useAuth();
  const [activeDay, setActiveDay] = useState<Weekday>("sat");
  const [slots, setSlots] = useState<RoutineSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [startTime, setStartTime] = useState(new Date(2000, 0, 1, 8, 0));
  const [endTime, setEndTime] = useState(new Date(2000, 0, 1, 13, 0));
  const [pickerFor, setPickerFor] = useState<"start" | "end" | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    const { data } = await supabase
      .from("routine_slots")
      .select("*")
      .eq("user_id", session.user.id);
    setSlots((data as RoutineSlot[]) ?? []);
    setLoading(false);
  }, [session?.user]);

  useEffect(() => {
    load();
  }, [load]);

  const daySlots = slots.filter((s) => s.day === activeDay);

  function to24(d: Date) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  function to12(d: Date) {
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
  }

  async function handleAddSlot() {
    setFormError("");
    if (!label.trim()) {
      setFormError("Give this slot a name (e.g. Class, Office).");
      return;
    }
    if (to24(endTime) <= to24(startTime)) {
      setFormError("End time must be after start time.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("routine_slots").insert({
      user_id: session!.user.id,
      day: activeDay,
      start_time: `${to24(startTime)}:00`,
      end_time: `${to24(endTime)}:00`,
      label: label.trim(),
      is_busy: true,
    });
    setSaving(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    setLabel("");
    setStartTime(new Date(2000, 0, 1, 8, 0));
    setEndTime(new Date(2000, 0, 1, 13, 0));
    setModalOpen(false);
    load();
  }

  async function handleDeleteSlot(id: string) {
    await supabase.from("routine_slots").delete().eq("id", id);
    load();
  }

  function dbTimeTo12(t: string) {
    const [hStr, mStr] = t.split(":");
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${mStr} ${ampm}`;
  }

  function handleClearRoutine() {
    Alert.alert(
      "Clear your routine?",
      "This removes every busy slot. Use this when your semester changes and you need to start over.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await supabase.from("routine_slots").delete().eq("user_id", session!.user.id);
            load();
          },
        },
      ]
    );
  }

  return (
    <ScreenContainer scroll={false}>
      <View className="pt-4 pb-2">
        <Text className="text-text text-3xl font-extrabold">My Routine</Text>
        <Text className="text-textMuted text-base mt-1">
          Add your class or work hours — AI uses the gaps.
        </Text>
      </View>

      <View className="flex-row items-center justify-between mt-4 mb-2">
        <Text className="text-textMuted text-xs">Tap each day and add as many busy blocks as you need — class, tuition, job, whatever.</Text>
        {slots.length > 0 ? (
          <TouchableOpacity onPress={handleClearRoutine} className="flex-row items-center gap-1">
            <Ionicons name="refresh-outline" size={14} color="#FF5C72" />
            <Text className="text-danger text-xs font-semibold">Clear routine</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-2"
        contentContainerStyle={{ gap: 8 }}
      >
        {days.map((d) => {
          const active = d.key === activeDay;
          return (
            <TouchableOpacity
              key={d.key}
              onPress={() => setActiveDay(d.key)}
              className={`px-4 py-3 rounded-2xl border ${
                active ? "bg-primary border-primary" : "bg-surface border-border"
              }`}
            >
              <Text className={`font-semibold text-sm ${active ? "text-white" : "text-textMuted"}`}>
                {d.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#6C5CE7" />
        </View>
      ) : (
        <ScrollView className="flex-1 mt-3" showsVerticalScrollIndicator={false}>
          {daySlots.length === 0 ? (
            <Card className="items-center py-10">
              <Ionicons name="sunny-outline" size={28} color="#00E5A0" />
              <Text className="text-text font-semibold mt-3">Free all day</Text>
              <Text className="text-textMuted text-sm mt-1 text-center">
                No busy slots added for this day yet.
              </Text>
            </Card>
          ) : (
            daySlots.map((s) => (
              <Card key={s.id} className="mb-3 flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-text font-semibold">{s.label}</Text>
                  <Text className="text-textMuted text-xs mt-1">
                    {dbTimeTo12(s.start_time)} – {dbTimeTo12(s.end_time)}
                  </Text>
                </View>
                <View className="flex-row items-center gap-3">
                  <Badge label="Busy" tone="warn" />
                  <TouchableOpacity
                    onPress={() => handleDeleteSlot(s.id)}
                    className="w-8 h-8 rounded-full bg-danger/15 items-center justify-center"
                  >
                    <Ionicons name="remove" size={20} color="#FF5C72" />
                  </TouchableOpacity>
                </View>
              </Card>
            ))
          )}

          <TouchableOpacity
            onPress={() => setModalOpen(true)}
            className="mt-2 flex-row items-center justify-center gap-2 py-4"
          >
            <View className="w-9 h-9 rounded-full bg-primary items-center justify-center">
              <Ionicons name="add" size={22} color="#FFFFFF" />
            </View>
            <Text className="text-primary font-semibold">
              Add another busy slot for {days.find((d) => d.key === activeDay)?.label}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-bg rounded-t-3xl p-5 pb-8 border-t border-border">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-text text-xl font-bold">
                Add slot — {days.find((d) => d.key === activeDay)?.label}
              </Text>
              <Ionicons name="close" size={22} color="#8A8D9A" onPress={() => setModalOpen(false)} />
            </View>

            <TextField label="Label" placeholder="e.g. Class, Office" value={label} onChangeText={setLabel} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="-mt-2 mb-4"
              contentContainerStyle={{ gap: 8 }}
            >
              {labelSuggestions.map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setLabel(s)}
                  className={`px-3 py-2 rounded-xl border ${
                    label === s ? "bg-primary border-primary" : "bg-surface border-border"
                  }`}
                >
                  <Text className={`text-xs font-semibold ${label === s ? "text-white" : "text-textMuted"}`}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View className="flex-row gap-3 mb-4">
              <View className="flex-1">
                <Text className="text-textMuted text-sm mb-2 ml-1">Start</Text>
                <TouchableOpacity
                  onPress={() => setPickerFor("start")}
                  className="bg-surface border border-border rounded-2xl px-4 py-4"
                >
                  <Text className="text-text font-semibold">{to12(startTime)}</Text>
                </TouchableOpacity>
              </View>
              <View className="flex-1">
                <Text className="text-textMuted text-sm mb-2 ml-1">End</Text>
                <TouchableOpacity
                  onPress={() => setPickerFor("end")}
                  className="bg-surface border border-border rounded-2xl px-4 py-4"
                >
                  <Text className="text-text font-semibold">{to12(endTime)}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {pickerFor ? (
              <DateTimePicker
                value={pickerFor === "start" ? startTime : endTime}
                mode="time"
                is24Hour={false}
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_event, selected) => {
                  if (Platform.OS === "android") setPickerFor(null);
                  if (!selected) return;
                  if (pickerFor === "start") setStartTime(selected);
                  else setEndTime(selected);
                }}
              />
            ) : null}

            {formError ? <Text className="text-danger text-sm mb-3">{formError}</Text> : null}

            <Button label="Save slot" onPress={handleAddSlot} loading={saving} />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
