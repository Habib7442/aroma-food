import { useAuth, useClerk, useSignIn } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Button } from "../../components/Button";
import { ScreenContainer } from "../../components/ScreenContainer";
import { TextField } from "../../components/TextField";

export default function SignInScreen() {
  // See (auth)/_layout.tsx — a session with a pending "choose-organization"
  // task otherwise reads isSignedIn: false despite a real session existing.
  const { isSignedIn, isLoaded } = useAuth({ treatPendingAsSignedOut: false });
  const { signIn, errors, fetchStatus } = useSignIn();
  const clerk = useClerk();
  const { signOut } = clerk;
  const [step, setStep] = useState<"form" | "verify">("form");
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Clerk restores a persisted session from SecureStore asynchronously on
  // cold start. Rendering the form before isLoaded is true lets a submit
  // race that restoration — signIn.password() reaches the SDK just after it
  // finishes hydrating, which then correctly (but confusingly) rejects with
  // "already signed in." Waiting here closes that window instead of
  // papering over it with a catch-and-retry.
  if (!isLoaded) {
    return (
      <ScreenContainer center centerVertical>
        <ActivityIndicator color="#1D4626" />
      </ScreenContainer>
    );
  }
  if (isSignedIn) return null;

  // Shared by both the direct-complete path and the post-verification path.
  const finalizeAndEnter = async () => {
    const { error: finalizeError } = await signIn.finalize();
    if (finalizeError) {
      setFormError(`[${finalizeError.code}] ${finalizeError.message}`);
      return;
    }
    // The Client resource's local state doesn't always pick up a
    // just-activated session on its own — force a refetch from the server
    // so useAuth()'s isSignedIn actually reflects it before the route
    // guards run.
    await clerk.client?.reload();
    router.replace("/(app)/orders");
  };

  const onSubmit = async () => {
    setFormError(null);
    let { error } = await signIn.password({ emailAddress, password });

    // A stuck client-level session (e.g. left over from earlier testing)
    // rejects this with "already signed in" — the code is always the
    // generic "api_response_error" wrapper, so the reason has to be matched
    // on the message text. Signing out clears it; the retry then succeeds.
    if (error?.message.toLowerCase().includes("already signed in")) {
      await signOut();
      ({ error } = await signIn.password({ emailAddress, password }));
    }

    if (error) {
      setFormError(`[${error.code}] ${error.message}`);
      return;
    }

    if (signIn.status === "complete") {
      await finalizeAndEnter();
    } else if (signIn.status === "needs_second_factor" || signIn.status === "needs_client_trust") {
      // needs_client_trust is new-device/new-install verification; the same
      // mfa methods also serve a genuine needs_second_factor. Email code is
      // the only factor this app supports — no MFA enrollment UI exists to
      // set up TOTP/backup codes, so those shouldn't occur in practice.
      const emailFactor = signIn.supportedSecondFactors?.find((f) => f.strategy === "email_code");
      if (!emailFactor) {
        setFormError("This account requires a verification method this app doesn't support yet.");
        return;
      }
      const { error: sendError } = await signIn.mfa.sendEmailCode();
      if (sendError) {
        setFormError(`[${sendError.code}] ${sendError.message}`);
        return;
      }
      setStep("verify");
    } else {
      setFormError("Couldn't complete sign in. Please try again.");
    }
  };

  const onVerifyCode = async () => {
    setFormError(null);
    const { error } = await signIn.mfa.verifyEmailCode({ code });
    if (error) {
      setFormError(`[${error.code}] ${error.message}`);
      return;
    }

    if (signIn.status === "complete") {
      await finalizeAndEnter();
    } else {
      setFormError("Couldn't complete sign in. Please try again.");
    }
  };

  return (
    <ScreenContainer scroll center centerVertical>
      <View className="w-full max-w-[400px] items-center">
        {/* Main Partner Portal Card */}
        <View className="w-full rounded-2xl border border-border bg-card p-6 shadow-sm">
          {/* Header */}
          <View className="items-center mb-6">
            <Text className="text-3xl font-rubik-bold text-primary tracking-tight text-center">
              Partner Portal
            </Text>
            <Text className="font-sans text-sm text-[#5A6357] text-center mt-1">
              Sign in to manage your operations
            </Text>
          </View>

          {step === "form" ? (
            <View className="gap-4">
              <TextField
                label="Email Address"
                placeholder="name@company.com"
                value={emailAddress}
                onChangeText={setEmailAddress}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                error={errors.fields.identifier?.message}
              />

              <TextField
                label="Password"
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                error={errors.fields.password?.message}
                headerRight={
                  <Link href="/(auth)/forgot-password" asChild>
                    <Pressable>
                      <Text className="font-rubik-medium text-xs text-primary">Forgot password?</Text>
                    </Pressable>
                  </Link>
                }
              />

              {formError ? (
                <View className="rounded-lg bg-red-50 p-3 border border-red-200">
                  <Text className="font-sans text-xs text-non-veg">{formError}</Text>
                </View>
              ) : null}

              <Button
                label="Sign In"
                onPress={onSubmit}
                loading={fetchStatus === "fetching"}
                icon={<Ionicons name="arrow-forward" size={18} color="#FFFFFF" />}
              />
            </View>
          ) : (
            <View className="gap-4">
              <Text className="font-sans text-sm text-[#5A6357] text-center">
                This device needs verifying. Enter the code sent to{"\n"}
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
                onPress={onVerifyCode}
                loading={fetchStatus === "fetching"}
                icon={<Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />}
              />
            </View>
          )}

          {/* Divider */}
          <View className="my-6 border-t border-border" />

          {/* Secondary Actions */}
          <View className="items-center">
            <Link href="/(auth)/sign-up" asChild>
              <Pressable className="flex-row items-center gap-1.5 py-1">
                <Text className="font-sans text-sm text-[#5A6357]">New restaurant?</Text>
                <Text className="font-rubik-medium text-sm text-primary">Register account</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}
