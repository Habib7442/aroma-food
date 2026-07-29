import { ReactNode } from "react";
import { ScrollView, View, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ScreenContainerProps extends ViewProps {
  scroll?: boolean;
  center?: boolean;
  centerVertical?: boolean;
  children: ReactNode;
}

export function ScreenContainer({
  scroll = false,
  center = false,
  centerVertical = false,
  children,
  ...viewProps
}: ScreenContainerProps) {
  const justifyClass = centerVertical ? "justify-center" : "justify-start";
  const itemsClass = center ? "items-center" : "";

  if (scroll) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
        <ScrollView
          className="flex-1"
          contentContainerClassName={`px-4 py-6 ${center || centerVertical ? "flex-grow" : ""} ${itemsClass} ${justifyClass}`}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          {...viewProps}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View
        className={`flex-1 px-4 py-6 ${itemsClass} ${justifyClass}`}
        {...viewProps}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}



