import { useAuth, useOrganization } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useEffect, useRef } from "react";

import { useEnsureRestaurant } from "../../lib/useRestaurant";

export default function AppLayout() {
  // See index.tsx — a session with a pending "choose-organization" task
  // (the default under Organizations, until one is active) otherwise reads
  // isSignedIn: false despite a real session existing.
  const { isSignedIn, isLoaded } = useAuth({ treatPendingAsSignedOut: false });
  const { organization, isLoaded: isOrgLoaded } = useOrganization();
  const ensureRestaurant = useEnsureRestaurant();

  const ensuredOrgId = useRef<string | null>(null);
  useEffect(() => {
    if (!organization || ensuredOrgId.current === organization.id) return;
    ensuredOrgId.current = organization.id;
    ensureRestaurant.mutate(undefined, {
      onError: () => {
        // allow a retry on next effect run / render
        ensuredOrgId.current = null;
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization]);


  if (!isLoaded || !isOrgLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;
  if (!organization) return <Redirect href="/(auth)/no-org" />;

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
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "receipt" : "receipt-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: "Menu",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "restaurant" : "restaurant-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="banners"
        options={{
          title: "Promos",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "megaphone" : "megaphone-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "storefront" : "storefront-outline"} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
