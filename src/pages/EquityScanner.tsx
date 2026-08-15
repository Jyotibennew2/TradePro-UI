import EquityScannerPanel from "../components/equity_scanner/EquityScannerPanel";
import { runEquityQuantScan } from "../utils/equityQuantScanner";
import Card from "../components/ui/Card";
import { useTheme } from "../store/themeStore";

export default function EquityScanner() {
  const theme = useTheme();
  return (
    <div className="p-4">
      <Card title="Quant Swing Scanner">
        <p className="text-sm mb-4" style={{ color: theme.text.muted }}>
          Client-side EMA / RSI / MACD / ATR composite score (0-100), explainable per symbol.
          Uses daily candles from the existing historical data feed.
        </p>
        <EquityScannerPanel onScan={runEquityQuantScan} />
      </Card>
    </div>
  );
}
