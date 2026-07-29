import { useAuth, useOrganization } from "@clerk/expo";
import { Redirect, Stack, useSegments } from "expo-router";

export default function AuthLayout() {
  // See index.tsx — a session with a pending "choose-organization" task
  // (the default under Organizations, until one is active) otherwise reads
  // isSignedIn: false despite a real session existing.
  const { isSignedIn, isLoaded } = useAuth({ treatPendingAsSignedOut: false });
  const { organization, isLoaded: isOrgLoaded } = useOrganization();
  const segments = useSegments();

  if (!isLoaded || !isOrgLoaded) return null;

  if (isSignedIn) {
    if (organization) return <Redirect href="/(app)/orders" />;

    // Signed in, no org yet: no-org.tsx is the only screen in this group a
    // signed-in user may see — it's the single place that decides whether
    // to auto-activate an existing membership or show the create-org form.
    const isOnNoOrg = segments[segments.length - 1] === "no-org";
    if (!isOnNoOrg) return <Redirect href="/(auth)/no-org" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
