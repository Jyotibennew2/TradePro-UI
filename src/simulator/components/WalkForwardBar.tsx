/**
 * TradePro Simulator - Walk-Forward Bar
 * Large progress bar (fills left→right as you replay through the archived
 * snapshots for the day) plus the Run Walk-Forward Backtest button and
 * SL%/Target% inputs. Reuses useHistoricalChain's existing walk-forward
 * state/handler — no new calculation logic, this is a display of it.
 */
import { useTheme } from "../../store/themeStore";
import { fmtTime } from "../hooks/useHistoricalChain";
import type { HistoricalChain } from "../hooks/useHistoricalChain";

export default function WalkForwardBar({ chain }: { chain: HistoricalChain }) {
  const theme = useTheme();
  if (!chain.hasData) return null;

  return (
    <div className="px-3 py-2 space-y-1.5" style={{ background: theme.bg.surface, borderBottom: `1px solid ${theme.border.subtle}` }}>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-sm font-bold shrink-0" style={{ color: theme.accent.orange }}>
          Walk Forward
        </div>

        <div className="flex-1 min-w-[120px] h-2.5 rounded-full overflow-hidden" style={{ background: theme.bg.surfaceAlt }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${chain.replayProgressPct}%`, background: theme.accent.orange }}
          />
        </div>

        <div className="text-sm shrink-0" style={{ color: theme.text.muted }}>
          {chain.chainMeta ? fmtTime(chain.chainMeta.savedAt) : "—"}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <input
            type="number" min={1} max={500} value={chain.wfSlPct}
            onChange={e => chain.setWfSlPct(Number(e.target.value))}
            title="Stop-loss %" placeholder="SL%"
            className="w-14 px-1.5 py-1 rounded text-sm text-center outline-none"
            style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}`, color: theme.accent.red }}
          />
          <input
            type="number" min={1} max={500} value={chain.wfTgtPct}
            onChange={e => chain.setWfTgtPct(Number(e.target.value))}
            title="Target %" placeholder="Tgt%"
            className="w-14 px-1.5 py-1 rounded text-sm text-center outline-none"
            style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}`, color: theme.accent.green }}
          />
          <button
            onClick={chain.runWalkForward}
            disabled={chain.wfLoading}
            className="px-3 py-1.5 rounded-lg text-sm font-black shrink-0"
            style={{ background: theme.accent.orange, color: theme.bg.page, opacity: chain.wfLoading ? 0.6 : 1 }}
          >
            {chain.wfLoading ? "Running…" : "Run Walk Forward Backtest"}
          </button>
        </div>
      </div>

      {chain.wfError && <div className="text-sm" style={{ color: theme.accent.red }}>{chain.wfError}</div>}

      {chain.wfResult && (
        <div className="text-sm" style={{ color: theme.text.muted }}>
          Exit:{" "}
          <span style={{ color: chain.wfResult.exit.reason.toLowerCase().includes("sl") ? theme.accent.red : theme.accent.green, fontWeight: 700 }}>
            {chain.wfResult.exit.reason}
          </span>
          {" • "}Final P&L:{" "}
          <span style={{ color: chain.wfResult.final_pnl >= 0 ? theme.accent.green : theme.accent.red, fontWeight: 700 }}>
            {chain.wfResult.final_pnl >= 0 ? "+" : ""}₹{Math.round(chain.wfResult.final_pnl).toLocaleString("en-IN")}
          </span>
          {chain.wfResult.was_mock && <span style={{ color: theme.accent.orange }}> (mock data)</span>}
        </div>
      )}
    </div>
  );
}
