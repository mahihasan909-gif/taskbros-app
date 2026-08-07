import { View, type ViewProps } from "react-native";

export function Card({ className = "", ...props }: ViewProps & { className?: string }) {
  return (
    <View
      className={`bg-surface border border-border rounded-2xl p-4 ${className}`}
      {...props}
    />
  );
}
