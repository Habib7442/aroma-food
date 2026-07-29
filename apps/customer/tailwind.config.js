/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Per docs/DESIGN.md: Plus Jakarta Sans for headlines/prices, Inter
      // for body/labels — deliberately not the vendor app's Rubik/SpaceMono.
      fontFamily: {
        sans: ["Inter_400Regular"],
        "inter-medium": ["Inter_500Medium"],
        "inter-semibold": ["Inter_600SemiBold"],
        headline: ["PlusJakartaSans_700Bold"],
        "headline-semibold": ["PlusJakartaSans_600SemiBold"],
      },
      colors: {
        primary: "#1D4626",
        "primary-dark": "#032F12",
        secondary: "#FEAE32",
        "secondary-dark": "#835400",
        background: "#FAF8F5",
        card: "#FFFFFF",
        border: "#EDE9E3",
        veg: "#0F8A4D",
        egg: "#E8A33D",
        "non-veg": "#A52A2A",
      },
      borderRadius: {
        card: "16px",
      },
    },
  },
};
