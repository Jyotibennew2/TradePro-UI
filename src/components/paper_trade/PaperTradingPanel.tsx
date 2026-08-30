import { useEffect, useState } from "react";
import { fetchPortfolio, fetchHistory, exitPaperOrder, fetchQuotes } from "../../utils/api";
import { useTheme } from "../../store/themeStore";

/**
 * Generic paper-trading positions/history panel — instrument-agnostic
 * (works for equity orders placed from the scanner AND the existing
 * options paper-trading routes, since backend/paper_trade.py's engine
 * already treats both uniformly). This is the first frontend consumer
 * of fetchPortfolio/fetchHistory/exitPaperOrder.
 *
 * Phase 3: SL/Target on open positions are now checked automatically
 * server-side every ~10s (server.py's monitor_paper_trades scheduler
 * task) and auto-exit when hit — this panel polls on the same ~10s
 * cadence so an auto-exit (SL_HIT/TARGET_HIT) shows up here without
 * needing a manual refresh. Manual "Exit" is still available for
 * closing a position before SL/Target is reached.
 */
export default function PaperTradingPanel() {
  const theme = useTheme();
  const [portfolio, setPortfolio] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    Promise.all([fetchPortfolio(), fetchHistory(20)])
      .then(([p, h]) => { setPortfolio(p.data); setHistory(h.data); setError(null); })
      .catch(() => setError("Failed to load paper trading data"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    refresh();
    const id = setInterval(refresh, 10000);
    return () => clearInterval(id);
  }, []);

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
  const risk = portfolio.risk;
  const dailyLossPct = risk && risk.daily_loss_limit > 0 ? Math.min(100, (risk.session_loss / risk.daily_loss_limit) * 100) : 0;

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

      {risk && (
        <div className="rounded-lg p-2" style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}` }}>
          <div className="flex items-center justify-between text-xs mb-1" style={{ color: theme.text.muted }}>
            <span>Open trades: {portfolio.open_count}/{risk.max_trades}</span>
            <span>Session loss: ₹{risk.session_loss.toLocaleString("en-IN")} / ₹{risk.daily_loss_limit.toLocaleString("en-IN")}</span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: theme.bg.surface }}>
            <div className="h-full rounded-full" style={{ width: `${dailyLossPct}%`, background: dailyLossPct >= 100 ? theme.accent.red : theme.accent.orange }} />
          </div>
        </div>
      )}

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
                {(o.sl > 0 || o.target > 0) && (
                  <> • {o.sl > 0 ? `SL ₹${o.sl}` : ""}{o.sl > 0 && o.target > 0 ? " / " : ""}{o.target > 0 ? `Target ₹${o.target}` : ""}</>
                )}
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
