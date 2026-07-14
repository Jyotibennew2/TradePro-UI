/**
 * TradePro Simulator - Payoff Chart Component
 * Interactive payoff diagram using Recharts.
 */

import {
  ComposedChart, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, Legend,
} from "recharts";
import type { PayoffResult } from "../models/Payoff";
import { useTheme } from "../../store/themeStore";

interface Props {
  result     : PayoffResult;
  spot       : number;
  showPerLeg?: boolean;
}

function fmt(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default function PayoffChart({ result, spot, showPerLeg = false }: Props) {
  const theme = useTheme();
  const { combined, perLeg } = result;

  function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg px-3 py-2 text-sm"
        style={{ background: theme.bg.surface, border: `1px solid ${theme.border.strong}` }}>
        <div style={{ color: theme.text.muted }}>Spot: ₹{fmt(label)}</div>
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ color: p.color }}>
            {p.name}: {p.value >= 0 ? "+" : ""}₹{fmt(p.value)}
          </div>
        ))}
      </div>
    );
  }

  // Merge combined + per-leg data
  const chartData = combined.points.map((pt, i) => {
    const row: Record<string, number> = { spot: pt.spot, pnl: pt.pnl };
    if (showPerLeg) {
      perLeg.forEach((lp, j) => {
        row[`leg${j + 1}`] = lp.points[i]?.pnl ?? 0;
      });
    }
    return row;
  });

  const maxAbs = Math.max(Math.abs(combined.maxProfit), Math.abs(combined.maxLoss), 1);
  const yDomain: [number, number] = [
    Math.floor(-maxAbs * 1.1 / 1000) * 1000,
    Math.ceil(maxAbs  * 1.1 / 1000) * 1000,
  ];

  return (
    <div>
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {[
          { label: "Max Profit", value: combined.maxProfit, color: theme.accent.green  },
          { label: "Max Loss",   value: combined.maxLoss,   color: theme.accent.red  },
          { label: "Net Premium",value: result.netPremium,  color: theme.accent.cyan  },
          { label: "ROR %",      value: result.rorPct,      color: theme.accent.purple, suffix: "%" },
        ].map(({ label, value, color, suffix = "" }) => (
          <div key={label} className="rounded-lg p-2 text-center"
            style={{ background: theme.bg.surface, border: `1px solid ${theme.border.strong}` }}>
            <div className="text-sm mb-1 font-semibold" style={{ color: theme.text.muted }}>{label}</div>
            <div className="text-sm font-bold" style={{ color }}>
              {value >= 0 ? "+" : ""}₹{fmt(value)}{suffix}
            </div>
          </div>
        ))}
      </div>

      {/* Breakevens */}
      {combined.breakevens.length > 0 && (
        <div className="flex gap-2 mb-3 flex-wrap items-center">
          <span className="text-sm font-semibold" style={{ color: theme.text.muted }}>Breakeven:</span>
          {combined.breakevens.map(be => (
            <span key={be} className="text-sm px-2 py-1 rounded font-bold"
              style={{ background: theme.accent.orange + "20", color: theme.accent.orange }}>
              ₹{fmt(be)}
            </span>
          ))}
        </div>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <CartesianGrid stroke={theme.border.subtle} strokeDasharray="3 3" />

          <XAxis
            dataKey="spot"
            tick={{ fill: theme.text.muted, fontSize: 12 }}
            tickFormatter={v => (v / 1000).toFixed(1) + "k"}
            axisLine={{ stroke: theme.border.strong }}
            tickLine={false}
          />

          <YAxis
            domain={yDomain}
            tick={{ fill: theme.text.muted, fontSize: 12 }}
            tickFormatter={v => v >= 0 ? `+${(v/1000).toFixed(1)}k` : `${(v/1000).toFixed(1)}k`}
            axisLine={{ stroke: theme.border.strong }}
            tickLine={false}
            width={48}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Zero line */}
          <ReferenceLine y={0} stroke={theme.text.faint} strokeDasharray="4 4" />

          {/* Current spot */}
          <ReferenceLine
            x={spot}
            stroke={theme.accent.orange}
            strokeDasharray="4 4"
            label={{ value: "Spot", fill: theme.accent.orange, fontSize: 12, fontWeight: 700, position: "top" }}
          />

          {/* Breakeven lines */}
          {combined.breakevens.map(be => (
            <ReferenceLine key={be} x={be} stroke={theme.text.faint} strokeDasharray="2 4" />
          ))}

          {/* Per-leg lines */}
          {showPerLeg && perLeg.map((lp, j) => (
            <Line
              key={j}
              type="monotone"
              dataKey={`leg${j + 1}`}
              stroke={lp.color}
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="4 4"
              name={`Leg ${j + 1}`}
            />
          ))}

          {/* Combined payoff area */}
          <defs>
            <linearGradient id="payoffGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={theme.accent.green} stopOpacity={0.3} />
              <stop offset="50%" stopColor={theme.accent.green} stopOpacity={0}   />
              <stop offset="50%" stopColor={theme.accent.red} stopOpacity={0}   />
              <stop offset="95%" stopColor={theme.accent.red} stopOpacity={0.2} />
            </linearGradient>
          </defs>

          <Area
            type="monotone"
            dataKey="pnl"
            stroke={theme.accent.cyan}
            strokeWidth={2.5}
            fill="url(#payoffGrad)"
            dot={false}
            name="P&L"
          />

          {showPerLeg && <Legend
            wrapperStyle={{ fontSize: 12, color: theme.text.muted }}
          />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
