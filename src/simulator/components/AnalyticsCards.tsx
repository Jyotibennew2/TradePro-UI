/**
 * TradePro Simulator - Compact Analytics Cards
 * Read-only display of already-computed payoff/margin/greeks numbers.
 * Risk:Reward and "Win Zone %" are simple derived figures computed here
 * from those same already-computed numbers — PayoffEngine/MarginEngine
 * themselves are untouched.
 */
import { useTheme } from "../../store/themeStore";

interface Props {
  payoff : { combined: { currentPnl: number; maxProfit: number; maxLoss: number; points: { pnl: number }[] } } | null;
  margin : { totalMargin: number } | null;
  greeks : { netDelta: number; netTheta: number } | null;
  hasLegs: boolean;
}

function fmtPnl(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}₹${Math.round(n).toLocaleString("en-IN")}`;
}

export default function AnalyticsCards({ payoff, margin, greeks, hasLegs }: Props) {
  const theme = useTheme();

  if (!hasLegs) {
    return (
      <div className="text-center py-4 text-sm" style={{ color: theme.text.muted }}>
        Add legs to see live analytics
      </div>
    );
  }

  const combined = payoff?.combined ?? null;
  const rr = combined && combined.maxLoss !== 0 && isFinite(combined.maxLoss)
    ? Math.abs(combined.maxProfit / combined.maxLoss)
    : null;
  const winPct = combined && combined.points.length
    ? Math.round((combined.points.filter(p => p.pnl >= 0).length / combined.points.length) * 100)
    : null;

  const cards: { label: string; value: string; color: string }[] = [
    { label: "P&L",         value: combined ? fmtPnl(combined.currentPnl) : "—", color: (combined?.currentPnl ?? 0) >= 0 ? theme.accent.green : theme.accent.red },
    { label: "Max Profit",  value: combined ? fmtPnl(combined.maxProfit) : "—",  color: theme.accent.green },
    { label: "Max Loss",    value: combined ? fmtPnl(combined.maxLoss) : "—",    color: theme.accent.red },
    { label: "Risk:Reward", value: rr != null ? `1:${rr.toFixed(2)}` : "—",      color: theme.accent.cyan },
    { label: "Win Zone %*", value: winPct != null ? `${winPct}%` : "—",          color: theme.accent.purple },
    { label: "Margin Req.", value: margin ? `₹${margin.totalMargin.toLocaleString("en-IN")}` : "—", color: theme.accent.orange },
    { label: "Net Delta",   value: greeks ? greeks.netDelta.toFixed(1) : "—",  color: theme.text.secondary },
    { label: "Net Theta",   value: greeks ? greeks.netTheta.toFixed(1) : "—",  color: theme.text.secondary },
  ];

  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        {cards.map(c => (
          <div key={c.label} className="rounded-lg p-2 text-center" style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}` }}>
            <div style={{ color: theme.text.muted, fontSize: 10 }}>{c.label}</div>
            <div className="font-black" style={{ color: c.color, fontSize: 13 }}>{c.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-1" style={{ color: theme.text.faint, fontSize: 9 }}>
        *% of the plotted ±10% spot range that is profitable — an indicative read of the payoff shape, not a statistical probability forecast.
      </div>
    </div>
  );
}
