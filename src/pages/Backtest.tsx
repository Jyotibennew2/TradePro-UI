import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { runBacktest } from "../utils/api";
import Card from "../components/ui/Card";
import Loader from "../components/ui/Loader";
import ErrorBox from "../components/ui/ErrorBox";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

const STRATEGIES = [
  { key: "straddle",   label: "Short Straddle"  },
  { key: "strangle",   label: "Short Strangle"  },
  { key: "ironCondor", label: "Iron Condor"      },
  { key: "longCall",   label: "Long Call"        },
  { key: "longPut",    label: "Long Put"         },
];

function StatBox({ label, value, color = "#c0d0e8" }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl p-3 text-center"
      style={{ background: "#090f1e", border: "1px solid #0f1e36" }}>
      <div className="text-xs mb-1" style={{ color: "#445566" }}>{label}</div>
      <div className="text-sm font-black" style={{ color }}>{value}</div>
    </div>
  );
}

export default function Backtest() {
  const [strategy, setStrategy] = useState("ironCondor");
  const [days,     setDays]     = useState(90);
  const [slPct,    setSlPct]    = useState(50);
  const [tgtPct,   setTgtPct]   = useState(50);
  const [lotSize,  setLotSize]  = useState(50);

  const { mutate, data, isPending, isError } = useMutation({
    mutationFn: () => runBacktest({ strategy, days, sl_pct: slPct, tgt_pct: tgtPct, lot_size: lotSize }),
  });

  const s = data?.summary;
  const fmt = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;

  return (
    <div className="p-4 space-y-4">
      {/* Config */}
      <Card title="Backtest Configuration">
        <div className="space-y-3">
          {/* Strategy */}
          <div>
            <div className="text-xs mb-1" style={{ color: "#334455" }}>Strategy</div>
            <div className="flex flex-wrap gap-1">
              {STRATEGIES.map(st => (
                <button key={st.key} onClick={() => setStrategy(st.key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold"
                  style={{
                    background: strategy === st.key ? "#00c8f0" : "#090f1e",
                    color     : strategy === st.key ? "#03050d" : "#445566",
                    border    : "1px solid #0f1e36",
                  }}>
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Params */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Days",         value: days,    setter: setDays,    min: 10,  max: 365 },
              { label: "SL %",         value: slPct,   setter: setSlPct,   min: 10,  max: 200 },
              { label: "Target %",     value: tgtPct,  setter: setTgtPct,  min: 10,  max: 200 },
              { label: "Lot Size",     value: lotSize, setter: setLotSize, min: 1,   max: 500 },
            ].map(({ label, value, setter, min, max }) => (
              <div key={label}>
                <div className="text-xs mb-1" style={{ color: "#334455" }}>{label}: <span style={{ color: "#00c8f0" }}>{value}</span></div>
                <input type="range" min={min} max={max} value={value}
                  onChange={e => setter(Number(e.target.value))}
                  className="w-full" />
              </div>
            ))}
          </div>

          <button onClick={() => mutate()}
            disabled={isPending}
            className="w-full py-2.5 rounded-xl text-sm font-black"
            style={{
              background: "#00c8f0",
              color     : "#03050d",
              opacity   : isPending ? 0.7 : 1,
            }}>
            {isPending ? "Running Backtest..." : "▶ Run Backtest"}
          </button>
        </div>
      </Card>

      {isPending && <Loader text="Running backtest simulation..." />}
      {isError   && <ErrorBox message="Backtest failed" />}

      {/* Results */}
      {s && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-2">
            <StatBox label="Total Trades" value={`${s.total}`}                                    color="#c0d0e8" />
            <StatBox label="Win Rate"     value={fmtPct(s.win_rate)}                              color={s.win_rate >= 50 ? "#00d97e" : "#f03060"} />
            <StatBox label="Total P&L"   value={`₹${fmt(s.total_pnl)}`}                         color={s.total_pnl >= 0 ? "#00d97e" : "#f03060"} />
            <StatBox label="Max Drawdown" value={`₹${fmt(Math.abs(s.max_drawdown))}`}            color="#f03060" />
            <StatBox label="Avg Win"      value={`₹${fmt(s.avg_win)}`}                           color="#00d97e" />
            <StatBox label="Avg Loss"     value={`₹${fmt(Math.abs(s.avg_loss))}`}                color="#f03060" />
            <StatBox label="Profit Factor" value={`${s.profit_factor}x`}                         color={s.profit_factor >= 1 ? "#00d97e" : "#f03060"} />
            <StatBox label="Sharpe"       value={`${s.sharpe}`}                                   color={s.sharpe >= 1 ? "#00d97e" : "#f0a030"} />
          </div>

          {/* Equity curve */}
          <Card title="Equity Curve">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={data.equity_curve}>
                <defs>
                  <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#00c8f0" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00c8f0" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#0f1e36" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: "#445566", fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "#445566", fontSize: 9 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={{ background: "#060c1a", border: "1px solid #0f1e36", borderRadius: 8, fontSize: 11 }}
                  formatter={(v: number) => [`₹${fmt(v)}`, "Equity"]}
                />
                <ReferenceLine y={0} stroke="#334455" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="equity" stroke="#00c8f0" strokeWidth={2} fill="url(#eqGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* Trade P&L bars */}
          <Card title="Trade P&L">
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={data.trades.slice(-30)}>
                <CartesianGrid stroke="#0f1e36" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: "#445566", fontSize: 8 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#445566", fontSize: 9 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} width={36} />
                <Tooltip
                  contentStyle={{ background: "#060c1a", border: "1px solid #0f1e36", borderRadius: 8, fontSize: 11 }}
                  formatter={(v: number) => [`₹${fmt(v)}`, "P&L"]}
                />
                <ReferenceLine y={0} stroke="#334455" />
                <Bar dataKey="pnl"
                  fill="#00d97e"
                  radius={[2, 2, 0, 0]}
                  label={false}
                  // @ts-ignore
                  fill={(entry: any) => entry.win ? "#00d97e" : "#f03060"}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Trade list */}
          <Card title={`Recent Trades (${data.trades.length})`}>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {[...data.trades].reverse().slice(0, 20).map((t, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1 border-b"
                  style={{ borderColor: "#0f1e3640" }}>
                  <span style={{ color: "#445566" }}>{t.date}</span>
                  <span style={{ color: "#c0d0e8" }}>₹{fmt(t.spot)}</span>
                  <span style={{ color: "#9b5cf6" }}>IV: {t.iv}%</span>
                  <span style={{ color: t.win ? "#00d97e" : "#f03060", fontWeight: 700 }}>
                    {t.pnl >= 0 ? "+" : ""}₹{fmt(t.pnl)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {!data && !isPending && (
        <div className="text-center py-16" style={{ color: "#445566" }}>
          <div className="text-4xl mb-3">📊</div>
          <div className="text-sm">Configure and run backtest</div>
          <div className="text-xs mt-1" style={{ color: "#334455" }}>Simulates strategy over historical data</div>
        </div>
      )}
    </div>
  );
}
