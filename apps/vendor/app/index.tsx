import { useAuth, useOrganization } from "@clerk/expo";
import { Redirect } from "expo-router";

export default function Index() {
  // Without this, a session with an unresolved task (e.g. this Clerk
  // instance's "choose-organization" task, which every session gets under
  // Organizations until one is active) reports isSignedIn: false — even
  // though a real session exists — which is exactly the "stuck between
  // sign-in and no-org" behavior this app was hitting.
  const { isSignedIn, isLoaded } = useAuth({ treatPendingAsSignedOut: false });
  const { organization, isLoaded: isOrgLoaded } = useOrganization();

  if (!isLoaded || !isOrgLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;
  if (!organization) return <Redirect href="/(auth)/no-org" />;
  return <Redirect href="/(app)/orders" />;
}
