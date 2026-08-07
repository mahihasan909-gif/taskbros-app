import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { ScreenContainer } from "../../components/ui/ScreenContainer";
import { Badge } from "../../components/ui/Badge";
import { supabase } from "../../lib/supabase";
import type { PersonType } from "../../types/db";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [personType, setPersonType] = useState<PersonType>("student");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSignup() {
    setError("");
    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim(), person_type: personType } },
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (data.session) {
      router.replace("/(tabs)/home");
    } else {
      router.replace("/(auth)/login");
    }
  }

  return (
    <ScreenContainer>
      <View className="pt-6 pb-4">
        <Text className="text-text text-3xl font-extrabold">Create account</Text>
        <Text className="text-textMuted text-base mt-2">Join or lead a bachelor room.</Text>
      </View>

      <TextField label="Full name" placeholder="Mahi Shahi" value={name} onChangeText={setName} />
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
        placeholder="At least 6 characters"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Text className="text-textMuted text-sm mb-2 ml-1">I am a</Text>
      <View className="flex-row gap-3 mb-6">
        <View onTouchEnd={() => setPersonType("student")}>
          <Badge label="Student" tone={personType === "student" ? "primary" : "muted"} />
        </View>
        <View onTouchEnd={() => setPersonType("job_holder")}>
          <Badge label="Job Holder" tone={personType === "job_holder" ? "primary" : "muted"} />
        </View>
      </View>

      {error ? <Text className="text-danger text-sm mb-4 -mt-2">{error}</Text> : null}

      <Button label="Sign Up" onPress={handleSignup} loading={loading} />

      <View className="flex-row justify-center mt-6">
        <Text className="text-textMuted">Already have an account? </Text>
        <Text className="text-primary font-semibold" onPress={() => router.push("/(auth)/login")}>
          Log in
        </Text>
      </View>
    </ScreenContainer>
  );
}
