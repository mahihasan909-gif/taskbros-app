import { Image, Switch, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "../../components/ui/ScreenContainer";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { useAuth } from "../../contexts/AuthContext";
import { useRoom } from "../../contexts/RoomContext";
import { useTheme } from "../../contexts/ThemeContext";

const menuItems: { icon: keyof typeof Ionicons.glyphMap; label: string; route: string }[] = [
  { icon: "person-outline", label: "Edit profile", route: "/profile/edit" },
  { icon: "shield-checkmark-outline", label: "Privacy", route: "/profile/privacy" },
  { icon: "help-circle-outline", label: "Help & support", route: "/profile/help" },
];

export default function Profile() {
  const { signOut } = useAuth();
  const { profile, myRole } = useRoom();
  const { scheme, toggle } = useTheme();

  async function handleSignOut() {
    await signOut();
    router.replace("/(auth)/welcome");
  }

  const badgeLabel = [
    profile?.person_type === "job_holder" ? "Job Holder" : "Student",
    myRole === "leader" ? "Admin" : myRole === "member" ? "Member" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <ScreenContainer>
      <View className="pt-4 pb-2 items-center">
        <View className="w-20 h-20 rounded-full bg-primary items-center justify-center mb-3 overflow-hidden">
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={{ width: "100%", height: "100%" }} />
          ) : (
            <Text className="text-white text-2xl font-bold">{profile?.full_name?.[0] ?? "?"}</Text>
          )}
        </View>
        <Text className="text-text text-xl font-extrabold">{profile?.full_name ?? "..."}</Text>
        <View className="mt-2">
          <Badge label={badgeLabel || "Student"} tone="primary" />
        </View>
      </View>

      <Card className="mt-6 p-0 overflow-hidden">
        <View className="flex-row items-center px-4 py-4 border-b border-border">
          <Ionicons name="moon-outline" size={20} color="#8A8D9A" />
          <Text className="text-text ml-3 flex-1">Dark mode</Text>
          <Switch
            value={scheme === "dark"}
            onValueChange={toggle}
            trackColor={{ false: "#8A8D9A", true: "#6C5CE7" }}
            thumbColor="#FFFFFF"
          />
        </View>
        {menuItems.map((item, i) => (
          <TouchableOpacity
            key={item.label}
            onPress={() => router.push(item.route as any)}
            className={`flex-row items-center px-4 py-4 ${
              i !== menuItems.length - 1 ? "border-b border-border" : ""
            }`}
          >
            <Ionicons name={item.icon} size={20} color="#8A8D9A" />
            <Text className="text-text ml-3 flex-1">{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color="#8A8D9A" />
          </TouchableOpacity>
        ))}
      </Card>

      <TouchableOpacity
        onPress={handleSignOut}
        className="mt-6 border border-danger/40 rounded-2xl py-4 items-center"
      >
        <Text className="text-danger font-semibold">Sign out</Text>
      </TouchableOpacity>
    </ScreenContainer>
  );
}
