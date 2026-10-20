import type { Config } from "tailwindcss";

// Design tokens: warm tinted ground, white cards, one action colour (forest) reserved for things
// you can press, the active tab and live selection. Colors are also exposed as CSS variables in globals.css.
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
        ink: "#2B241F",
        forest: "#0F5C45",
        forestpress: "#0B4836",
        tile: "#0A2C20",
        cream: "#F6F1E8",
        line: "#EADFCF",
        track: "#EFE5D6",
        sand: "#F5EBDD",
        field: "#D9CCBA",
        gold: "#E2B85C",
        accent: "#C98A2B",
        goldtext: "#7A5718",
        muted: "#6F625A",
        mint: "#E3EFE8",
        // Completed data (bars, finished juz, streak days): a quiet sage, clearly apart from the action green
        done: "#6E8F7C",
        donetext: "#3B5A4A",
        donebg: "#E6EDE7",
        progress: "#F8E9CC",
        progresstext: "#6B4D12",
        danger: "#A33A26",
        dangerline: "#EBC9BF",
        exit: "#F6B4A2",
        sidebartext: "#4A403A",
        sidebarmuted: "#8A7D73",
        onforest: "#CFE3D9",
      },
      fontFamily: {
        sans: ["var(--font-nunito)", "system-ui", "sans-serif"],
        display: ["var(--font-nunito)", "system-ui", "sans-serif"],
        amiri: ["var(--font-amiri)", "serif"],
      },
      borderRadius: {
        card: "24px",
        hero: "28px",
        btn: "16px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(43,36,31,0.04), 0 8px 24px -12px rgba(43,36,31,0.12)",
        bar: "0 8px 28px -10px rgba(43,36,31,0.22)",
      },
      minHeight: {
        touch: "44px",
      },
    },
  },
  plugins: [],
};
export default config;
