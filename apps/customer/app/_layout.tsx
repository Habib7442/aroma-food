import "../global.css";

import { ClerkProvider, useAuth } from "@clerk/expo";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, useFonts as useInterFonts } from "@expo-google-fonts/inter";
import {
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts as usePlusJakartaFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { QueryClientProvider } from "@tanstack/react-query";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useCartStore } from "../lib/useCart";
import { queryClient } from "../lib/queryClient";
import { tokenCache } from "../lib/tokenCache";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

if (!publishableKey) {
  throw new Error("Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to apps/customer/.env");
}

// Mounted once, at the root, so it's always present regardless of which
// route group ((auth)/(onboarding)/(app)) is active — clears the cart
// (lib/useCart.ts, persisted to AsyncStorage under one static key) the
// moment a user signs out, so the next person to sign in on a shared
// device never sees a previous account's restaurant/dish choices restored.
function ClearCartOnSignOut() {
  // treatPendingAsSignedOut: false — same reasoning as every other
  // useAuth() call in this app (apps/customer/AGENTS.md §6): a pending
  // "choose-organization" Clerk task (an artifact of sharing this Clerk
  // instance with apps/vendor, which this app never uses) reports
  // isSignedIn: false even for a real, still-signed-in session. Without
  // this option, that transient state would look like a sign-out and wipe
  // a cart that's still actually active.
  const { isSignedIn, isLoaded } = useAuth({ treatPendingAsSignedOut: false });
  const wasSignedIn = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (wasSignedIn.current && !isSignedIn) {
      useCartStore.getState().clearCart();
    }
    wasSignedIn.current = isSignedIn;
  }, [isLoaded, isSignedIn]);

  return null;
}

export default function RootLayout() {
  const [interLoaded] = useInterFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold });
  const [plusJakartaLoaded] = usePlusJakartaFonts({ PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold });

  // Nothing to render with the wrong font for a frame — screens using
  // NativeWind's font-* classes assume these are already registered.
  if (!interLoaded || !plusJakartaLoaded) return null;

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <ClearCartOnSignOut />
          <Slot />
        </SafeAreaProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
