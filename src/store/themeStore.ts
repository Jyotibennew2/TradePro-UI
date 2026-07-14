/**
 * TradePro - Theme Store
 * Holds the current theme mode (light/dark) and persists the choice.
 * Any component can read the live theme via useTheme().
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getTheme, type Theme, type ThemeMode } from "../styles/theme";

interface ThemeState {
  mode : ThemeMode;
  theme: Theme;
  setMode: (mode: ThemeMode) => void;
  toggle : () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode : "light",
      theme: getTheme("light"),
      setMode: (mode) => set({ mode, theme: getTheme(mode) }),
      toggle : () => {
        const next = get().mode === "light" ? "dark" : "light";
        set({ mode: next, theme: getTheme(next) });
      },
    }),
    { name: "tradepro-theme" }
  )
);

/** Convenience hook: `const theme = useTheme();` */
export function useTheme(): Theme {
  return useThemeStore((s) => s.theme);
}
