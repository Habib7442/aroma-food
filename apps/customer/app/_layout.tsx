import "../global.css";

import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, useFonts as useInterFonts } from "@expo-google-fonts/inter";
import {
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts as usePlusJakartaFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { queryClient } from "../lib/queryClient";

export default function RootLayout() {
  const [interLoaded] = useInterFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold });
  const [plusJakartaLoaded] = usePlusJakartaFonts({ PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold });

  // Nothing to render with the wrong font for a frame — screens using
  // NativeWind's font-* classes assume these are already registered.
  if (!interLoaded || !plusJakartaLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
