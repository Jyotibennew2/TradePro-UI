import { useQuery } from "@tanstack/react-query";
import { fetchHealth, fetchQuotes, fetchFunds, fetchPortfolio } from "../utils/api";
import Card from "../components/ui/Card";
import Loader from "../components/ui/Loader";
import { TrendingUp, TrendingDown, DollarSign, Activity, Server } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

function StatBox({ label, value, sub, color = "#00c8f0" }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: "#090f1e", border: "1px solid #0f1e36" }}>
      <div className="text-xs mb-1" style={{ color: "#445566" }}>{label}</div>
      <div className="text-xl font-black" style={{ color }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: "#334455" }}>{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const health  = useQuery({ queryKey: ["health"],    queryFn: fetchHealth,    refetchInterval: 10000 });
  const quotes  = useQuery({ queryKey: ["quotes"],    queryFn: fetchQuotes,    refetchInterval: 3000  });
  const funds   = useQuery({ queryKey: ["funds"],     queryFn: fetchFunds,     refetchInterval: 30000 });
  const paper   = useQuery({ queryKey: ["portfolio"], queryFn: fetchPortfolio, refetchInterval: 5000  });

  const q       = quotes.data?.data ?? {};
  const nifty   = q["NSE:NIFTY50-INDEX"];
  const bank    = q["NSE:NIFTYBANK-INDEX"];
  const f       = funds.data?.data;
  const p       = paper.data?.data;

  const fmt = (n?: number) => n != null
    ? n.toLocaleString("en-IN", { maximumFractionDigits: 2 })
    : "---";

  const pct = (n?: number) => n != null ? `${n > 0 ? "+" : ""}${n.toFixed(2)}%` : "";

  // Simulated equity curve from paper portfolio
  const equityCurve = [
    { t: "9:15",  v: 500000 },
    { t: "10:00", v: 500000 + (p?.realized_pnl ?? 0) * 0.2 },
    { t: "11:00", v: 500000 + (p?.realized_pnl ?? 0) * 0.5 },
    { t: "12:00", v: 500000 + (p?.realized_pnl ?? 0) * 0.8 },
    { t: "Now",   v: p?.capital ?? 500000 },
  ];

  if (quotes.isLoading) return <Loader text="Loading dashboard..." />;

  return (
    <div className="p-4 space-y-4">
      {/* Status bar */}
      <div className="flex items-center gap-3 text-xs" style={{ color: "#445566" }}>
        <Server size={12} />
        <span>Backend</span>
        <span style={{ color: health.data?.authenticated ? "#00d97e" : "#f03060" }}>
          ● {health.data?.authenticated ? "LIVE" : "MOCK"}
        </span>
        <span>v{health.data?.version ?? "---"}</span>
        <span className="ml-auto">{new Date().toLocaleTimeString("en-IN")}</span>
      </div>

      {/* Index cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatBox
          label="NIFTY 50"
          value={fmt(nifty?.ltp)}
          sub={pct(nifty?.chp)}
          color={(nifty?.ch ?? 0) >= 0 ? "#00d97e" : "#f03060"}
        />
        <StatBox
          label="BANK NIFTY"
          value={fmt(bank?.ltp)}
          sub={pct(bank?.chp)}
          color={(bank?.ch ?? 0) >= 0 ? "#00d97e" : "#f03060"}
        />
        <StatBox
          label="Paper Capital"
          value={`₹${fmt(p?.capital)}`}
          sub="Paper Trading"
          color="#9b5cf6"
        />
        <StatBox
          label="Total P&L"
          value={`₹${fmt(p?.total_pnl)}`}
          sub={`${p?.open_count ?? 0} open positions`}
          color={(p?.total_pnl ?? 0) >= 0 ? "#00d97e" : "#f03060"}
        />
      </div>

      {/* Funds */}
      {f && (
        <Card title="Funds">
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: "Total",     value: f.total,     color: "#c0d0e8" },
              { label: "Used",      value: f.used,      color: "#f03060" },
              { label: "Available", value: f.available, color: "#00d97e" },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className="text-xs mb-1" style={{ color: "#445566" }}>{label}</div>
                <div className="text-sm font-bold" style={{ color }}>
                  ₹{fmt(value)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Paper P&L chart */}
      <Card title="Paper Portfolio">
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={equityCurve}>
            <defs>
              <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#00c8f0" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#00c8f0" stopOpacity={0}   />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" tick={{ fill: "#445566", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: "#090f1e", border: "1px solid #0f1e36", borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: "#445566" }}
              formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Capital"]}
            />
            <Area type="monotone" dataKey="v" stroke="#00c8f0" strokeWidth={2} fill="url(#pnlGrad)" />
          </AreaChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs">
          <div>
            <div style={{ color: "#445566" }}>Realized</div>
            <div style={{ color: (p?.realized_pnl ?? 0) >= 0 ? "#00d97e" : "#f03060" }}>
              ₹{fmt(p?.realized_pnl)}
            </div>
          </div>
          <div>
            <div style={{ color: "#445566" }}>Unrealized</div>
            <div style={{ color: (p?.unrealized_pnl ?? 0) >= 0 ? "#00d97e" : "#f03060" }}>
              ₹{fmt(p?.unrealized_pnl)}
            </div>
          </div>
          <div>
            <div style={{ color: "#445566" }}>Open</div>
            <div style={{ color: "#00c8f0" }}>{p?.open_count ?? 0}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
