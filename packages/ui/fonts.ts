/**
 * Font assets shared by every Expo app (customer, vendor). Pass directly to
 * `useFonts()` from `expo-font` — Metro resolves these `require()` calls
 * across workspace packages since metro.config.js watches the whole
 * monorepo root.
 */
export const fontAssets = {
  "Rubik-Light": require("./fonts/Rubik-Light.ttf"),
  "Rubik-Regular": require("./fonts/Rubik-Regular.ttf"),
  "Rubik-Medium": require("./fonts/Rubik-Medium.ttf"),
  "Rubik-SemiBold": require("./fonts/Rubik-SemiBold.ttf"),
  "Rubik-Bold": require("./fonts/Rubik-Bold.ttf"),
  "Rubik-ExtraBold": require("./fonts/Rubik-ExtraBold.ttf"),
  "SpaceMono-Regular": require("./fonts/SpaceMono-Regular.ttf"),
} as const;

export type FontFamily = keyof typeof fontAssets;
