/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
    "./store/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Rubik-Regular"],
        "rubik-light": ["Rubik-Light"],
        "rubik-medium": ["Rubik-Medium"],
        "rubik-semibold": ["Rubik-SemiBold"],
        "rubik-bold": ["Rubik-Bold"],
        "rubik-extrabold": ["Rubik-ExtraBold"],
        mono: ["SpaceMono-Regular"],
      },
      colors: {
        primary: "#1D4626",
        background: "#FAF8F5",
        card: "#FFFFFF",
        border: "#EDE9E3",
        veg: "#0F8A4D",
        egg: "#E8A33D",
        "non-veg": "#A52A2A",
      },
      borderRadius: {
        card: "12px",
        button: "8px",
      },
    },
  },
};
