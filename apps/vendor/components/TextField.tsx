import { Ionicons } from "@expo/vector-icons";
import { ReactNode, useState } from "react";
import { Pressable, Text, TextInput, View, type TextInputProps } from "react-native";

interface TextFieldProps extends TextInputProps {
  label: string;
  headerRight?: ReactNode;
  error?: string | null;
}

export function TextField({
  label,
  headerRight,
  error,
  secureTextEntry,
  ...inputProps
}: TextFieldProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  return (
    <View className="gap-1.5 w-full">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-rubik-medium text-primary">{label}</Text>
        {headerRight}
      </View>
      <View
        className={`min-h-[52px] flex-row items-center rounded-xl border bg-[#F9FAF4]/60 px-4 ${
          error ? "border-non-veg bg-red-50/20" : "border-border"
        }`}
      >
        <TextInput
          className="flex-1 font-sans text-base text-primary py-3"
          placeholderTextColor="#8A8578"
          secureTextEntry={secureTextEntry ? !isPasswordVisible : false}
          {...inputProps}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setIsPasswordVisible((prev) => !prev)}
            hitSlop={8}
            className="ml-2 py-1"
          >
            <Ionicons
              name={isPasswordVisible ? "eye-off-outline" : "eye-outline"}
              size={20}
              color="#5A6357"
            />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text className="font-sans text-xs text-non-veg mt-0.5">{error}</Text> : null}
    </View>
  );
}


