/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Lavazza-inspired palette (mapped onto legacy "coffee-*" names)
        "coffee-dark": "#163052",     // Lavazza navy — primary dark
        "coffee-mid": "#343E52",      // body gray-blue
        "coffee-cream": "#FEF1DF",    // warm cream
        "coffee-accent": "#FF8700",   // Lavazza orange — CTA / accent
        // additions
        "lavazza-deep": "#051432",    // deep navy for headings
        "lavazza-off": "#FFFBF8",     // off-white warm
        "lavazza-soft": "#F4FBFF",    // soft blue tint
        "lavazza-line": "#E6E9EF",    // hairline border
      },
      fontFamily: {
        display: ['"Graphik"', "Inter", "system-ui", "sans-serif"],
        sans: ['"Graphik"', "Inter", "system-ui", "sans-serif"],
        script: ["Caveat", "cursive"],
      },
      borderRadius: {
        pill: "30px",
      },
      boxShadow: {
        lavazza: "0 0 6px rgba(2,20,35,0.08)",
        "lavazza-md": "0 2px 12px rgba(2,20,35,0.10)",
      },
    },
  },
  plugins: [],
};
