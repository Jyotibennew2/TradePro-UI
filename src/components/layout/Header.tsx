import { useAppStore } from "../../store";
import { useHealth, useQuotes } from "../../hooks/useQuotes";
import { Activity, Zap, Sun, Moon } from "lucide-react";
import { useTheme, useThemeStore } from "../../store/themeStore";

export default function Header() {
  useHealth();
  useQuotes();

  const theme = useTheme();
  const { mode, toggle } = useThemeStore();
  const { nifty, bankNifty, isLive, isMock } = useAppStore();

  const fmt = (n: number) =>
    n > 0 ? n.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "---";

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b"
      style={{ background: theme.bg.header, borderColor: theme.border.subtle }}>

      {/* Logo */}
      <div className="flex items-center gap-2">
        <Zap size={18} color={theme.accent.cyan} fill={theme.accent.cyan} />
        <span className="font-black text-lg" style={{ color: theme.accent.cyan }}>
          TradePro
        </span>
        <span className="text-xs px-1 rounded"
          style={{ background: theme.border.subtle, color: theme.text.muted }}>
          v3.0
        </span>
      </div>

      {/* Quotes */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs"
          style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}` }}>
          <span style={{ color: theme.text.muted }}>N</span>
          <span className="font-bold" style={{ color: theme.accent.cyan }}>{fmt(nifty)}</span>
        </div>
        <div className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs"
          style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}` }}>
          <span style={{ color: theme.text.muted }}>BN</span>
          <span className="font-bold" style={{ color: theme.accent.purple }}>{fmt(bankNifty)}</span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <Activity size={10} color={isLive ? theme.accent.green : theme.accent.orange} />
          <span style={{ color: isLive ? theme.accent.green : theme.accent.orange }}>
            {isMock ? "MOCK" : "LIVE"}
          </span>
        </div>

        {/* Theme toggle */}
        <button onClick={toggle}
          className="flex items-center justify-center p-1.5 rounded-lg"
          style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}`, color: theme.text.muted }}
          title={mode === "light" ? "Switch to dark theme" : "Switch to light theme"}
        >
          {mode === "light" ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </div>
    </header>
  );
}
