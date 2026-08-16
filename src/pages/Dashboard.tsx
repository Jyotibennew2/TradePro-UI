import { useQuery } from "@tanstack/react-query";
import { fetchHealth, fetchQuotes, fetchFunds, fetchPortfolio } from "../utils/api";
import Card from "../components/ui/Card";
import Loader from "../components/ui/Loader";
import { TrendingUp, TrendingDown, DollarSign, Activity, Server } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useTheme } from "../store/themeStore";
import type { Theme } from "../styles/theme";

function StatBox({ label, value, sub, color, theme }: {
  label: string; value: string; sub?: string; color: string; theme: Theme;
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}` }}>
      <div className="text-sm mb-1" style={{ color: theme.text.muted }}>{label}</div>
      <div className="text-xl font-black" style={{ color }}>{value}</div>
      {sub && <div className="text-sm mt-1" style={{ color: theme.text.faint }}>{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const theme = useTheme();
  const health  = useQuery({ queryKey: ["health"],    queryFn: fetchHealth,           refetchInterval: 10000 });
  // Shares the ["quotes"] cache key with Header's useQuotes() hook — react-query
  // dedupes same-key queries to one shared poll, so this doesn't double the
  // request rate. Was 3s; bumped to 10s to stay under Fyers' rate limit
  // (compounds badly across multiple open browser tabs, each polling independently).
  const quotes  = useQuery({ queryKey: ["quotes"],    queryFn: () => fetchQuotes(),   refetchInterval: 10000 });
  const funds   = useQuery({ queryKey: ["funds"],     queryFn: fetchFunds,            refetchInterval: 30000 });
  const paper   = useQuery({ queryKey: ["portfolio"], queryFn: fetchPortfolio,        refetchInterval: 5000  });

  const q       = quotes.data?.data ?? {};
  const nifty   = q["NSE:NIFTY50-INDEX"];
  const bank    = q["NSE:NIFTYBANK-INDEX"];
  const f       = funds.data?.data;
  const p       = paper.data?.data;

  const fmt = (n?: number) => n != null
    ? n.toLocaleString("en-IN", { maximumFractionDigits: 2 })
    : "---";

  const pct = (n?: number) => n != null ? `${n > 0 ? "+" : ""}${n.toFixed(2)}%` : "";

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
      <div className="flex items-center gap-3 text-sm" style={{ color: theme.text.muted }}>
        <Server size={14} />
        <span>Backend</span>
        <span style={{ color: health.data?.authenticated ? theme.accent.green : theme.accent.red }}>
          ● {health.data?.authenticated ? "LIVE" : "MOCK"}
        </span>
        <span>v{health.data?.version ?? "---"}</span>
        <span className="ml-auto">{new Date().toLocaleTimeString("en-IN")}</span>
      </div>

      {/* Index cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatBox theme={theme}
          label="NIFTY 50"
          value={fmt(nifty?.ltp)}
          sub={pct(nifty?.chp)}
          color={(nifty?.ch ?? 0) >= 0 ? theme.accent.green : theme.accent.red}
        />
        <StatBox theme={theme}
          label="BANK NIFTY"
          value={fmt(bank?.ltp)}
          sub={pct(bank?.chp)}
          color={(bank?.ch ?? 0) >= 0 ? theme.accent.green : theme.accent.red}
        />
        <StatBox theme={theme}
          label="Paper Capital"
          value={`₹${fmt(p?.capital)}`}
          sub="Paper Trading"
          color={theme.accent.purple}
        />
        <StatBox theme={theme}
          label="Total P&L"
          value={`₹${fmt(p?.total_pnl)}`}
          sub={`${p?.open_count ?? 0} open positions`}
          color={(p?.total_pnl ?? 0) >= 0 ? theme.accent.green : theme.accent.red}
        />
      </div>

      {/* Funds */}
      {f && (
        <Card title="Funds">
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: "Total",     value: f.total,     color: theme.text.secondary },
              { label: "Used",      value: f.used,      color: theme.accent.red },
              { label: "Available", value: f.available, color: theme.accent.green },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className="text-sm mb-1" style={{ color: theme.text.muted }}>{label}</div>
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
                <stop offset="5%"  stopColor={theme.accent.cyan} stopOpacity={0.3} />
                <stop offset="95%" stopColor={theme.accent.cyan} stopOpacity={0}   />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" tick={{ fill: theme.text.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}`, borderRadius: 8, fontSize: 13 }}
              labelStyle={{ color: theme.text.muted }}
              formatter={(v) => [`₹${Number(v ?? 0).toLocaleString("en-IN")}`, "Capital"]}
            />
            <Area type="monotone" dataKey="v" stroke={theme.accent.cyan} strokeWidth={2} fill="url(#pnlGrad)" />
          </AreaChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-3 gap-2 mt-3 text-center text-sm">
          <div>
            <div style={{ color: theme.text.muted }}>Realized</div>
            <div style={{ color: (p?.realized_pnl ?? 0) >= 0 ? theme.accent.green : theme.accent.red }}>
              ₹{fmt(p?.realized_pnl)}
            </div>
          </div>
          <div>
            <div style={{ color: theme.text.muted }}>Unrealized</div>
            <div style={{ color: (p?.unrealized_pnl ?? 0) >= 0 ? theme.accent.green : theme.accent.red }}>
              ₹{fmt(p?.unrealized_pnl)}
            </div>
          </div>
          <div>
            <div style={{ color: theme.text.muted }}>Open</div>
            <div style={{ color: theme.accent.cyan }}>{p?.open_count ?? 0}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Suppress unused-import warnings for icons reserved for future stat cards
void TrendingUp; void TrendingDown; void DollarSign; void Activity;
