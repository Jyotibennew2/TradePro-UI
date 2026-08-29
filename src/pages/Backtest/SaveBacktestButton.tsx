import { useState } from "react";
import { saveBacktest, type SavedBacktestKind } from "../../utils/api";
import { useTheme } from "../../store/themeStore";

interface Props {
  kind      : SavedBacktestKind;
  /** The exact params object used to run this backtest. */
  request   : unknown;
  /** The exact response the backtest endpoint returned. */
  result    : unknown;
  symbol?   : string;
  dataSource?: string;
}

/**
 * Small reusable "Save this run" button, used by SingleBacktest, Compare,
 * and BatchBacktest so saving isn't implemented three separate times.
 * Purely a thin wrapper over saveBacktest() from api.ts — no logic beyond
 * a label prompt and a saved/error state.
 */
export default function SaveBacktestButton({ kind, request, result, symbol, dataSource }: Props) {
  const theme = useTheme();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const handleSave = async () => {
    const label = window.prompt("Name this backtest run (optional):", "") ?? undefined;
    setState("saving");
    try {
      await saveBacktest({ kind, request, result, label: label || undefined, symbol, dataSource });
      setState("saved");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2500);
    }
  };

  const label = state === "saving" ? "Saving..." : state === "saved" ? "✓ Saved" : state === "error" ? "Save failed" : "💾 Save this run";
  const color = state === "saved" ? theme.accent.green : state === "error" ? theme.accent.red : theme.text.muted;

  return (
    <button onClick={handleSave} disabled={state === "saving"}
      className="px-3 py-1.5 rounded-lg text-sm font-bold"
      style={{ background: theme.bg.surfaceAlt, color, border: `1px solid ${theme.border.subtle}` }}>
      {label}
    </button>
  );
}
