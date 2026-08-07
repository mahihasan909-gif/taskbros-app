import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";

type Variant = "primary" | "outline" | "ghost" | "danger";

type Props = PressableProps & {
  label: string;
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
};

const variantStyles: Record<Variant, { base: string; text: string; pressed: string }> = {
  primary: {
    base: "bg-primary border border-primary",
    text: "text-white",
    pressed: "bg-primaryDark",
  },
  outline: {
    base: "bg-transparent border border-border",
    text: "text-text",
    pressed: "bg-surface2",
  },
  ghost: {
    base: "bg-transparent border border-transparent",
    text: "text-primary",
    pressed: "bg-surface2",
  },
  danger: {
    base: "bg-danger border border-danger",
    text: "text-white",
    pressed: "opacity-80",
  },
};

export function Button({
  label,
  variant = "primary",
  loading = false,
  fullWidth = true,
  disabled,
  ...props
}: Props) {
  const styles = variantStyles[variant];

  return (
    <Pressable
      disabled={disabled || loading}
      className={`${fullWidth ? "w-full" : ""} rounded-2xl px-5 py-4 items-center justify-center ${styles.base} ${
        disabled ? "opacity-40" : ""
      }`}
      style={({ pressed }) => (pressed ? { opacity: 0.85 } : {})}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" || variant === "danger" ? "#fff" : "#6C5CE7"} />
      ) : (
        <Text className={`text-base font-semibold ${styles.text}`}>{label}</Text>
      )}
    </Pressable>
  );
}
