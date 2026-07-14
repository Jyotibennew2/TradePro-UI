/**
 * TradePro - Central Theme System
 * Single source of truth for all colors used across the app.
 * Change a value here and it updates everywhere — no need to hunt
 * through individual components.
 */

export interface Theme {
  bg: {
    page       : string; // full-page background
    surface    : string; // card / panel background
    surfaceAlt : string; // input / secondary surface
    header     : string; // top bar / tab bar
  };
  border: {
    subtle : string;
    strong : string;
  };
  text: {
    primary   : string; // main readable text / values
    secondary : string; // slightly muted text
    muted     : string; // labels
    faint     : string; // sub-labels, captions
  };
  accent: {
    cyan   : string; // primary brand / info
    purple : string; // IV / secondary metric
    green  : string; // buy / profit
    red    : string; // sell / loss
    orange : string; // warning / spot marker
  };
}

export const lightTheme: Theme = {
  bg: {
    page      : "#ffffff",
    surface   : "#f6f8fb",
    surfaceAlt: "#eef2f8",
    header    : "#ffffff",
  },
  border: {
    subtle: "#e1e7f0",
    strong: "#c7d2e3",
  },
  text: {
    primary  : "#0d1420",
    secondary: "#33465e",
    muted    : "#5a6b82",
    faint    : "#8393a8",
  },
  accent: {
    cyan  : "#0090c8",
    purple: "#7c3aed",
    green : "#0ca868",
    red   : "#d81b4a",
    orange: "#c97a12",
  },
};

export const darkTheme: Theme = {
  bg: {
    page      : "#03050d",
    surface   : "#060c1a",
    surfaceAlt: "#090f1e",
    header    : "#060c1a",
  },
  border: {
    subtle: "#0f1e36",
    strong: "#1a3050",
  },
  text: {
    primary  : "#e4edf8",
    secondary: "#c0d0e8",
    muted    : "#8ba0bd",
    faint    : "#6b8099",
  },
  accent: {
    cyan  : "#3ad4ff",
    purple: "#b98cf9",
    green : "#22e894",
    red   : "#ff5577",
    orange: "#f0a030",
  },
};

export type ThemeMode = "light" | "dark";

export function getTheme(mode: ThemeMode): Theme {
  return mode === "light" ? lightTheme : darkTheme;
}
