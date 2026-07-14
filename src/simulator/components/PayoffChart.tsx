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

interface Props {
  result     : PayoffResult;
  spot       : number;
  showPerLeg?: boolean;
}

function fmt(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-sm"
      style={{ background: "#060c1a", border: "1px solid #1a3050" }}>
      <div style={{ color: "#8ba0bd" }}>Spot: ₹{fmt(label)}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color }}>
          {p.name}: {p.value >= 0 ? "+" : ""}₹{fmt(p.value)}
        </div>
      ))}
    </div>
  );
}

export default function PayoffChart({ result, spot, showPerLeg = false }: Props) {
  const { combined, perLeg } = result;

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
          { label: "Max Profit", value: combined.maxProfit, color: "#22e894"  },
          { label: "Max Loss",   value: combined.maxLoss,   color: "#ff5577"  },
          { label: "Net Premium",value: result.netPremium,  color: "#3ad4ff"  },
          { label: "ROR %",      value: result.rorPct,      color: "#b98cf9", suffix: "%" },
        ].map(({ label, value, color, suffix = "" }) => (
          <div key={label} className="rounded-lg p-2 text-center"
            style={{ background: "#060c1a", border: "1px solid #1a3050" }}>
            <div className="text-sm mb-1 font-semibold" style={{ color: "#8ba0bd" }}>{label}</div>
            <div className="text-sm font-bold" style={{ color }}>
              {value >= 0 ? "+" : ""}₹{fmt(value)}{suffix}
            </div>
          </div>
        ))}
      </div>

      {/* Breakevens */}
      {combined.breakevens.length > 0 && (
        <div className="flex gap-2 mb-3 flex-wrap items-center">
          <span className="text-sm font-semibold" style={{ color: "#8ba0bd" }}>Breakeven:</span>
          {combined.breakevens.map(be => (
            <span key={be} className="text-sm px-2 py-1 rounded font-bold"
              style={{ background: "#f0a03020", color: "#f0a030" }}>
              ₹{fmt(be)}
            </span>
          ))}
        </div>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="#0f1e36" strokeDasharray="3 3" />

          <XAxis
            dataKey="spot"
            tick={{ fill: "#8ba0bd", fontSize: 12 }}
            tickFormatter={v => (v / 1000).toFixed(1) + "k"}
            axisLine={{ stroke: "#1a3050" }}
            tickLine={false}
          />

          <YAxis
            domain={yDomain}
            tick={{ fill: "#8ba0bd", fontSize: 12 }}
            tickFormatter={v => v >= 0 ? `+${(v/1000).toFixed(1)}k` : `${(v/1000).toFixed(1)}k`}
            axisLine={{ stroke: "#1a3050" }}
            tickLine={false}
            width={48}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Zero line */}
          <ReferenceLine y={0} stroke="#5a7290" strokeDasharray="4 4" />

          {/* Current spot */}
          <ReferenceLine
            x={spot}
            stroke="#f0a030"
            strokeDasharray="4 4"
            label={{ value: "Spot", fill: "#f0a030", fontSize: 12, fontWeight: 700, position: "top" }}
          />

          {/* Breakeven lines */}
          {combined.breakevens.map(be => (
            <ReferenceLine key={be} x={be} stroke="#5a7290" strokeDasharray="2 4" />
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
              <stop offset="5%"  stopColor="#22e894" stopOpacity={0.3} />
              <stop offset="50%" stopColor="#22e894" stopOpacity={0}   />
              <stop offset="50%" stopColor="#ff5577" stopOpacity={0}   />
              <stop offset="95%" stopColor="#ff5577" stopOpacity={0.2} />
            </linearGradient>
          </defs>

          <Area
            type="monotone"
            dataKey="pnl"
            stroke="#3ad4ff"
            strokeWidth={2.5}
            fill="url(#payoffGrad)"
            dot={false}
            name="P&L"
          />

          {showPerLeg && <Legend
            wrapperStyle={{ fontSize: 12, color: "#8ba0bd" }}
          />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
