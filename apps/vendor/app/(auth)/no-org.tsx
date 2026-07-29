import { useAuth, useClerk, useOrganization, useOrganizationList } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { Button } from "../../components/Button";
import { ScreenContainer } from "../../components/ScreenContainer";
import { TextField } from "../../components/TextField";
import { useUiStore } from "../../store/useUiStore";

/**
 * The single canonical "signed in, no active org" screen. Two things land
 * here: a returning vendor whose session doesn't have an active org set yet
 * (has ≥1 membership — auto-activate the first one), and a genuinely
 * org-less account, freshly signed up or otherwise (0 memberships — show the
 * create-restaurant form). This is the only place in the app that calls
 * useOrganizationList() or creates/activates an organization — see the
 * consolidation plan for why three separate copies of this used to exist.
 */
export default function NoOrgScreen() {
  // See (auth)/_layout.tsx — a session with a pending "choose-organization"
  // task otherwise reads isSignedIn: false despite a real session existing.
  const { isSignedIn, isLoaded } = useAuth({ treatPendingAsSignedOut: false });
  const { organization, isLoaded: isOrgLoaded } = useOrganization();
  const { userMemberships, isLoaded: isOrgListLoaded, createOrganization, setActive } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const { signOut } = useClerk();
  const pendingRestaurantName = useUiStore((s) => s.pendingRestaurantName);
  const setPendingRestaurantName = useUiStore((s) => s.setPendingRestaurantName);

  const [restaurantName, setRestaurantName] = useState(pendingRestaurantName ?? "");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // useState's initial value is only read on this component's first mount —
  // if this screen mounted before sign-up finished stashing the name (e.g.
  // during the routing this app does while resolving signed-in-no-org
  // state), that initializer already ran with pendingRestaurantName still
  // null and never re-reads it. Sync it in whenever it actually arrives,
  // without clobbering something the vendor already typed here themselves.
  useEffect(() => {
    if (pendingRestaurantName && !restaurantName) {
      setRestaurantName(pendingRestaurantName);
    }
  }, [pendingRestaurantName, restaurantName]);

  const memberships = userMemberships.data;
  const hasExistingMembership = !!memberships && memberships.length > 0;

  // Returning vendor: a membership exists but isn't active on this session yet.
  const autoActivating = useRef(false);
  useEffect(() => {
    if (organization || !isOrgListLoaded || !setActive) return;
    const firstOrg = memberships?.[0]?.organization;
    if (!firstOrg?.id || autoActivating.current) return;
    autoActivating.current = true;
    setActive({ organization: firstOrg.id }).catch(() => {
      autoActivating.current = false;
    });
  }, [organization, isOrgListLoaded, memberships, setActive]);

  if (!isLoaded || !isOrgLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;
  if (organization) return <Redirect href="/(app)/orders" />;
  if (!isOrgListLoaded || hasExistingMembership) {
    return (
      <ScreenContainer center centerVertical>
        <ActivityIndicator color="#1D4626" />
      </ScreenContainer>
    );
  }

  const onCreateOrg = async () => {
    if (!restaurantName.trim() || !createOrganization || !setActive) return;
    setError(null);
    setIsCreating(true);
    try {
      const newOrg = await createOrganization({ name: restaurantName.trim() });
      await setActive({ organization: newOrg.id });
      setPendingRestaurantName(null);
      router.replace("/(app)/orders");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create your restaurant. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <ScreenContainer scroll center centerVertical>
      <View className="w-full max-w-[400px] items-center">
        <View className="w-full gap-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <View className="items-center gap-2">
            <View className="h-12 w-12 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50">
              <Ionicons name="restaurant-outline" size={24} color="#1D4626" />
            </View>
            <Text className="text-center font-rubik-bold text-2xl text-primary">Set up your restaurant</Text>
            <Text className="text-center font-sans text-sm text-[#5A6357]">
              This account isn&apos;t linked to a restaurant yet. Name it to get started.
            </Text>
          </View>

          <View className="gap-3">
            <TextField
              label="Restaurant name"
              placeholder="e.g. Silchar Food Express"
              value={restaurantName}
              onChangeText={setRestaurantName}
              autoCapitalize="words"
            />

            {error ? (
              <View className="rounded-lg border border-red-200 bg-red-50 p-3">
                <Text className="font-sans text-xs text-non-veg">{error}</Text>
              </View>
            ) : null}

            <Button
              label="Create restaurant & continue"
              onPress={onCreateOrg}
              loading={isCreating}
              disabled={!restaurantName.trim()}
              icon={<Ionicons name="arrow-forward" size={18} color="#FFFFFF" />}
            />
          </View>

          <View className="items-center border-t border-border pt-4">
            <Button
              label="Sign out & use another account"
              onPress={() => signOut()}
              variant="secondary"
              icon={<Ionicons name="log-out-outline" size={18} color="#1D4626" />}
            />
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}
