import EquityScannerPanel from "../components/equity_scanner/EquityScannerPanel";
import { runEquityQuantScan } from "../utils/equityQuantScanner";
import Card from "../components/ui/Card";

export default function EquityScanner() {
  return (
    <div className="p-4">
      <Card title="Quant Swing Scanner">
        <p className="text-sm mb-3" style={{ opacity: 0.7 }}>
          Client-side EMA/RSI/MACD/ATR composite score (0-100), explainable per symbol.
          Uses daily candles from the existing historical data feed.
        </p>
        <EquityScannerPanel onScan={runEquityQuantScan} />
      </Card>
    </div>
  );
}
