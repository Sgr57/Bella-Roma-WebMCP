/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "coffee-dark": "#3b2417",
        "coffee-mid": "#6f4e37",
        "coffee-cream": "#f5e6d3",
        "coffee-accent": "#c89860",
      },
      fontFamily: {
        display: ["Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
