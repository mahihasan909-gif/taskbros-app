import { Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "../../components/ui/ScreenContainer";

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View className="mb-5">
      <Text className="text-text font-bold text-base mb-1.5">{title}</Text>
      <Text className="text-textMuted text-sm leading-relaxed">{children}</Text>
    </View>
  );
}

export default function Privacy() {
  return (
    <ScreenContainer>
      <View className="pt-4 pb-4 flex-row items-center gap-3">
        <Ionicons name="chevron-back" size={24} color="#F2F2F7" onPress={() => router.back()} />
        <Text className="text-text text-2xl font-extrabold">Privacy</Text>
      </View>

      <Section title="What we store">
        Your name, profile photo, room membership, your weekly busy-hours routine, and the chores
        assigned to you. This is stored securely on Supabase and is only used to run TaskBros —
        matching everyone's free time and keeping the chore schedule fair.
      </Section>

      <Section title="Who can see it">
        Only people in your own room can see your name, profile photo, busy hours, and assigned
        chores. Nobody outside your room can see any of it. Your admin can additionally see
        everyone's busy-hours routine to plan the weekly schedule.
      </Section>

      <Section title="AI Suggest">
        The "AI Suggest" free-time table is calculated entirely on your own device from routines
        already stored in the room — no data is sent to any external AI service for this.
      </Section>

      <Section title="Notifications">
        Task reminders are scheduled locally on your phone. When you mark a task done, your
        room's admin is notified in real time so they know it's finished.
      </Section>

      <Section title="Account deletion">
        Leaving a room removes your membership and assigned chores from that room, but keeps your
        account. To fully delete your account and data, contact your admin or reach out via Help
        & support.
      </Section>

      <Section title="Third parties">
        TaskBros does not sell or share your data with advertisers or third parties. Supabase
        (our backend host) processes data only to run the app.
      </Section>
    </ScreenContainer>
  );
}
