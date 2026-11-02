import type { Config } from "tailwindcss";

// Design tokens: porcelain ground, white and vellum cards, one action colour (forest) reserved for things
// you can press, the active tab and live selection; gold leaf only draws ornament. Colors are also exposed as CSS variables in globals.css.
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
        // Tezhip palette (Ottoman mushaf illumination): lapis ink, emerald for actions, gold leaf for ornament
        ink: "#182235",
        forest: "#0F5C45",
        forestpress: "#0B4836",
        tile: "#0A2C20",
        cream: "#F1F2EC",
        vellum: "#FCFBF6",
        line: "#DEE0D6",
        track: "#E7E8E0",
        sand: "#EAECE3",
        field: "#C9CCC0",
        gold: "#E2B85C",
        leaf: "#A9823A",
        leaflight: "#E9DDBF",
        accent: "#C4862A",
        goldtext: "#7A5A1E",
        muted: "#5E6675",
        mint: "#E2EEE8",
        // Finished data (bars, finished juz, streak days): lapis, clearly apart from the action green
        lapis: "#23406B",
        done: "#23406B",
        donetext: "#23406B",
        donebg: "#E4E9F1",
        // 30-juz map: finished lapis, in progress saffron, handed out pale saffron, free track
        juzdone: "#23406B",
        juzprogress: "#C4862A",
        juzassigned: "#F7EBD3",
        juzassignedline: "#DDB778",
        progress: "#F7EBD3",
        progresstext: "#6E4B12",
        danger: "#9E3426",
        dangerline: "#EBC9BF",
        exit: "#F6B4A2",
        sidebartext: "#3A4456",
        sidebarmuted: "#7C8494",
        onforest: "#CFE3D9",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        // Inscriptional capitals for page titles and big headings
        display: ["var(--font-display)", "Georgia", "serif"],
        amiri: ["var(--font-amiri)", "serif"],
      },
      borderRadius: {
        card: "18px",
        hero: "20px",
        btn: "14px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(24,34,53,0.05), 0 10px 28px -16px rgba(24,34,53,0.22)",
        bar: "0 8px 28px -10px rgba(24,34,53,0.24)",
      },
      minHeight: {
        touch: "44px",
      },
    },
  },
  plugins: [],
};
export default config;
