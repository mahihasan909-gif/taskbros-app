import "../global.css";
import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../contexts/AuthContext";
import { RoomProvider } from "../contexts/RoomContext";
import { ThemeProvider, useTheme } from "../contexts/ThemeContext";
import { darkTheme, lightTheme, themeBgHex } from "../lib/theme";

function ThemedApp() {
  const { scheme } = useTheme();
  return (
    <View style={[{ flex: 1 }, scheme === "dark" ? darkTheme : lightTheme]}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: themeBgHex[scheme] },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="room/create" options={{ presentation: "modal" }} />
        <Stack.Screen name="room/join" options={{ presentation: "modal" }} />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <RoomProvider>
            <ThemedApp />
          </RoomProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
