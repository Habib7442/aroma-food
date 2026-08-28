import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useEffect } from "react";

import { useCartTotalItemCount } from "../../lib/useCart";
import { useEnsureProfile, useHasPreferences } from "../../lib/useProfile";

export default function AppLayout() {
  // See apps/customer/AGENTS.md §6 — shared Clerk instance with
  // apps/vendor (Organizations enabled) means every session carries a
  // pending task regardless of whether this app uses orgs.
  const { isSignedIn, isLoaded, userId } = useAuth({ treatPendingAsSignedOut: false });
  const { data: hasPreferences, isLoading: isPreferencesLoading } = useHasPreferences();
  const ensureProfile = useEnsureProfile();
  const cartItemCount = useCartTotalItemCount();

  useEffect(() => {
    // Keyed on the id (a stable primitive), not on a user/session object,
    // since Clerk hands back a new object reference on unrelated renders —
    // same reasoning as apps/vendor's (app)/_layout.tsx firing
    // useEnsureRestaurant() off `orgId`.
    if (!userId) return;
    ensureProfile.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (!isLoaded || (isSignedIn && isPreferencesLoading)) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;
  if (!hasPreferences) return <Redirect href="/(onboarding)/diet" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#1D4626",
        tabBarInactiveTintColor: "#8A8578",
        tabBarStyle: { backgroundColor: "#FFFFFF", borderTopColor: "#EDE9E3", height: 64 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "search" : "search-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "receipt" : "receipt-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? "cart" : "cart-outline"} size={22} color={color} />,
          tabBarBadge: cartItemCount > 0 ? cartItemCount : undefined,
          tabBarBadgeStyle: { backgroundColor: "#A52A2A" },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={22} color={color} />
          ),
        }}
      />
      {/* Pushed from a restaurant card (see home.tsx), not a tab of its own —
          href: null keeps this route navigable via Link/router.push while
          hiding it from the tab bar (Expo Router's documented pattern for
          exactly this). Don't remove href: null "to fix" a missing icon —
          it's deliberate. */}
      <Tabs.Screen name="restaurant/[id]" options={{ href: null }} />
    </Tabs>
  );
}
