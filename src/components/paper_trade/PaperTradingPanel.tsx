import { useEffect, useState } from "react";
import { fetchPortfolio, fetchHistory, exitPaperOrder, fetchQuotes } from "../../utils/api";
import { useTheme } from "../../store/themeStore";

/**
 * Generic paper-trading positions/history panel — instrument-agnostic
 * (works for equity orders placed from the scanner AND the existing
 * options paper-trading routes, since backend/paper_trade.py's engine
 * already treats both uniformly). This is the first frontend consumer
 * of fetchPortfolio/fetchHistory/exitPaperOrder — those API functions
 * already existed but had no UI calling them before this.
 *
 * Note: SL/Target on an order are checked only when update_mtm() runs
 * server-side, and nothing currently calls that automatically for any
 * instrument (options included) — so exits here are manual (tap Exit,
 * confirm/adjust the fill price) rather than auto-triggered. Flagging
 * this rather than silently building a new auto-monitor loop, which is
 * a separate, larger piece of work.
 */
export default function PaperTradingPanel() {
  const theme = useTheme();
  const [portfolio, setPortfolio] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true); setError(null);
    Promise.all([fetchPortfolio(), fetchHistory(20)])
      .then(([p, h]) => { setPortfolio(p.data); setHistory(h.data); })
      .catch(() => setError("Failed to load paper trading data"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  const handleExit = async (order: any) => {
    let exitPrice: number | null = null;
    try {
      const q = await fetchQuotes(order.symbol);
      const ltp = (q as any)?.data?.[order.symbol]?.ltp ?? (q as any)?.data?.[order.symbol]?.lp;
      if (typeof ltp === "number") exitPrice = ltp;
    } catch { /* fall through to manual entry */ }

    const entered = window.prompt(
      `Exit price for ${order.symbol} (${order.qty} qty @ entry ₹${order.entry_price}):`,
      exitPrice !== null ? String(exitPrice) : ""
    );
    if (!entered) return;
    const price = Number(entered);
    if (isNaN(price) || price <= 0) { window.alert("Enter a valid price"); return; }

    try {
      await exitPaperOrder(order.order_id, price);
      refresh();
    } catch {
      window.alert("Exit failed — try again.");
    }
  };

  if (loading && !portfolio) {
    return <div className="text-sm py-4 text-center" style={{ color: theme.text.muted }}>Loading paper trading account...</div>;
  }
  if (error) {
    return <div className="text-sm py-4 text-center" style={{ color: theme.accent.red }}>{error}</div>;
  }
  if (!portfolio) return null;

  const pnlColor = (v: number) => v >= 0 ? theme.accent.green : theme.accent.red;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg p-2 text-center" style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}` }}>
          <div className="text-xs" style={{ color: theme.text.muted }}>Available</div>
          <div className="text-sm font-bold" style={{ color: theme.text.secondary }}>₹{portfolio.available.toLocaleString("en-IN")}</div>
        </div>
        <div className="rounded-lg p-2 text-center" style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}` }}>
          <div className="text-xs" style={{ color: theme.text.muted }}>Unrealized</div>
          <div className="text-sm font-bold" style={{ color: pnlColor(portfolio.unrealized_pnl) }}>₹{portfolio.unrealized_pnl.toLocaleString("en-IN")}</div>
        </div>
        <div className="rounded-lg p-2 text-center" style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}` }}>
          <div className="text-xs" style={{ color: theme.text.muted }}>Total P&L</div>
          <div className="text-sm font-bold" style={{ color: pnlColor(portfolio.total_pnl) }}>₹{portfolio.total_pnl.toLocaleString("en-IN")}</div>
        </div>
      </div>

      <div>
        <div className="text-xs font-bold uppercase mb-1" style={{ color: theme.text.muted }}>
          Open Positions ({portfolio.open_count})
        </div>
        {portfolio.open_positions.length === 0 && (
          <div className="text-sm text-center py-3" style={{ color: theme.text.faint }}>No open paper positions</div>
        )}
        {portfolio.open_positions.map((o: any) => (
          <div key={o.order_id} className="flex items-center justify-between py-2 px-2 rounded-lg mb-1"
            style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}` }}>
            <div>
              <div className="text-sm font-bold" style={{ color: theme.text.secondary }}>
                {o.symbol} {o.option_type !== "EQ" ? `${o.strike} ${o.option_type}` : ""}
              </div>
              <div className="text-xs" style={{ color: theme.text.faint }}>
                {o.action} {o.qty} @ ₹{o.entry_price} • {o.entry_time}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold" style={{ color: pnlColor(o.mtm) }}>₹{o.mtm}</span>
              <button onClick={() => handleExit(o)}
                className="px-2 py-1 rounded text-xs font-bold"
                style={{ background: theme.accent.red + "20", color: theme.accent.red }}>
                Exit
              </button>
            </div>
          </div>
        ))}
      </div>

      <div>
        <div className="text-xs font-bold uppercase mb-1" style={{ color: theme.text.muted }}>Recent History</div>
        {history.length === 0 && (
          <div className="text-sm text-center py-3" style={{ color: theme.text.faint }}>No closed trades yet</div>
        )}
        {history.slice().reverse().map((o: any) => (
          <div key={o.order_id} className="flex items-center justify-between py-1.5 text-sm border-b" style={{ borderColor: theme.border.subtle }}>
            <span style={{ color: theme.text.muted }}>{o.symbol} {o.option_type !== "EQ" ? `${o.strike} ${o.option_type}` : ""}</span>
            <span style={{ color: theme.text.faint }}>{o.status}</span>
            <span className="font-bold" style={{ color: pnlColor(o.pnl) }}>₹{o.pnl}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
