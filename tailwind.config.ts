import type { Config } from "tailwindcss";

// Design tokens (see design system: Xətm App). Colors are also exposed as CSS variables in globals.css.
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        ink: "#12261E",
        forest: "#0E3B2B",
        tile: "#0A2C20",
        cream: "#F7F3EA",
        line: "#E9E2D0",
        track: "#E6DFCC",
        sand: "#EFE9D9",
        field: "#CFC6AE",
        gold: "#E2B85C",
        accent: "#C79A3B",
        goldtext: "#7A5718",
        muted: "#4F6158",
        mint: "#E4EDE6",
        done: "#1C5B3A",
        donebg: "#DDEBDD",
        progress: "#F4E7C4",
        progresstext: "#6B4D12",
        danger: "#9C2F1B",
        dangerline: "#E8C3BA",
        exit: "#F6B4A2",
        sidebartext: "#D3E2D9",
        sidebarmuted: "#A9C2B4",
        onforest: "#BBD0C3",
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "system-ui", "sans-serif"],
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        amiri: ["var(--font-amiri)", "serif"],
      },
      borderRadius: {
        card: "20px",
        hero: "24px",
        btn: "14px",
      },
      minHeight: {
        touch: "44px",
      },
    },
  },
  plugins: [],
};
export default config;
