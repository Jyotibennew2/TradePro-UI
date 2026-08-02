import React, { useState } from 'react';

export interface Trade {
  symbol: string;
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  quantity: number;
  direction: string;
  pnl: number;
  pnl_pct: number;
}

export interface BacktestResult {
  symbol: string;
  total_trades: number;
  winning_trades: number;
  win_rate_pct: number;
  total_pnl: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  equity_curve: number[];
  trades: Trade[];
}

interface BacktestConfig {
  symbol: string;
  fromDate: string;
  toDate: string;
  initialCapital: number;
  strategy: string;
}

interface BacktestPanelProps {
  onRunBacktest: (config: BacktestConfig) => Promise<BacktestResult>;
  availableStrategies?: string[];
}

const MetricBox: React.FC<{ label: string; value: string | number; positive?: boolean }> = ({
  label, value, positive,
}) => (
  <div className="metric-box">
    <div className="metric-label">{label}</div>
    <div
      className="metric-value"
      style={positive !== undefined ? { color: positive ? '#22c55e' : '#ef4444' } : undefined}
    >
      {value}
    </div>
  </div>
);

export const BacktestPanel: React.FC<BacktestPanelProps> = ({
  onRunBacktest,
  availableStrategies = ['RSI + MACD', 'EMA Crossover', 'Bollinger Breakout'],
}) => {
  const [config, setConfig] = useState<BacktestConfig>({
    symbol: 'RELIANCE',
    fromDate: '2023-01-01',
    toDate: '2024-12-31',
    initialCapital: 100000,
    strategy: availableStrategies[0],
  });
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await onRunBacktest(config);
      setResult(res);
    } catch (e: any) {
      setError(e.message || 'Backtest failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="backtest-panel">
      <h2 className="backtest-title">Backtest Engine</h2>

      {/* Config Form */}
      <div className="backtest-config">
        <div className="field-group">
          <label>Symbol</label>
          <input
            value={config.symbol}
            onChange={(e) => setConfig({ ...config, symbol: e.target.value.toUpperCase() })}
          />
        </div>
        <div className="field-group">
          <label>Strategy</label>
          <select
            value={config.strategy}
            onChange={(e) => setConfig({ ...config, strategy: e.target.value })}
          >
            {availableStrategies.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="field-group">
          <label>From</label>
          <input
            type="date" value={config.fromDate}
            onChange={(e) => setConfig({ ...config, fromDate: e.target.value })}
          />
        </div>
        <div className="field-group">
          <label>To</label>
          <input
            type="date" value={config.toDate}
            onChange={(e) => setConfig({ ...config, toDate: e.target.value })}
          />
        </div>
        <div className="field-group">
          <label>Capital (₹)</label>
          <input
            type="number" step={10000}
            value={config.initialCapital}
            onChange={(e) => setConfig({ ...config, initialCapital: +e.target.value })}
          />
        </div>
      </div>

      <button className="btn-run-backtest" onClick={handleRun} disabled={loading}>
        {loading ? 'Running…' : '▶ Run Backtest'}
      </button>

      {error && <div className="backtest-error">{error}</div>}

      {/* Results */}
      {result && (
        <div className="backtest-results">
          <h3>Results — {result.symbol}</h3>
          <div className="metrics-grid">
            <MetricBox label="Total Trades" value={result.total_trades} />
            <MetricBox
              label="Win Rate"
              value={`${result.win_rate_pct}%`}
              positive={result.win_rate_pct >= 50}
            />
            <MetricBox
              label="Total P&L"
              value={`₹${result.total_pnl.toLocaleString()}`}
              positive={result.total_pnl >= 0}
            />
            <MetricBox
              label="Max Drawdown"
              value={`${result.max_drawdown_pct}%`}
              positive={false}
            />
            <MetricBox
              label="Sharpe Ratio"
              value={result.sharpe_ratio}
              positive={result.sharpe_ratio >= 1}
            />
          </div>

          {/* Trade Log */}
          <h4>Trade Log</h4>
          <table className="trade-log">
            <thead>
              <tr>
                <th>Entry</th><th>Exit</th><th>Entry ₹</th>
                <th>Exit ₹</th><th>Qty</th><th>P&L</th><th>P&L %</th>
              </tr>
            </thead>
            <tbody>
              {result.trades.map((t, i) => (
                <tr key={i}>
                  <td>{t.entry_date}</td>
                  <td>{t.exit_date}</td>
                  <td>{t.entry_price.toFixed(2)}</td>
                  <td>{t.exit_price.toFixed(2)}</td>
                  <td>{t.quantity.toFixed(2)}</td>
                  <td style={{ color: t.pnl >= 0 ? '#22c55e' : '#ef4444' }}>
                    {t.pnl >= 0 ? '+' : ''}₹{t.pnl.toFixed(2)}
                  </td>
                  <td style={{ color: t.pnl_pct >= 0 ? '#22c55e' : '#ef4444' }}>
                    {t.pnl_pct >= 0 ? '+' : ''}{t.pnl_pct.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BacktestPanel;
