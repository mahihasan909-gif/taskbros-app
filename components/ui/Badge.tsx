import { Text, View } from "react-native";

type Tone = "primary" | "accent" | "warn" | "danger" | "muted";

const toneStyles: Record<Tone, { bg: string; text: string }> = {
  primary: { bg: "bg-primary/20", text: "text-primary" },
  accent: { bg: "bg-accent/20", text: "text-accent" },
  warn: { bg: "bg-warn/20", text: "text-warn" },
  danger: { bg: "bg-danger/20", text: "text-danger" },
  muted: { bg: "bg-surface2", text: "text-textMuted" },
};

export function Badge({ label, tone = "muted" }: { label: string; tone?: Tone }) {
  const styles = toneStyles[tone];
  return (
    <View className={`px-3 py-1 rounded-full ${styles.bg}`}>
      <Text className={`text-xs font-medium ${styles.text}`}>{label}</Text>
    </View>
  );
}
