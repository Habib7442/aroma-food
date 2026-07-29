import { ReactNode } from "react";
import { View, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ScreenContainerProps extends ViewProps {
  children: ReactNode;
}

export function ScreenContainer({ children, ...viewProps }: ScreenContainerProps) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1" {...viewProps}>
        {children}
      </View>
    </SafeAreaView>
  );
}
