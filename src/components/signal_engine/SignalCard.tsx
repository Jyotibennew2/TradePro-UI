import React from 'react';

export type SignalType = 'BUY' | 'SELL' | 'HOLD';

export interface Signal {
  symbol: string;
  signal: SignalType;
  confidence: number;
  reason: string;
  price: number;
  timestamp: string;
}

const SIGNAL_COLORS: Record<SignalType, { bg: string; text: string }> = {
  BUY:  { bg: '#dcfce7', text: '#15803d' },
  SELL: { bg: '#fee2e2', text: '#b91c1c' },
  HOLD: { bg: '#fef9c3', text: '#854d0e' },
};

interface SignalCardProps {
  signal: Signal;
  onViewChart?: (symbol: string) => void;
}

export const SignalCard: React.FC<SignalCardProps> = ({ signal, onViewChart }) => {
  const colors = SIGNAL_COLORS[signal.signal];
  return (
    <div
      className="signal-card"
      style={{ borderLeft: `4px solid ${colors.text}`, background: '#fff' }}
    >
      <div className="signal-header">
        <span className="signal-symbol">{signal.symbol}</span>
        <span
          className="signal-badge"
          style={{ background: colors.bg, color: colors.text }}
        >
          {signal.signal}
        </span>
      </div>
      <div className="signal-meta">
        <span>₹{signal.price.toFixed(2)}</span>
        <span className="signal-confidence">
          Confidence: {(signal.confidence * 100).toFixed(0)}%
        </span>
      </div>
      <div className="signal-reason">{signal.reason}</div>
      <div className="signal-footer">
        <span className="signal-time">
          {new Date(signal.timestamp).toLocaleString()}
        </span>
        {onViewChart && (
          <button className="btn-link" onClick={() => onViewChart(signal.symbol)}>
            View Chart →
          </button>
        )}
      </div>
    </div>
  );
};

export const SignalList: React.FC<{ signals: Signal[]; onViewChart?: (s: string) => void }> = ({
  signals,
  onViewChart,
}) => (
  <div className="signal-list">
    {signals.length === 0 && (
      <p className="signal-empty">No signals generated yet. Run the scanner to get started.</p>
    )}
    {signals.map((s) => (
      <SignalCard key={`${s.symbol}-${s.timestamp}`} signal={s} onViewChart={onViewChart} />
    ))}
  </div>
);

export default SignalCard;
