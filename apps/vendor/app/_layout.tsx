import "../global.css";

import { ClerkProvider } from "@clerk/expo";
import { fontAssets } from "@zaavo/ui";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Slot } from "expo-router";
import { configureReanimatedLogger, ReanimatedLogLevel } from "react-native-reanimated";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { queryClient } from "../lib/queryClient";
import { tokenCache } from "../lib/tokenCache";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

if (!publishableKey) {
  throw new Error("Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to apps/vendor/.env");
}

// NativeWind v4 implements Tailwind's transition-* utilities via Reanimated
// internally, reading a shared value's .value during render to compute the
// interpolated style — harmless in practice, but trips Reanimated's
// strict-mode "reading during render" warning on every affected component.
configureReanimatedLogger({ level: ReanimatedLogLevel.warn, strict: false });

export default function RootLayout() {
  const [fontsLoaded] = useFonts(fontAssets);

  // Nothing to render with the wrong font for a frame — screens using
  // NativeWind's font-* classes assume these are already registered.
  if (!fontsLoaded) return null;

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <Slot />
        </SafeAreaProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
