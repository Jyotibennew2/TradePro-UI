import React from 'react';
import { useTheme } from '../../store/themeStore';

export type SignalType = 'BUY' | 'SELL' | 'HOLD';

export interface Signal {
  symbol: string;
  signal: SignalType;
  confidence: number;
  reason: string;
  price: number;
  timestamp: string;
}

interface SignalCardProps {
  signal: Signal;
  onViewChart?: (symbol: string) => void;
  /** Optional — when provided, shows a "Paper Trade" button (hidden for HOLD signals). */
  onPaperTrade?: (signal: Signal) => void;
}

export const SignalCard: React.FC<SignalCardProps> = ({ signal, onViewChart, onPaperTrade }) => {
  const theme = useTheme();
  const colors: Record<SignalType, string> = {
    BUY : theme.accent.green,
    SELL: theme.accent.red,
    HOLD: theme.accent.orange,
  };
  const color = colors[signal.signal];

  return (
    <div
      className="rounded-xl p-3 mb-2"
      style={{ borderLeft: `3px solid ${color}`, background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}`, borderLeftWidth: 3, borderLeftColor: color }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-bold" style={{ color: theme.text.primary }}>{signal.symbol}</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded"
          style={{ background: color + '20', color }}>
          {signal.signal}
        </span>
      </div>
      <div className="flex items-center gap-3 text-sm mb-1" style={{ color: theme.text.secondary }}>
        <span>₹{signal.price.toFixed(2)}</span>
        <span style={{ color: theme.text.muted }}>
          Confidence: {(signal.confidence * 100).toFixed(0)}%
        </span>
      </div>
      <div className="text-xs mb-2" style={{ color: theme.text.faint }}>{signal.reason}</div>
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: theme.text.faint }}>
          {new Date(signal.timestamp).toLocaleString()}
        </span>
        <div className="flex items-center gap-3">
          {onPaperTrade && signal.signal !== 'HOLD' && (
            <button className="text-xs font-bold" style={{ color }}
              onClick={() => onPaperTrade(signal)}>
              📝 Paper Trade
            </button>
          )}
          {onViewChart && (
            <button className="text-xs font-bold" style={{ color: theme.accent.cyan }}
              onClick={() => onViewChart(signal.symbol)}>
              View Chart →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const SignalList: React.FC<{ signals: Signal[]; onViewChart?: (s: string) => void; onPaperTrade?: (signal: Signal) => void }> = ({
  signals,
  onViewChart,
  onPaperTrade,
}) => {
  const theme = useTheme();
  return (
    <div>
      {signals.length === 0 && (
        <p className="text-sm text-center py-8" style={{ color: theme.text.muted }}>
          No signals generated yet. Run the scanner to get started.
        </p>
      )}
      {signals.map((s) => (
        <SignalCard key={`${s.symbol}-${s.timestamp}`} signal={s} onViewChart={onViewChart} onPaperTrade={onPaperTrade} />
      ))}
    </div>
  );
};

export default SignalCard;
