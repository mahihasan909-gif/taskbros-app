import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "../../components/ui/ScreenContainer";
import { TextField } from "../../components/ui/TextField";
import { Button } from "../../components/ui/Button";
import { supabase } from "../../lib/supabase";
import { useRoom } from "../../contexts/RoomContext";

export default function CreateRoom() {
  const { refresh } = useRoom();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    setError("");
    setLoading(true);
    const { error: rpcError } = await supabase.rpc("create_room", {
      room_name: name.trim(),
    });
    setLoading(false);
    if (rpcError) {
      setError(
        rpcError.message.includes("already in a room")
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
        <Text className="text-text text-2xl font-extrabold">Create Room</Text>
        <Ionicons name="close" size={24} color="#8A8D9A" onPress={() => router.back()} />
      </View>
      <Text className="text-textMuted text-base mt-1 mb-6">
        You'll become the admin. A join code is generated for your mates.
      </Text>

      <TextField
        label="Room name"
        placeholder="e.g. Bachelor Point 4B"
        value={name}
        onChangeText={setName}
      />

      {error ? <Text className="text-danger text-sm mb-4">{error}</Text> : null}

      <View className="mt-auto">
        <Button label="Create & Continue" onPress={handleCreate} loading={loading} disabled={!name.trim()} />
      </View>
    </ScreenContainer>
  );
}
