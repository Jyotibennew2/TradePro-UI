import { useState } from "react";
import EquityScannerPanel from "../components/equity_scanner/EquityScannerPanel";
import { runEquityQuantScan } from "../utils/equityQuantScanner";
import { toFyersSymbol } from "../utils/equityQuantScanner";
import { placePaperOrder } from "../utils/api";
import type { Signal } from "../components/signal_engine/SignalCard";
import PaperTradingPanel from "../components/paper_trade/PaperTradingPanel";
import Card from "../components/ui/Card";
import { useTheme } from "../store/themeStore";

export default function EquityScanner() {
  const theme = useTheme();
  const [panelRefreshKey, setPanelRefreshKey] = useState(0);

  const handlePaperTrade = async (signal: Signal) => {
    const qtyStr = window.prompt(`Paper trade ${signal.symbol} (${signal.signal}) — quantity (shares):`, "1");
    if (!qtyStr) return;
    const qty = parseInt(qtyStr, 10);
    if (isNaN(qty) || qty <= 0) { window.alert("Enter a valid quantity"); return; }

    const slPctStr = window.prompt("Stop loss % from entry (0 = no SL, monitored manually — see Paper Trading panel):", "2");
    const tgtPctStr = window.prompt("Target % from entry (0 = no target):", "4");
    const slPct  = slPctStr  ? Number(slPctStr)  : 0;
    const tgtPct = tgtPctStr ? Number(tgtPctStr) : 0;

    const entryPrice = signal.price;
    const isBuy = signal.signal === "BUY";
    const sl     = slPct  > 0 ? +(entryPrice * (1 - (isBuy ? slPct  : -slPct)  / 100)).toFixed(2) : 0;
    const target = tgtPct > 0 ? +(entryPrice * (1 + (isBuy ? tgtPct : -tgtPct) / 100)).toFixed(2) : 0;

    try {
      const res = await placePaperOrder({
        symbol      : toFyersSymbol(signal.symbol),
        option_type : "EQ",
        strike      : 0,
        expiry      : "",
        action      : signal.signal,
        qty,
        entry_price : entryPrice,
        sl,
        target,
      });
      if (res.success) {
        window.alert(`Paper order placed: ${signal.signal} ${qty} ${signal.symbol} @ ₹${entryPrice}`);
        setPanelRefreshKey(k => k + 1);
      } else {
        window.alert(`Order failed: ${res.error || "unknown error"}`);
      }
    } catch {
      window.alert("Order failed — check backend connectivity.");
    }
  };

  return (
    <div className="p-4 space-y-4">
      <Card title="Quant Swing Scanner">
        <p className="text-sm mb-4" style={{ color: theme.text.muted }}>
          Client-side EMA / RSI / MACD / ATR composite score (0-100), explainable per symbol.
          Uses daily candles from the existing historical data feed.
        </p>
        <EquityScannerPanel onScan={runEquityQuantScan} onPaperTrade={handlePaperTrade} />
      </Card>

      <Card title="Paper Trading">
        <PaperTradingPanel key={panelRefreshKey} />
      </Card>
    </div>
  );
}
