import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "../../components/ui/ScreenContainer";
import { TextField } from "../../components/ui/TextField";
import { Button } from "../../components/ui/Button";
import { supabase } from "../../lib/supabase";
import { useRoom } from "../../contexts/RoomContext";

export default function JoinRoom() {
  const { refresh } = useRoom();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleJoin() {
    setError("");
    setLoading(true);
    const { error: rpcError } = await supabase.rpc("join_room_by_code", {
      code: code.trim(),
    });
    setLoading(false);
    if (rpcError) {
      setError(
        rpcError.message.includes("Invalid room code")
          ? "Invalid room code"
          : rpcError.message.includes("already in a room")
          ? "You're already in a room. Leave it first."
          : rpcError.message
      );
      return;
    }
    await refresh();
    router.replace("/(tabs)/room");
  }

  return (
    <ScreenContainer scroll={false}>
      <View className="pt-4 pb-2 flex-row items-center justify-between">
        <Text className="text-text text-2xl font-extrabold">Join Room</Text>
        <Ionicons name="close" size={24} color="#8A8D9A" onPress={() => router.back()} />
      </View>
      <Text className="text-textMuted text-base mt-1 mb-6">
        Enter the code your admin shared with you. They'll need to approve your
        request before you're in.
      </Text>

      <TextField
        label="Room code"
        placeholder="e.g. 7K2QF9"
        autoCapitalize="characters"
        value={code}
        onChangeText={setCode}
      />
      {error ? <Text className="text-danger text-sm -mt-2 mb-4">{error}</Text> : null}

      <View className="mt-auto">
        <Button label="Join Room" onPress={handleJoin} loading={loading} disabled={!code.trim()} />
      </View>
    </ScreenContainer>
  );
}
