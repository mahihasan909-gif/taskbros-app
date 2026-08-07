import { ScrollView, View, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = ViewProps & {
  scroll?: boolean;
  className?: string;
};

export function ScreenContainer({ scroll = true, className = "", children, ...props }: Props) {
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top", "left", "right"]}>
      {scroll ? (
        <ScrollView
          className={`flex-1 px-5 ${className}`}
          contentContainerStyle={{ paddingBottom: 32, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View className={`flex-1 px-5 pt-2 ${className}`} {...props}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}
