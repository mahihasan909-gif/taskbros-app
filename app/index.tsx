import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../contexts/AuthContext";

export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 bg-bg items-center justify-center">
        <ActivityIndicator color="#6C5CE7" size="large" />
      </View>
    );
  }

  return <Redirect href={session ? "/(tabs)/home" : "/(auth)/welcome"} />;
}
