import { useAuth, useClerk, useSignUp } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Button } from "../../components/Button";
import { ScreenContainer } from "../../components/ScreenContainer";
import { TextField } from "../../components/TextField";
import { useUiStore } from "../../store/useUiStore";

export default function SignUpScreen() {
  // See (auth)/_layout.tsx — a session with a pending "choose-organization"
  // task otherwise reads isSignedIn: false despite a real session existing.
  const { isLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const { signUp, errors, fetchStatus } = useSignUp();
  const clerk = useClerk();
  const { signOut } = clerk;
  const setPendingRestaurantName = useUiStore((s) => s.setPendingRestaurantName);

  const [step, setStep] = useState<"form" | "verify">("form");
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Same race as sign-in.tsx: don't let the form submit before Clerk has
  // finished restoring any persisted session from SecureStore, or a
  // signUp.password() call can land just after hydration completes and get
  // rejected with "already signed in" even though the form looked idle.
  if (!isLoaded) {
    return (
      <ScreenContainer center centerVertical>
        <ActivityIndicator color="#1D4626" />
      </ScreenContainer>
    );
  }
  if (isSignedIn) return null;

  const onSubmitForm = async () => {
    setFormError(null);
    let { error } = await signUp.password({ emailAddress, password });

    // A stuck client-level session (e.g. left over from earlier testing)
    // rejects this with "already signed in" — signing out clears it, and
    // the retry then succeeds.
    if (error?.message.toLowerCase().includes("already signed in")) {
      await signOut();
      ({ error } = await signUp.password({ emailAddress, password }));
    }

    if (error) {
      setFormError(`[${error.code}] ${error.message}`);
      return;
    }

    if (signUp.status === "complete") {
      setPendingRestaurantName(restaurantName);
      await signUp.finalize();
      // The Client resource's local state doesn't always pick up a
      // just-activated session on its own — force a refetch so useAuth()'s
      // isSignedIn actually reflects it before the route guards run.
      await clerk.client?.reload();
      return;
    }

    if (signUp.status === "missing_requirements" && signUp.unverifiedFields.includes("email_address")) {
      const { error: codeError } = await signUp.verifications.sendEmailCode();
      if (codeError) {
        setFormError(codeError.message);
        return;
      }
      setStep("verify");
      return;
    }

    setFormError("Couldn't complete sign up. Please try again.");
  };

  const onSubmitCode = async () => {
    setFormError(null);
    const { error } = await signUp.verifications.verifyEmailCode({ code });
    if (error) {
      setFormError(`[${error.code}] ${error.message}`);
      return;
    }

    if (signUp.status === "complete") {
      // Stashed here (not in onSubmitForm) since this is the last point
      // before the session activates and the (auth) layout guard takes over
      // — no-org.tsx reads this to pre-fill the create-restaurant form.
      setPendingRestaurantName(restaurantName);
      const { error: finalizeError } = await signUp.finalize();
      if (finalizeError) {
        setFormError(`[${finalizeError.code}] ${finalizeError.message}`);
        return;
      }
      // See onSubmitForm's identical call for why this is needed.
      await clerk.client?.reload();
    } else {
      // Surfaces exactly what Clerk still wants (e.g. a required field beyond
      // email/password enabled in the Dashboard) instead of a dead-end
      // generic message — this status/fields combo is what "stuck after
      // verification" actually means under the hood.
      setFormError(
        `Couldn't complete sign up (status: ${signUp.status}). ` +
          `Missing: ${signUp.missingFields.join(", ") || "none"}. ` +
          `Unverified: ${signUp.unverifiedFields.join(", ") || "none"}.`,
      );
    }
  };

  return (
    <ScreenContainer scroll center centerVertical>
      <View className="w-full max-w-[400px] items-center">
        <View className="w-full rounded-2xl border border-border bg-card p-6 shadow-sm">
          {/* Header */}
          <View className="items-center mb-6">
            <Text className="text-3xl font-rubik-bold text-primary tracking-tight text-center">
              Register Restaurant
            </Text>
            <Text className="font-sans text-sm text-[#5A6357] text-center mt-1">
              Join Zaavo as a restaurant partner
            </Text>
          </View>

          {step === "form" ? (
            <View className="gap-4">
              <TextField
                label="Restaurant Name"
                placeholder="e.g. Silchar Biryani House"
                value={restaurantName}
                onChangeText={setRestaurantName}
                autoCapitalize="words"
              />
              <TextField
                label="Email Address"
                placeholder="owner@restaurant.com"
                value={emailAddress}
                onChangeText={setEmailAddress}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                error={errors.fields.emailAddress?.message}
              />
              <TextField
                label="Password"
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                error={errors.fields.password?.message}
              />

              {formError ? (
                <View className="rounded-lg bg-red-50 p-3 border border-red-200">
                  <Text className="font-sans text-xs text-non-veg">{formError}</Text>
                </View>
              ) : null}

              <View nativeID="clerk-captcha" />

              <Button
                label="Create Account"
                onPress={onSubmitForm}
                loading={fetchStatus === "fetching"}
                disabled={!restaurantName || !emailAddress || !password}
                icon={<Ionicons name="arrow-forward" size={18} color="#FFFFFF" />}
              />
            </View>
          ) : (
            <View className="gap-4">
              <Text className="font-sans text-sm text-[#5A6357] text-center">
                Enter the verification code sent to{"\n"}
                <Text className="font-rubik-medium text-primary">{emailAddress}</Text>
              </Text>
              <TextField
                label="Verification Code"
                placeholder="123456"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                error={errors.fields.code?.message}
              />

              {formError ? (
                <View className="rounded-lg bg-red-50 p-3 border border-red-200">
                  <Text className="font-sans text-xs text-non-veg">{formError}</Text>
                </View>
              ) : null}

              <Button
                label="Verify & Continue"
                onPress={onSubmitCode}
                loading={fetchStatus === "fetching"}
                icon={<Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />}
              />
            </View>
          )}

          {/* Divider */}
          <View className="my-6 border-t border-border" />

          {/* Secondary Actions */}
          <View className="items-center">
            <Link href="/(auth)/sign-in" asChild>
              <Pressable className="flex-row items-center gap-1.5 py-1">
                <Text className="font-sans text-sm text-[#5A6357]">Already registered?</Text>
                <Text className="font-rubik-medium text-sm text-primary">Sign in here</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

