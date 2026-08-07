import { Image, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Button } from "../../components/ui/Button";
import { ScreenContainer } from "../../components/ui/ScreenContainer";
import { useTheme } from "../../contexts/ThemeContext";

const previewRows = [
  { name: "Rafi", task: "Grocery run", done: false },
  { name: "Shuvo", task: "Clean kitchen", done: true },
  { name: "Arif", task: "Cook dinner", done: false },
];

export default function Welcome() {
  const { scheme, toggle } = useTheme();
  return (
    <View className="flex-1 bg-bg">
      <LinearGradient
        colors={["rgba(108,92,231,0.28)", "rgba(11,12,16,0)", "rgba(0,229,160,0.16)"]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: "70%" }}
      />

      <ScreenContainer scroll={false}>
        <View className="flex-1 justify-between py-6">
          <View>
            <View className="flex-row items-center mb-8">
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  overflow: "hidden",
                  shadowColor: "#6C5CE7",
                  shadowOpacity: 0.5,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 6,
                }}
              >
                <Image source={require("../../assets/icon.png")} style={{ width: "100%", height: "100%" }} />
              </View>
              <Text className="text-text text-lg font-bold ml-3 tracking-wide flex-1">TaskBros</Text>
              <Pressable
                onPress={toggle}
                className="w-10 h-10 rounded-full bg-surface border border-border items-center justify-center"
              >
                <Ionicons
                  name={scheme === "dark" ? "moon" : "sunny"}
                  size={18}
                  color={scheme === "dark" ? "#8A8D9A" : "#FFB020"}
                />
              </Pressable>
            </View>

            <View className="self-start bg-surface/80 border border-border rounded-full px-3 py-1.5 mb-4 flex-row items-center">
              <View className="w-1.5 h-1.5 rounded-full bg-accent mr-2" />
              <Text className="text-textMuted text-xs font-medium">Built for bachelor mess rooms</Text>
            </View>

            <Text className="text-text text-4xl font-extrabold leading-tight">
              Run your mess{"\n"}on autopilot.
            </Text>
            <Text className="text-textMuted text-base mt-4 leading-relaxed pr-4">
              Share your routine. AI finds everyone's free time so the admin can
              hand out chores fairly — no more "who's free today" chaos.
            </Text>
          </View>

          <View
            className="bg-surface border border-border rounded-3xl p-4 mx-1"
            style={{
              shadowColor: "#000",
              shadowOpacity: 0.3,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 10 },
              elevation: 10,
              transform: [{ rotate: "-1.5deg" }],
            }}
          >
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-text font-bold text-sm">This week's chores</Text>
              <View className="bg-accent/15 rounded-full px-2 py-0.5">
                <Text className="text-accent text-[10px] font-bold">LIVE</Text>
              </View>
            </View>
            {previewRows.map((r) => (
              <View key={r.name} className="flex-row items-center py-2">
                <View className="w-8 h-8 rounded-full bg-surface2 items-center justify-center mr-3">
                  <Text className="text-text text-xs font-bold">{r.name[0]}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-text text-sm font-semibold">{r.name}</Text>
                  <Text className="text-textMuted text-xs">{r.task}</Text>
                </View>
                <Ionicons
                  name={r.done ? "checkmark-circle" : "time-outline"}
                  size={20}
                  color={r.done ? "#00E5A0" : "#8A8D9A"}
                />
              </View>
            ))}
          </View>

          <View className="gap-3">
            <View className="flex-row gap-3 mb-1">
              <View className="flex-1 bg-surface border border-border rounded-2xl p-3.5 flex-row items-center">
                <View className="w-8 h-8 rounded-xl bg-accent/15 items-center justify-center mr-2.5">
                  <Ionicons name="sparkles" size={16} color="#00E5A0" />
                </View>
                <View className="flex-1">
                  <Text className="text-text text-xs font-semibold">AI Scheduling</Text>
                  <Text className="text-textMuted text-[10px]">Free-time aware</Text>
                </View>
              </View>
              <View className="flex-1 bg-surface border border-border rounded-2xl p-3.5 flex-row items-center">
                <View className="w-8 h-8 rounded-xl bg-primary/15 items-center justify-center mr-2.5">
                  <Ionicons name="key" size={16} color="#6C5CE7" />
                </View>
                <View className="flex-1">
                  <Text className="text-text text-xs font-semibold">Room Codes</Text>
                  <Text className="text-textMuted text-[10px]">Join in seconds</Text>
                </View>
              </View>
            </View>

            <Pressable onPress={() => router.push("/(auth)/signup")}>
              {({ pressed }) => (
                <LinearGradient
                  colors={["#6C5CE7", "#5646c9"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    borderRadius: 16,
                    paddingVertical: 16,
                    alignItems: "center",
                    opacity: pressed ? 0.85 : 1,
                    shadowColor: "#6C5CE7",
                    shadowOpacity: 0.35,
                    shadowRadius: 14,
                    shadowOffset: { width: 0, height: 8 },
                    elevation: 6,
                  }}
                >
                  <Text className="text-white text-base font-bold">Create account</Text>
                </LinearGradient>
              )}
            </Pressable>
            <Button
              label="I already have an account"
              variant="outline"
              onPress={() => router.push("/(auth)/login")}
            />
          </View>
        </View>
      </ScreenContainer>
    </View>
  );
}
