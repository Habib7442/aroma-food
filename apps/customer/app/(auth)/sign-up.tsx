import { useAuth, useClerk, useSignUp, useSSO } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Wordmark } from "@zaavo/ui";
import { Link, router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Button } from "../../components/Button";
import { ScreenContainer } from "../../components/ScreenContainer";
import { TextField } from "../../components/TextField";

export default function SignUpScreen() {
  // See apps/customer/AGENTS.md §6 — shared Clerk instance with
  // apps/vendor (Organizations enabled) means every session carries a
  // pending task regardless of whether this app uses orgs; without this
  // option isSignedIn reads false right after a real sign-up completes.
  const { isLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const { signUp, errors, fetchStatus } = useSignUp();
  const { startSSOFlow } = useSSO();
  const clerk = useClerk();
  const { signOut } = clerk;

  const [step, setStep] = useState<"form" | "verify">("form");
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isGooglePending, setIsGooglePending] = useState(false);

  // Don't let the form submit before Clerk has finished restoring any
  // persisted session from SecureStore, or a signUp.password() call can land
  // just after hydration completes and get rejected with "already signed in"
  // even though the form looked idle.
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
      const { error: finalizeError } = await signUp.finalize();
      if (finalizeError) {
        setFormError(`[${finalizeError.code}] ${finalizeError.message}`);
        return;
      }
      // The Client resource's local state doesn't always pick up a
      // just-activated session on its own — force a refetch so useAuth()'s
      // isSignedIn actually reflects it before the route guards run.
      await clerk.client?.reload();
      router.replace("/");
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
      const { error: finalizeError } = await signUp.finalize();
      if (finalizeError) {
        setFormError(`[${finalizeError.code}] ${finalizeError.message}`);
        return;
      }
      // See onSubmitForm's identical call for why this is needed.
      await clerk.client?.reload();
      router.replace("/");
    } else {
      setFormError(
        `Couldn't complete sign up (status: ${signUp.status}). ` +
          `Missing: ${signUp.missingFields.join(", ") || "none"}. ` +
          `Unverified: ${signUp.unverifiedFields.join(", ") || "none"}.`,
      );
    }
  };

  const onGoogleSignIn = async () => {
    setFormError(null);
    setIsGooglePending(true);
    try {
      const { createdSessionId, setActive, signUp: googleSignUp } = await startSSOFlow({ strategy: "oauth_google" });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        // Same race as onSubmitForm's finalize path above — force a
        // refetch of the Client resource before navigating, or
        // useAuth()'s isSignedIn can still read false when the route
        // guards run, bouncing back to sign-in.
        await clerk.client?.reload();
        router.replace("/");
      } else if (googleSignUp?.status === "missing_requirements") {
        setFormError("This Google account needs more info to finish signing up — try email sign-up instead.");
      }
      // No createdSessionId and no missing requirements → user cancelled. Not an error.
    } catch (err) {
      console.error("Google sign-up error:", JSON.stringify(err, null, 2));
      setFormError(err instanceof Error ? err.message : "Couldn't sign in with Google. Please try again.");
    } finally {
      setIsGooglePending(false);
    }
  };

  return (
    <ScreenContainer scroll center centerVertical>
      <View className="w-full max-w-[400px] items-center">
        <View className="w-full rounded-card border border-border bg-card p-6">
          <View className="mb-6 items-center">
            <Wordmark height={44} />
            <Text className="mt-3 text-center font-headline text-3xl text-primary">Create your account</Text>
            <Text className="mt-1 text-center font-sans text-sm text-primary-dark">
              Order from restaurants across Silchar
            </Text>
          </View>

          {step === "form" ? (
            <View className="gap-4">
              <TextField
                label="Email Address"
                placeholder="you@example.com"
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
                <View className="rounded-2xl border border-red-200 bg-red-50 p-3">
                  <Text className="font-sans text-xs text-non-veg">{formError}</Text>
                </View>
              ) : null}

              <View nativeID="clerk-captcha" />

              <Button
                label="Create Account"
                onPress={onSubmitForm}
                loading={fetchStatus === "fetching"}
                disabled={!emailAddress || !password}
                icon={<Ionicons name="arrow-forward" size={18} color="#FFFFFF" />}
              />

              <View className="flex-row items-center gap-3">
                <View className="h-px flex-1 bg-border" />
                <Text className="font-sans text-xs text-primary-dark">OR</Text>
                <View className="h-px flex-1 bg-border" />
              </View>

              <Button
                label="Continue with Google"
                onPress={onGoogleSignIn}
                variant="secondary"
                loading={isGooglePending}
                icon={<Ionicons name="logo-google" size={18} color="#1D4626" />}
              />
            </View>
          ) : (
            <View className="gap-4">
              <Text className="text-center font-sans text-sm text-primary-dark">
                Enter the verification code sent to{"\n"}
                <Text className="font-inter-semibold text-primary">{emailAddress}</Text>
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
                <View className="rounded-2xl border border-red-200 bg-red-50 p-3">
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

          <View className="my-6 border-t border-border" />

          <View className="items-center">
            <Link href="/(auth)/sign-in" asChild>
              <Pressable className="flex-row items-center gap-1.5 py-1">
                <Text className="font-sans text-sm text-primary-dark">Already have an account?</Text>
                <Text className="font-inter-semibold text-sm text-primary">Sign in</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}
