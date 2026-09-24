export type StickerSet = { U: string; F: string; R: string; L: string; B: string; D: string };

export type ThemeDef = {
  id: string;
  name: string;
  description: string;
  mode: "light" | "dark";
  /** Page background, used behind the preview cube in the picker. */
  surface: string;
  stickers: StickerSet;
};

// UI tokens for each theme live in globals.css under [data-theme="…"].
// These values drive the picker previews, which must show every theme at once.
export const THEMES: ThemeDef[] = [
  {
    id: "daylight",
    name: "Daylight",
    description: "Bright and plain, standard sticker colors",
    mode: "light",
    surface: "#f6f7f9",
    stickers: { U: "#ffd500", F: "#009b48", R: "#c41e3a", L: "#ff5800", B: "#0046ad", D: "#ffffff" },
  },
  {
    id: "blackout",
    name: "Blackout",
    description: "Pure black, colors only where they count",
    mode: "dark",
    surface: "#000000",
    stickers: { U: "#ffd500", F: "#00b35a", R: "#e0243f", L: "#ff6a13", B: "#2b6cf0", D: "#f2f2f2" },
  },
  {
    id: "stickerless",
    name: "Stickerless",
    description: "Loud fluorescent plastic",
    mode: "light",
    surface: "#f3f0ff",
    stickers: { U: "#ffe600", F: "#8fe01e", R: "#ff2e88", L: "#ff8a00", B: "#00b8f0", D: "#ffffff" },
  },
  {
    id: "speedstack",
    name: "Speedstack",
    description: "Competition mat and timer",
    mode: "dark",
    surface: "#0b1a3a",
    stickers: { U: "#ffd23f", F: "#2fd07a", R: "#ff3b3b", L: "#ff8c2b", B: "#4f8dff", D: "#e8eefc" },
  },
  {
    id: "chalk",
    name: "Chalk",
    description: "Quiet greys for long sessions",
    mode: "light",
    surface: "#e9eae8",
    stickers: { U: "#e6b400", F: "#8c8f8a", R: "#5d605c", L: "#b4b6b2", B: "#3f423e", D: "#fafaf9" },
  },
];

export const THEME_IDS = THEMES.map((t) => t.id);
export const themeById = (id: string | undefined) => THEMES.find((t) => t.id === id) ?? THEMES[0];
