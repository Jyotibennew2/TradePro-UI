import React, { useEffect, useState } from 'react';

export interface Position {
  symbol: string;
  quantity: number;
  avg_buy_price: number;
  current_price: number;
  invested: number;
  current_value: number;
  unrealised_pnl: number;
  pnl_pct: number;
  last_updated: string;
}

export interface PortfolioSummary {
  total_invested: number;
  total_value: number;
  total_pnl: number;
  total_pnl_pct: number;
}

export interface PortfolioSnapshot {
  positions: Position[];
  summary: PortfolioSummary;
  as_of: string;
}

interface LivePortfolioDashboardProps {
  wsUrl?: string;
  refreshIntervalMs?: number;
}

const PnlCell: React.FC<{ value: number; suffix?: string }> = ({ value, suffix = '' }) => (
  <span style={{ color: value >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
    {value >= 0 ? '+' : ''}{value.toFixed(2)}{suffix}
  </span>
);

export const LivePortfolioDashboard: React.FC<LivePortfolioDashboardProps> = ({
  wsUrl,
  refreshIntervalMs: _refreshIntervalMs = 5000,
}) => {
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!wsUrl) return;
    const ws = new WebSocket(wsUrl);
    ws.onopen  = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (e) => {
      try { setSnapshot(JSON.parse(e.data)); } catch {}
    };
    return () => ws.close();
  }, [wsUrl]);

  if (!snapshot) {
    return (
      <div className="portfolio-empty">
        No portfolio data. Connect a WebSocket or add positions.
      </div>
    );
  }

  const { positions, summary } = snapshot;

  return (
    <div className="live-portfolio">
      <div className="portfolio-summary">
        <div className="summary-item">
          <label>Invested</label>
          <span>₹{summary.total_invested.toLocaleString()}</span>
        </div>
        <div className="summary-item">
          <label>Current Value</label>
          <span>₹{summary.total_value.toLocaleString()}</span>
        </div>
        <div className="summary-item">
          <label>Total P&amp;L</label>
          <PnlCell value={summary.total_pnl} />
        </div>
        <div className="summary-item">
          <label>Return</label>
          <PnlCell value={summary.total_pnl_pct} suffix="%" />
        </div>
        <div className="summary-status">
          <span className={`ws-dot ${connected ? 'ws-dot--live' : 'ws-dot--offline'}`} />
          {connected ? 'Live' : 'Offline'}
        </div>
      </div>

      <table className="positions-table">
        <thead>
          <tr>
            <th>Symbol</th><th>Qty</th><th>Avg Buy</th>
            <th>LTP</th><th>Invested</th><th>Value</th>
            <th>P&amp;L</th><th>P&amp;L %</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => (
            <tr key={p.symbol}>
              <td><strong>{p.symbol}</strong></td>
              <td>{p.quantity}</td>
              <td>₹{p.avg_buy_price.toFixed(2)}</td>
              <td>₹{p.current_price.toFixed(2)}</td>
              <td>₹{p.invested.toLocaleString()}</td>
              <td>₹{p.current_value.toLocaleString()}</td>
              <td><PnlCell value={p.unrealised_pnl} /></td>
              <td><PnlCell value={p.pnl_pct} suffix="%" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default LivePortfolioDashboard;
