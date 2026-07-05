/**
 * TradePro Simulator - Interactive Payoff Simulator
 * Live/Expiry/Custom date payoff with sliders.
 */

import { useState, useMemo, useCallback } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { PricingEngine }      from "../pricing/PricingEngine";
import { ProbabilityEngine }  from "../pricing/ProbabilityEngine";
import { buildPayoffCurve }   from "../pricing/PayoffEngine";
import { spotRange, daysToYears, bsPrice } from "../pricing/BlackScholes";
import type { OptionLeg }     from "../models/Option";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  legs       : OptionLeg[];
  spot       : number;
  iv         : number;
  daysToExpiry: number;
  r          : number;
}

type ViewMode = "expiry" | "today" | "custom";

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs"
      style={{ background: "#060c1a", border: "1px solid #0f1e36" }}>
      <div style={{ color: "#445566" }}>₹{Number(label).toLocaleString("en-IN")}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color }}>
          {p.name}: {p.value >= 0 ? "+" : ""}₹{Math.round(p.value).toLocaleString("en-IN")}
        </div>
      ))}
    </div>
  );
}

// ─── Slider ───────────────────────────────────────────────────────────────────

function Slider({ label, value, min, max, step, onChange, color = "#00c8f0", format }: {
  label: string; value: number; min: number; max: number;
  step: number; onChange: (v: number) => void;
  color?: string; format?: (v: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span style={{ color: "#445566" }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>
          {format ? format(value) : value}
        </span>
      </div>
      <div className="relative h-4 flex items-center">
        <div className="w-full h-1 rounded-full" style={{ background: "#0f1e36" }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
        </div>
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute w-full opacity-0 cursor-pointer h-4"
        />
      </div>
      <div className="flex justify-between text-xs" style={{ color: "#334455" }}>
        <span>{format ? format(min) : min}</span>
        <span>{format ? format(max) : max}</span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PayoffSimulator({ legs, spot, iv, daysToExpiry, r }: Props) {
  const [viewMode,   setViewMode]   = useState<ViewMode>("expiry");
  const [customDays, setCustomDays] = useState(Math.floor(daysToExpiry / 2));
  const [spotShift,  setSpotShift]  = useState(0);      // % shift
  const [ivShift,    setIvShift]    = useState(0);       // % points shift
  const [rShift,     setRShift]     = useState(0);       // % points shift
  const [showToday,  setShowToday]  = useState(true);
  const [showExpiry, setShowExpiry] = useState(true);

  if (!legs.length) {
    return (
      <div className="text-center py-10" style={{ color: "#445566" }}>
        <div className="text-3xl mb-2">📊</div>
        <div className="text-sm">Add legs to see payoff simulator</div>
      </div>
    );
  }

  // Adjusted params
  const adjSpot = spot * (1 + spotShift / 100);
  const adjIV   = Math.max(iv + ivShift, 0.5);
  const adjR    = Math.max(r * 100 + rShift, 0) / 100;

  const daysForView =
    viewMode === "expiry" ? daysToExpiry :
    viewMode === "today"  ? 0 :
    customDays;

  // Chart data
  const chartData = useMemo(() => {
    if (!spot || !legs.length) return [];
    const spots  = spotRange(adjSpot, 0.12, 100);
    const T_exp  = 0;
    const T_view = daysToYears(daysForView);
    const T_today= 0;

    return spots.map(s => {
      const expiryPnl = legs.reduce((sum, leg) => {
        const iv_   = Math.max(leg.iv + ivShift, 0.5) / 100;
        const price = Math.max(
          leg.contract.optionType === "CE" ? s - leg.contract.strike : leg.contract.strike - s,
          0
        );
        const m = leg.action === "BUY" ? 1 : -1;
        return sum + m * (price - leg.entryPrice) * leg.lots * leg.contract.lotSize;
      }, 0);

      const viewPnl = daysForView === 0 ? expiryPnl : legs.reduce((sum, leg) => {
        const iv_   = Math.max(leg.iv + ivShift, 0.5) / 100;
        const price = T_view > 0
          ? bsPrice(s, leg.contract.strike, T_view, adjR, iv_, leg.contract.optionType)
          : Math.max(
              leg.contract.optionType === "CE" ? s - leg.contract.strike : leg.contract.strike - s,
              0
            );
        const m = leg.action === "BUY" ? 1 : -1;
        return sum + m * (price - leg.entryPrice) * leg.lots * leg.contract.lotSize;
      }, 0);

      const todayPnl = legs.reduce((sum, leg) => {
        const iv_  = Math.max(leg.iv + ivShift, 0.5) / 100;
        const T_t  = daysToYears(daysToExpiry);
        const price= T_t > 0
          ? bsPrice(s, leg.contract.strike, T_t, adjR, iv_, leg.contract.optionType)
          : Math.max(
              leg.contract.optionType === "CE" ? s - leg.contract.strike : leg.contract.strike - s,
              0
            );
        const m = leg.action === "BUY" ? 1 : -1;
        return sum + m * (price - leg.entryPrice) * leg.lots * leg.contract.lotSize;
      }, 0);

      return {
        spot   : Math.round(s),
        expiry : Math.round(expiryPnl),
        view   : Math.round(viewPnl),
        today  : Math.round(todayPnl),
      };
    });
  }, [legs, adjSpot, adjIV, adjR, daysForView, ivShift, spotShift]);

  // Stats
  const stats = useMemo(() => {
    if (!chartData.length) return null;
    const expPnls  = chartData.map(d => d.expiry);
    const maxProfit= Math.max(...expPnls);
    const maxLoss  = Math.min(...expPnls);

    // Breakevens
    const breakevens: number[] = [];
    for (let i = 1; i < chartData.length; i++) {
      if (chartData[i-1].expiry * chartData[i].expiry < 0) {
        const be = chartData[i-1].spot +
          (0 - chartData[i-1].expiry) *
          (chartData[i].spot - chartData[i-1].spot) /
          (chartData[i].expiry - chartData[i-1].expiry);
        breakevens.push(Math.round(be));
      }
    }

    const prob = ProbabilityEngine.analyze(
      adjSpot, breakevens, maxProfit, maxLoss, daysToExpiry, adjIV, adjR
    );

    return { maxProfit, maxLoss, breakevens, prob };
  }, [chartData, adjSpot, adjIV, adjR, daysToExpiry]);

  // Time scenarios
  const scenarios = useMemo(() => {
    return ProbabilityEngine.timeScenarios(
      legs.map(l => ({
        strike    : l.contract.strike,
        optionType: l.contract.optionType,
        action    : l.action,
        lots      : l.lots,
        lotSize   : l.contract.lotSize,
        entryPrice: l.entryPrice,
        iv        : Math.max(l.iv + ivShift, 0.5),
      })),
      adjSpot, adjR, daysToExpiry
    );
  }, [legs, adjSpot, adjR, daysToExpiry, ivShift]);

  const fmt = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 100000) return `${(n/100000).toFixed(1)}L`;
    if (abs >= 1000)   return `${(n/1000).toFixed(1)}k`;
    return n.toString();
  };

  const yDomain = stats ? [
    Math.floor(stats.maxLoss   * 1.2 / 1000) * 1000,
    Math.ceil (stats.maxProfit * 1.2 / 1000) * 1000,
  ] : [-10000, 10000];

  return (
    <div className="space-y-4">
      {/* View mode selector */}
      <div className="flex gap-1 flex-wrap">
        {([
          { id: "expiry", label: "At Expiry" },
          { id: "today",  label: "Today"     },
          { id: "custom", label: "Custom"    },
        ] as const).map(({ id, label }) => (
          <button key={id} onClick={() => setViewMode(id)}
            className="px-3 py-1 rounded-lg text-xs font-bold"
            style={{
              background: viewMode === id ? "#00c8f0" : "#090f1e",
              color     : viewMode === id ? "#03050d" : "#445566",
              border    : "1px solid #0f1e36",
            }}>
            {label}
          </button>
        ))}
        {viewMode === "custom" && (
          <span className="text-xs px-2 py-1 rounded-lg"
            style={{ background: "#090f1e", color: "#00c8f0", border: "1px solid #0f1e36" }}>
            T-{customDays} days
          </span>
        )}
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Max Profit",  value: `+₹${fmt(stats.maxProfit)}`, color: "#00d97e" },
            { label: "Max Loss",    value: `-₹${fmt(Math.abs(stats.maxLoss))}`, color: "#f03060" },
            { label: "P.O.P.",      value: `${stats.prob.pop}%`,         color: "#00c8f0" },
            { label: "Risk:Reward", value: `${stats.prob.riskReward}x`,  color: "#9b5cf6" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl p-3 text-center"
              style={{ background: "#090f1e", border: "1px solid #0f1e36" }}>
              <div className="text-xs mb-0.5" style={{ color: "#445566" }}>{label}</div>
              <div className="text-sm font-black" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="rounded-xl p-3"
        style={{ background: "#090f1e", border: "1px solid #0f1e36" }}>
        <div className="flex gap-3 mb-2 text-xs">
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={showExpiry} onChange={e => setShowExpiry(e.target.checked)} />
            <span style={{ color: "#00c8f0" }}>At Expiry</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={showToday} onChange={e => setShowToday(e.target.checked)} />
            <span style={{ color: "#f0a030" }}>Today</span>
          </label>
        </div>

        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#0f1e36" strokeDasharray="3 3" />
            <XAxis dataKey="spot" tick={{ fill: "#445566", fontSize: 9 }}
              tickFormatter={v => (v/1000).toFixed(1)+"k"} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#445566", fontSize: 9 }}
              tickFormatter={v => fmt(v)} axisLine={false} tickLine={false} width={36} domain={yDomain} />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine y={0}    stroke="#334455" strokeDasharray="4 4" />
            <ReferenceLine x={Math.round(adjSpot)} stroke="#f0a030" strokeDasharray="4 4"
              label={{ value: "Spot", fill: "#f0a030", fontSize: 9, position: "top" }} />
            {stats?.breakevens.map(be => (
              <ReferenceLine key={be} x={be} stroke="#445566" strokeDasharray="2 4" />
            ))}
            {showToday && (
              <Line type="monotone" dataKey="today" stroke="#f0a030"
                strokeWidth={1.5} dot={false} strokeDasharray="6 3" name="Today" />
            )}
            {viewMode === "custom" && (
              <Line type="monotone" dataKey="view" stroke="#9b5cf6"
                strokeWidth={1.5} dot={false} name={`T-${customDays}`} />
            )}
            {showExpiry && (
              <>
                <defs>
                  <linearGradient id="simGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#00c8f0" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f03060" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="expiry" stroke="#00c8f0"
                  strokeWidth={2} fill="url(#simGrad)" dot={false} name="At Expiry" />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Sliders */}
      <div className="rounded-xl p-3 space-y-4"
        style={{ background: "#090f1e", border: "1px solid #0f1e36" }}>
        <div className="text-xs font-bold" style={{ color: "#445566" }}>SCENARIO SLIDERS</div>

        <Slider label="Spot Price Shift" value={spotShift}
          min={-15} max={15} step={0.5} onChange={setSpotShift}
          color="#00c8f0"
          format={v => `${v > 0 ? "+" : ""}${v}% (₹${Math.round(adjSpot).toLocaleString("en-IN")})`}
        />

        <Slider label="IV Shift" value={ivShift}
          min={-10} max={10} step={0.5} onChange={setIvShift}
          color="#9b5cf6"
          format={v => `${v > 0 ? "+" : ""}${v}% → ${adjIV.toFixed(1)}%`}
        />

        {viewMode === "custom" && (
          <Slider label="Days to Expiry" value={customDays}
            min={0} max={daysToExpiry} step={1} onChange={setCustomDays}
            color="#f0a030"
            format={v => `${v}d left`}
          />
        )}

        <Slider label="Interest Rate Shift" value={rShift}
          min={-3} max={3} step={0.1} onChange={setRShift}
          color="#445566"
          format={v => `${v > 0 ? "+" : ""}${v}% → ${(r * 100 + rShift).toFixed(1)}%`}
        />
      </div>

      {/* Breakevens */}
      {stats && stats.breakevens.length > 0 && (
        <div className="rounded-xl p-3"
          style={{ background: "#090f1e", border: "1px solid #0f1e36" }}>
          <div className="text-xs mb-2" style={{ color: "#445566" }}>BREAKEVENS</div>
          <div className="flex gap-2 flex-wrap">
            {stats.breakevens.map((be, i) => (
              <div key={i} className="px-3 py-1 rounded-lg text-xs font-bold"
                style={{ background: "#f0a03020", color: "#f0a030", border: "1px solid #f0a03040" }}>
                ₹{be.toLocaleString("en-IN")}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Probability */}
      {stats && (
        <div className="rounded-xl p-3"
          style={{ background: "#090f1e", border: "1px solid #0f1e36" }}>
          <div className="text-xs mb-3" style={{ color: "#445566" }}>PROBABILITY ANALYSIS</div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
            {[
              { label: "P.O.P",    value: `${stats.prob.pop}%`,  color: "#00d97e" },
              { label: "Max Profit%", value: `${stats.prob.poc}%`, color: "#00c8f0" },
              { label: "Max Loss%", value: `${stats.prob.pol}%`,  color: "#f03060" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-lg p-2"
                style={{ background: "#060c1a" }}>
                <div style={{ color: "#334455" }}>{label}</div>
                <div className="font-bold mt-0.5" style={{ color }}>{value}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { label: "Expected Value", value: `₹${stats.prob.expectedValue.toLocaleString("en-IN")}`, color: stats.prob.expectedValue >= 0 ? "#00d97e" : "#f03060" },
              { label: "Edge",           value: `${stats.prob.edge > 0 ? "+" : ""}${stats.prob.edge}%`, color: stats.prob.edge >= 0 ? "#00d97e" : "#f03060" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-lg p-2 text-center"
                style={{ background: "#060c1a" }}>
                <div style={{ color: "#334455" }}>{label}</div>
                <div className="font-bold mt-0.5" style={{ color }}>{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-xs text-center" style={{ color: "#334455" }}>
            Confidence: <span style={{ color: stats.prob.confidence === "HIGH" ? "#00d97e" : stats.prob.confidence === "MEDIUM" ? "#f0a030" : "#f03060" }}>
              {stats.prob.confidence}
            </span>
          </div>
        </div>
      )}

      {/* Time scenarios */}
      <div className="rounded-xl p-3"
        style={{ background: "#090f1e", border: "1px solid #0f1e36" }}>
        <div className="text-xs mb-3" style={{ color: "#445566" }}>TIME DECAY SCENARIOS</div>
        <div className="space-y-1">
          {scenarios.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b text-xs"
              style={{ borderColor: "#0f1e3640" }}>
              <span style={{ color: "#c0d0e8" }}>{s.label}</span>
              <span style={{ color: "#445566" }}>{s.daysLeft}d left</span>
              <span style={{ color: s.pnl >= 0 ? "#00d97e" : "#f03060", fontWeight: 700 }}>
                {s.pnl >= 0 ? "+" : ""}₹{Math.abs(s.pnl).toLocaleString("en-IN")}
              </span>
              <span style={{ color: s.pnlPct >= 0 ? "#00d97e" : "#f03060" }}>
                ({s.pnlPct >= 0 ? "+" : ""}{s.pnlPct}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
