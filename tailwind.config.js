/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,jsx,ts,tsx}",
    "./src/components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0a",
        surface: "#1a1a1a",
        primary: "#6366f1",
        success: "#22c55e",
        "text-primary": "#ffffff",
        "text-secondary": "#a1a1aa",
      },
    },
  },
  plugins: [],
};
