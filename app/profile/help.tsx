import { Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "../../components/ui/ScreenContainer";
import { Card } from "../../components/ui/Card";

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <Card className="mb-3">
      <Text className="text-text font-semibold mb-1.5">{q}</Text>
      <Text className="text-textMuted text-sm leading-relaxed">{a}</Text>
    </Card>
  );
}

export default function Help() {
  return (
    <ScreenContainer>
      <View className="pt-4 pb-4 flex-row items-center gap-3">
        <Ionicons name="chevron-back" size={24} color="#F2F2F7" onPress={() => router.back()} />
        <Text className="text-text text-2xl font-extrabold">Help & support</Text>
      </View>

      <Faq
        q="How do I create or join a room?"
        a="From the Room tab, tap Create Room to start a new mess and become its admin, or tap Join Room and enter the code your admin shared. Joining needs the admin's approval before you're in."
      />
      <Faq
        q="How do I add my busy hours?"
        a="Go to the Routine tab, pick a day, and tap the + button to add each class, tuition, or work block. Add as many as you need per day — this is what the admin uses to see when you're free."
      />
      <Faq
        q="What does AI Suggest do?"
        a="On the AI Schedule tab, the admin taps AI Suggest to see a table of everyone's free time this week, calculated from routines. The admin then manually assigns chores based on that."
      />
      <Faq
        q="How do assigned chores work?"
        a="Once the admin assigns you a chore for a day, it repeats every week on that same day automatically — no need to reassign it weekly. It keeps showing up until the admin removes it."
      />
      <Faq
        q="How do reminders work?"
        a="If the admin sets a time for your chore, you'll get an alarm-style reminder at that time, repeating every couple of minutes until you mark it Done on the Home tab."
      />
      <Faq
        q="I'm the admin — how do I remove a member or delete the room?"
        a="On the Room tab, tap the remove icon next to a member's name to remove them. As admin, use the Delete room button at the bottom to permanently delete the whole room."
      />
      <Faq
        q="How do I leave a room?"
        a="On the Room tab, tap Leave room at the bottom. Admins can't leave — they must delete the room instead."
      />
      <Faq
        q="My routine changed (new semester) — what do I do?"
        a="On the Routine tab, tap Clear routine to wipe your old busy hours, then add your new ones."
      />
    </ScreenContainer>
  );
}
