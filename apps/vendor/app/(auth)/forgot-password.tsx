import { useSignIn } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Button } from "../../components/Button";
import { ScreenContainer } from "../../components/ScreenContainer";
import { TextField } from "../../components/TextField";

type Step = "email" | "code" | "newPassword";

export default function ForgotPasswordScreen() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const [step, setStep] = useState<Step>("email");
  const [emailAddress, setEmailAddress] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const onSendCode = async () => {
    setFormError(null);
    const { error: createError } = await signIn.create({ identifier: emailAddress });
    if (createError) {
      setFormError(createError.message);
      return;
    }
    const { error: sendError } = await signIn.resetPasswordEmailCode.sendCode();
    if (sendError) {
      setFormError(sendError.message);
      return;
    }
    setStep("code");
  };

  const onVerifyCode = async () => {
    setFormError(null);
    const { error } = await signIn.resetPasswordEmailCode.verifyCode({ code });
    if (error) {
      setFormError(error.message);
      return;
    }
    setStep("newPassword");
  };

  const onSubmitNewPassword = async () => {
    setFormError(null);
    const { error } = await signIn.resetPasswordEmailCode.submitPassword({ password });
    if (error) {
      setFormError(error.message);
      return;
    }
    if (signIn.status === "complete") {
      await signIn.finalize();
      router.replace("/(app)/orders");
    }
  };

  return (
    <ScreenContainer scroll center centerVertical>
      <View className="w-full max-w-[400px] items-center">
        <View className="w-full rounded-2xl border border-border bg-card p-6 shadow-sm">
          {/* Header */}
          <View className="items-center mb-6">
            <Text className="text-3xl font-rubik-bold text-primary tracking-tight text-center">
              Reset Password
            </Text>
            <Text className="font-sans text-sm text-[#5A6357] text-center mt-1">
              Recover access to your vendor account
            </Text>
          </View>

          {step === "email" ? (
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
              {formError ? (
                <View className="rounded-lg bg-red-50 p-3 border border-red-200">
                  <Text className="font-sans text-xs text-non-veg">{formError}</Text>
                </View>
              ) : null}
              <Button
                label="Send Reset Code"
                onPress={onSendCode}
                loading={fetchStatus === "fetching"}
                icon={<Ionicons name="mail-outline" size={18} color="#FFFFFF" />}
              />
            </View>
          ) : null}

          {step === "code" ? (
            <View className="gap-4">
              <Text className="font-sans text-sm text-[#5A6357] text-center">
                Enter the recovery code sent to{"\n"}
                <Text className="font-rubik-medium text-primary">{emailAddress}</Text>
              </Text>
              <TextField
                label="Reset Code"
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
                label="Verify Code"
                onPress={onVerifyCode}
                loading={fetchStatus === "fetching"}
                icon={<Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />}
              />
            </View>
          ) : null}

          {step === "newPassword" ? (
            <View className="gap-4">
              <TextField
                label="New Password"
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
              <Button
                label="Set New Password"
                onPress={onSubmitNewPassword}
                loading={fetchStatus === "fetching"}
                icon={<Ionicons name="lock-closed-outline" size={18} color="#FFFFFF" />}
              />
            </View>
          ) : null}

          {/* Divider */}
          <View className="my-6 border-t border-border" />

          {/* Secondary Actions */}
          <View className="items-center">
            <Link href="/(auth)/sign-in" asChild>
              <Pressable className="flex-row items-center gap-1.5 py-1">
                <Ionicons name="arrow-back" size={16} color="#1D4626" />
                <Text className="font-rubik-medium text-sm text-primary">Back to Sign In</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}


