import { useState } from "react";
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { decode } from "base64-arraybuffer";
import { ScreenContainer } from "../../components/ui/ScreenContainer";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { useRoom } from "../../contexts/RoomContext";

export default function EditProfile() {
  const { session } = useAuth();
  const { profile, refresh } = useRoom();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handlePickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo access is needed to set a profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets[0].base64) return;

    setUploading(true);
    setError("");
    const ext = result.assets[0].uri.split(".").pop() ?? "jpg";
    const path = `${session!.user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, decode(result.assets[0].base64), {
        contentType: `image/${ext}`,
        upsert: true,
      });
    setUploading(false);
    if (uploadError) {
      setError(uploadError.message);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(`${data.publicUrl}?t=${Date.now()}`);
  }

  async function handleSave() {
    setError("");
    if (!fullName.trim()) {
      setError("Name can't be empty.");
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), avatar_url: avatarUrl })
      .eq("id", session!.user.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await refresh();
    router.back();
  }

  return (
    <ScreenContainer>
      <View className="pt-4 pb-2 flex-row items-center gap-3">
        <Ionicons name="chevron-back" size={24} color="#F2F2F7" onPress={() => router.back()} />
        <Text className="text-text text-2xl font-extrabold">Edit profile</Text>
      </View>

      <View className="items-center mt-6 mb-8">
        <TouchableOpacity onPress={handlePickPhoto} disabled={uploading} className="relative">
          <View className="w-24 h-24 rounded-full bg-primary items-center justify-center overflow-hidden">
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={{ width: "100%", height: "100%" }} />
            ) : (
              <Text className="text-white text-3xl font-bold">{fullName?.[0]?.toUpperCase() ?? "?"}</Text>
            )}
          </View>
          <View className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-surface2 border-2 border-bg items-center justify-center">
            <Ionicons name="camera" size={16} color="#F2F2F7" />
          </View>
        </TouchableOpacity>
        <Text className="text-textMuted text-xs mt-3">Tap to change photo</Text>
      </View>

      <TextField label="Full name" placeholder="Your name" value={fullName} onChangeText={setFullName} />

      {error ? <Text className="text-danger text-sm mb-3">{error}</Text> : null}

      <Button label="Save changes" onPress={handleSave} loading={saving} />
    </ScreenContainer>
  );
}
