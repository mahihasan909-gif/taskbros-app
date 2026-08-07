import { useState } from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = TextInputProps & {
  label?: string;
  error?: string;
};

export function TextField({ label, error, secureTextEntry, ...props }: Props) {
  const [hidden, setHidden] = useState(secureTextEntry);

  return (
    <View className="w-full mb-4">
      {label ? <Text className="text-textMuted text-sm mb-2 ml-1">{label}</Text> : null}
      <View className="relative justify-center">
        <TextInput
          placeholderTextColor="#8A8D9A"
          secureTextEntry={secureTextEntry ? hidden : undefined}
          className={`w-full bg-surface border rounded-2xl px-4 py-4 text-text text-base ${
            secureTextEntry ? "pr-12" : ""
          } ${error ? "border-danger" : "border-border"}`}
          {...props}
        />
        {secureTextEntry ? (
          <Ionicons
            name={hidden ? "eye-outline" : "eye-off-outline"}
            size={20}
            color="#8A8D9A"
            style={{ position: "absolute", right: 16 }}
            onPress={() => setHidden((h) => !h)}
          />
        ) : null}
      </View>
      {error ? <Text className="text-danger text-xs mt-1 ml-1">{error}</Text> : null}
    </View>
  );
}
