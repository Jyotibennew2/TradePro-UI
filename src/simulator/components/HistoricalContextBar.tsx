/**
 * TradePro Simulator - Historical Context Bar
 *
 * A single compact strip (Bloomberg/TradingView-style) that surfaces the
 * "what am I actually looking at right now" facts for the currently
 * selected historical snapshot: Date | Time | DTE | Market Status | VIX |
 * ATM IV | PCR | Spot | Futures | Gap% | Bias Score. Pure display over
 * fields already computed in useHistoricalChain — no new calculation logic
 * lives in this file.
 *
 * Uses the app's central theme system (`useTheme()` / styles/theme.ts) —
 * the same pattern OptionChainPanel.tsx follows — so this bar correctly
 * adapts to both light and dark mode instead of hardcoding colors.
 *
 * VIX and Futures are intentionally rendered as "N/A": no backend field for
 * either exists in ArchivedChainRow/ArchivedChainResponse today, and
 * showing a fabricated number would be actively misleading in a
 * trading-adjacent tool. The tooltip explains why, so the gap is honest
 * rather than silently wrong.
 */
import { useTheme } from "../../store/themeStore";
import { MARKET_PHASE_LABEL } from "../hooks/useHistoricalChain";
import type { HistoricalChain } from "../hooks/useHistoricalChain";
import { fmtDateLabel, fmtTime } from "../hooks/useHistoricalChain";

function Cell({
  label, value, color, faint, title,
}: { label: string; value: string; color?: string; faint: string; title?: string }) {
  return (
    <div className="flex flex-col items-start shrink-0 px-2" title={title}>
      <div style={{ fontSize: 8, color: faint, letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: color ?? faint }}>{value}</div>
    </div>
  );
}

export default function HistoricalContextBar({ chain }: { chain: HistoricalChain }) {
  const theme = useTheme();
  if (!chain.hasData || !chain.chainMeta) return null;

  const biasColor =
    chain.snapshotBias === "BULLISH" ? theme.accent.green :
    chain.snapshotBias === "BEARISH" ? theme.accent.red :
    theme.text.muted;

  const phaseColor =
    chain.marketPhase === "CLOSED" ? theme.accent.red :
    chain.marketPhase === "PRE_OPEN" ? theme.text.faint :
    theme.accent.green;

  return (
    <div
      className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto"
      style={{ background: theme.bg.surfaceAlt, borderBottom: `1px solid ${theme.border.subtle}` }}
    >
      <Cell label="DATE" value={fmtDateLabel(chain.selectedDate)} faint={theme.text.faint} color={theme.text.secondary} />
      <Cell label="TIME" value={fmtTime(chain.chainMeta.savedAt).split(", ").pop() ?? "-"} faint={theme.text.faint} color={theme.text.secondary} />
      <Cell label="DTE" value={chain.dte != null ? `${chain.dte}d` : "-"} color={theme.accent.orange} faint={theme.text.faint} />
      <Cell
        label="STATUS"
        value={chain.marketPhase ? MARKET_PHASE_LABEL[chain.marketPhase] : "-"}
        color={phaseColor}
        faint={theme.text.faint}
      />
      <Cell label="VIX" value="N/A" faint={theme.text.faint} title="No VIX field in the archived data source yet" />
      <Cell label="ATM IV" value={chain.atmIv != null ? `${chain.atmIv.toFixed(1)}%` : "-"} color={theme.accent.purple} faint={theme.text.faint} />
      <Cell
        label="PCR"
        value={chain.pcr != null ? chain.pcr.toFixed(2) : "N/A"}
        color={chain.pcr == null ? theme.text.faint : chain.pcr > 1.15 ? theme.accent.green : chain.pcr < 0.85 ? theme.accent.red : theme.text.secondary}
        faint={theme.text.faint}
      />
      <Cell label="SPOT" value={`₹${chain.chainMeta.spot.toLocaleString("en-IN")}`} color={theme.accent.cyan} faint={theme.text.faint} />
      <Cell label="FUTURES" value="N/A" faint={theme.text.faint} title="No futures field in the archived data source yet" />
      <Cell
        label="GAP %"
        value={chain.gapPct != null ? `${chain.gapPct >= 0 ? "+" : ""}${chain.gapPct.toFixed(2)}%` : "-"}
        color={chain.gapPct == null ? theme.text.faint : chain.gapPct >= 0 ? theme.accent.green : theme.accent.red}
        faint={theme.text.faint}
      />

      <div className="ml-auto flex items-center gap-1.5 shrink-0 pl-2">
        {chain.isExpiryDay && (
          <span
            className="px-1.5 py-0.5 rounded font-bold"
            style={{ background: theme.accent.red + "20", color: theme.accent.red, fontSize: 9 }}
          >
            EXPIRY
          </span>
        )}
        {chain.currentEvent && (
          <span
            className="px-1.5 py-0.5 rounded font-bold"
            style={{ background: theme.accent.orange + "20", color: theme.accent.orange, fontSize: 9 }}
            title={chain.currentEvent.label}
          >
            {chain.currentEvent.type}
          </span>
        )}
        <span
          className="px-2 py-0.5 rounded-full font-black"
          style={{ background: biasColor + "20", color: biasColor, fontSize: 9 }}
          title="Heuristic read from PCR + IV skew — not a trading signal"
        >
          {chain.snapshotBias}
        </span>
      </div>
    </div>
  );
}
