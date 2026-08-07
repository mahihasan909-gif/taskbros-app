import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { ScreenContainer } from "../../components/ui/ScreenContainer";
import { supabase } from "../../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    setError("");
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.replace("/(tabs)/home");
  }

  return (
    <ScreenContainer>
      <View className="pt-6 pb-4">
        <Text className="text-text text-3xl font-extrabold">Welcome back</Text>
        <Text className="text-textMuted text-base mt-2">Log in to your room.</Text>
      </View>

      <TextField
        label="Email"
        placeholder="you@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextField
        label="Password"
        placeholder="••••••••"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error ? <Text className="text-danger text-sm mb-4 -mt-2">{error}</Text> : null}

      <Button label="Log In" onPress={handleLogin} loading={loading} />

      <View className="flex-row justify-center mt-6">
        <Text className="text-textMuted">Don't have an account? </Text>
        <Text className="text-primary font-semibold" onPress={() => router.push("/(auth)/signup")}>
          Sign up
        </Text>
      </View>
    </ScreenContainer>
  );
}
