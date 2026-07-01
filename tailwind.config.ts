import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#ea580c", dark: "#c2410c", light: "#fb923c", tint: "#fff1e6" },
        ink: { 1: "#0f172a", 2: "#475569", 3: "#94a3b8" },
        line: { DEFAULT: "#e2e8f0", soft: "#f1f5f9" },
        ok: "#059669", warn: "#d97706", danger: "#dc2626", info: "#2563eb",
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;
