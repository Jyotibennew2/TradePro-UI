import { useEffect, useState } from "react";
import {
  listSavedBacktests, getSavedBacktest, deleteSavedBacktest,
  type SavedBacktestListItem, type SavedBacktestFull,
} from "../../utils/api";
import Card from "../../components/ui/Card";
import Loader from "../../components/ui/Loader";
import ErrorBox from "../../components/ui/ErrorBox";
import { useTheme } from "../../store/themeStore";
import { StatBox, fmt, fmtPct, fmtDateTime } from "./shared";

const KIND_LABELS: Record<string, string> = {
  single        : "Single Backtest",
  compare       : "Compare Strategies",
  batch         : "Batch — Strategy Sweep",
  batch_realdata: "Batch — Real-Data Sweep",
  walkforward   : "Walk-Forward",
};

/**
 * Phase 1 "Saved Backtests" — lists every run saved via <SaveBacktestButton>
 * (Single Backtest, Batch Backtest — either sweep mode) and lets the user
 * reopen one to see its original result. Purely a viewer: no backtest is
 * ever re-run here, it only displays the request/result JSON exactly as
 * it was saved (backend/services/backtest_store.py).
 */
export default function SavedBacktests() {
  const theme = useTheme();
  const [list, setList] = useState<SavedBacktestListItem[] | null>(null);
  const [listError, setListError] = useState(false);

  const [selected, setSelected] = useState<SavedBacktestFull | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState(false);

  const loadList = () => {
    setListError(false);
    listSavedBacktests()
      .then(r => setList(r.data))
      .catch(() => setListError(true));
  };

  useEffect(() => { loadList(); }, []);

  const openRun = async (id: number) => {
    setLoadingDetail(true); setDetailError(false); setSelected(null);
    try {
      const r = await getSavedBacktest(id);
      setSelected(r.data);
    } catch {
      setDetailError(true);
    } finally {
      setLoadingDetail(false);
    }
  };

  const removeRun = async (id: number) => {
    if (!window.confirm("Delete this saved backtest? This can't be undone.")) return;
    try {
      await deleteSavedBacktest(id);
      if (selected?.id === id) setSelected(null);
      loadList();
    } catch {
      window.alert("Delete failed — try again.");
    }
  };

  return (
    <>
      <Card title="Saved Backtests">
        {listError && <ErrorBox message="Failed to load saved backtests" />}
        {!listError && list === null && <Loader text="Loading saved runs..." />}
        {list && list.length === 0 && (
          <div className="text-sm text-center py-6" style={{ color: theme.text.muted }}>
            No saved backtests yet — run one on the other tabs and tap "💾 Save this run".
          </div>
        )}
        {list && list.length > 0 && (
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {list.map(item => (
              <button key={item.id} onClick={() => openRun(item.id)}
                className="w-full text-left px-3 py-2 rounded-lg flex items-center justify-between gap-2"
                style={{
                  background: selected?.id === item.id ? theme.bg.surfaceAlt : "transparent",
                  border: `1px solid ${theme.border.subtle}`,
                }}>
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate" style={{ color: theme.text.secondary }}>
                    {item.label || KIND_LABELS[item.kind] || item.kind}
                  </div>
                  <div className="text-sm" style={{ color: theme.text.faint }}>
                    {KIND_LABELS[item.kind] || item.kind}{item.symbol ? ` • ${item.symbol}` : ""} • {fmtDateTime(item.created_at)}
                  </div>
                </div>
                <span className="text-sm px-2 py-0.5 rounded font-bold shrink-0"
                  style={{ background: theme.bg.surfaceAlt, color: theme.text.muted }}>
                  #{item.id}
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {loadingDetail && <Loader text="Loading saved run..." />}
      {detailError && <ErrorBox message="Failed to load this saved backtest" />}

      {selected && (
        <Card title={selected.label || KIND_LABELS[selected.kind] || selected.kind}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm" style={{ color: theme.text.muted }}>
                {KIND_LABELS[selected.kind] || selected.kind}
                {selected.symbol ? ` • ${selected.symbol}` : ""} • {fmtDateTime(selected.created_at)}
                {selected.data_source ? ` • ${selected.data_source}` : ""}
              </div>
              <button onClick={() => removeRun(selected.id)}
                className="px-3 py-1.5 rounded-lg text-sm font-bold"
                style={{ background: theme.bg.surfaceAlt, color: theme.accent.red, border: `1px solid ${theme.border.subtle}` }}>
                🗑 Delete
              </button>
            </div>

            {/* Single / Compare — a plain summary object */}
            {(selected.kind === "single" || selected.kind === "compare") && selected.result?.summary && (
              <div className="grid grid-cols-2 gap-2">
                {(() => {
                  const s = selected.result.summary;
                  return (
                    <>
                      <StatBox theme={theme} label="Total Trades"  value={`${s.total}`}                        color={theme.text.secondary} />
                      <StatBox theme={theme} label="Win Rate"      value={fmtPct(s.win_rate)}                  color={s.win_rate >= 50 ? theme.accent.green : theme.accent.red} />
                      <StatBox theme={theme} label="Total P&L"    value={`₹${fmt(s.total_pnl)}`}              color={s.total_pnl >= 0 ? theme.accent.green : theme.accent.red} />
                      <StatBox theme={theme} label="Max Drawdown"  value={`₹${fmt(Math.abs(s.max_drawdown))}`} color={theme.accent.red} />
                      <StatBox theme={theme} label="Profit Factor" value={`${s.profit_factor}x`}              color={s.profit_factor >= 1 ? theme.accent.green : theme.accent.red} />
                      <StatBox theme={theme} label="Sharpe"        value={`${s.sharpe}`}                      color={s.sharpe >= 1 ? theme.accent.green : theme.accent.orange} />
                    </>
                  );
                })()}
              </div>
            )}

            {/* Batch (either sweep mode) — a ranked list */}
            {(selected.kind === "batch" || selected.kind === "batch_realdata") && Array.isArray(selected.result?.ranked) && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ color: theme.text.muted }}>
                      <th className="text-left  py-1">#</th>
                      <th className="text-left  py-1">Job</th>
                      <th className="text-right py-1">P&L</th>
                      <th className="text-right py-1">Win %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.result.ranked.slice(0, 20).map((r: any) => (
                      <tr key={r.rank} style={{ borderTop: `1px solid ${theme.border.subtle}` }}>
                        <td className="py-1.5 font-bold" style={{ color: theme.text.faint }}>{r.rank}</td>
                        <td className="py-1.5 font-bold" style={{ color: theme.text.secondary }}>{r.job}</td>
                        <td className="text-right" style={{ color: r.summary.total_pnl >= 0 ? theme.accent.green : theme.accent.red }}>₹{fmt(r.summary.total_pnl)}</td>
                        <td className="text-right" style={{ color: theme.text.secondary }}>{fmtPct(r.summary.win_rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="text-sm mt-2" style={{ color: theme.text.faint }}>
                  Saved {selected.result.total_jobs} of {selected.result.requested_jobs} requested combos, ranked by {selected.result.rank_by}.
                </div>
              </div>
            )}

            {/* Fallback for any kind/shape not explicitly rendered above */}
            {!((selected.kind === "single" || selected.kind === "compare") && selected.result?.summary) &&
             !((selected.kind === "batch" || selected.kind === "batch_realdata") && Array.isArray(selected.result?.ranked)) && (
              <pre className="text-sm p-3 rounded-lg overflow-x-auto"
                style={{ background: theme.bg.surfaceAlt, color: theme.text.secondary, border: `1px solid ${theme.border.subtle}` }}>
                {JSON.stringify(selected.result, null, 2)}
              </pre>
            )}
          </div>
        </Card>
      )}

      {!selected && !loadingDetail && list && list.length > 0 && (
        <div className="text-center py-10" style={{ color: theme.text.muted }}>
          <div className="text-4xl mb-3">🗂️</div>
          <div className="text-sm">Tap a saved run above to view it</div>
        </div>
      )}
    </>
  );
}
