module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // Must stay last — react-native-reanimated 4.x delegates worklet
    // transforms to react-native-worklets.
    plugins: ["react-native-worklets/plugin"],
  };
};
