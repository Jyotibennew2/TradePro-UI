import { useState } from "react";
import { runBacktest, type Timeframe } from "../../utils/api";
import Card from "../../components/ui/Card";
import Loader from "../../components/ui/Loader";
import ErrorBox from "../../components/ui/ErrorBox";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useTheme } from "../../store/themeStore";
import { STRATEGIES, StatBox, DataSourceBadge, fmt, fmtPct } from "./shared";

interface Props {
  symbol    : string;
  resolution: Timeframe;
  days      : number;
  setDays   : (n: number) => void;
  slPct     : number;
  setSlPct  : (n: number) => void;
  tgtPct    : number;
  setTgtPct : (n: number) => void;
  lotSize   : number;
  setLotSize: (n: number) => void;
  maxDays   : number;
}

export default function SingleBacktest({
  symbol, resolution, days, setDays, slPct, setSlPct, tgtPct, setTgtPct, lotSize, setLotSize, maxDays,
}: Props) {
  const theme = useTheme();

  const [strategy, setStrategy]   = useState("ironCondor");
  const [data, setData]           = useState<any>(null);
  const [isPending, setIsPending] = useState(false);
  const [isError, setIsError]     = useState(false);

  const runSingle = async () => {
    setIsPending(true); setIsError(false); setData(null);
    try {
      const res = await runBacktest({ symbol, strategy, days, resolution, sl_pct: slPct, tgt_pct: tgtPct, lot_size: lotSize });
      setData(res);
    } catch { setIsError(true); }
    finally { setIsPending(false); }
  };

  const s = data?.summary;

  return (
    <>
      <Card title="Backtest Configuration">
        <div className="space-y-3">
          <div>
            <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Strategy</div>
            <div className="flex flex-wrap gap-1">
              {STRATEGIES.map(st => (
                <button key={st.key} onClick={() => setStrategy(st.key)}
                  className="px-3 py-1.5 rounded-lg text-sm font-bold"
                  style={{ background: strategy === st.key ? theme.accent.cyan : theme.bg.surfaceAlt, color: strategy === st.key ? theme.bg.page : theme.text.muted, border: `1px solid ${theme.border.subtle}` }}>
                  {st.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Days",     value: days,    setter: setDays,    min: 1,  max: maxDays },
              { label: "SL %",     value: slPct,   setter: setSlPct,   min: 10, max: 200 },
              { label: "Target %", value: tgtPct,  setter: setTgtPct,  min: 10, max: 200 },
              { label: "Lot Size", value: lotSize, setter: setLotSize, min: 1,  max: 500 },
            ].map(({ label, value, setter, min, max }) => (
              <div key={label}>
                <div className="text-sm mb-1" style={{ color: theme.text.muted }}>{label}: <span style={{ color: theme.accent.cyan }}>{value}</span></div>
                <input type="range" min={min} max={max} value={value} onChange={e => setter(Number(e.target.value))} className="w-full" />
              </div>
            ))}
          </div>
          <button onClick={runSingle} disabled={isPending}
            className="w-full py-2.5 rounded-xl text-sm font-black"
            style={{ background: theme.accent.cyan, color: theme.bg.page, opacity: isPending ? 0.7 : 1 }}>
            {isPending ? "Running Backtest..." : "▶ Run Backtest"}
          </button>
        </div>
      </Card>

      {isPending && <Loader text="Running backtest simulation..." />}
      {isError   && <ErrorBox message="Backtest failed" />}
      {s && (
        <>
          <div className="flex justify-end"><DataSourceBadge source={data?.data_source} theme={theme} /></div>
          <div className="grid grid-cols-2 gap-2">
            <StatBox theme={theme} label="Total Trades"  value={`${s.total}`}                        color={theme.text.secondary} />
            <StatBox theme={theme} label="Win Rate"      value={fmtPct(s.win_rate)}                  color={s.win_rate >= 50 ? theme.accent.green : theme.accent.red} />
            <StatBox theme={theme} label="Total P&L"    value={`₹${fmt(s.total_pnl)}`}              color={s.total_pnl >= 0 ? theme.accent.green : theme.accent.red} />
            <StatBox theme={theme} label="Max Drawdown"  value={`₹${fmt(Math.abs(s.max_drawdown))}`} color={theme.accent.red} />
            <StatBox theme={theme} label="Avg Win"       value={`₹${fmt(s.avg_win)}`}               color={theme.accent.green} />
            <StatBox theme={theme} label="Avg Loss"      value={`₹${fmt(Math.abs(s.avg_loss))}`}    color={theme.accent.red} />
            <StatBox theme={theme} label="Profit Factor" value={`${s.profit_factor}x`}              color={s.profit_factor >= 1 ? theme.accent.green : theme.accent.red} />
            <StatBox theme={theme} label="Sharpe"        value={`${s.sharpe}`}                      color={s.sharpe >= 1 ? theme.accent.green : theme.accent.orange} />
          </div>
          <Card title="Equity Curve">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={data.equity_curve}>
                <defs>
                  <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={theme.accent.cyan} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={theme.accent.cyan} stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={theme.border.subtle} strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: theme.text.muted, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: theme.text.muted, fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} width={44} />
                <Tooltip contentStyle={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, borderRadius: 8, fontSize: 13 }}
                  formatter={(v) => [`₹${fmt(Number(v ?? 0))}`, "Equity"]} />
                <ReferenceLine y={0} stroke={theme.text.faint} strokeDasharray="4 4" />
                <Area type="monotone" dataKey="equity" stroke={theme.accent.cyan} strokeWidth={2} fill="url(#eqGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
          <Card title="Trade P&L">
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={data.trades.slice(-30)}>
                <CartesianGrid stroke={theme.border.subtle} strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: theme.text.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: theme.text.muted, fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} width={40} />
                <Tooltip contentStyle={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, borderRadius: 8, fontSize: 13 }}
                  formatter={(v) => [`₹${fmt(Number(v ?? 0))}`, "P&L"]} />
                <ReferenceLine y={0} stroke={theme.text.faint} />
                {/* @ts-ignore */}
                <Bar dataKey="pnl" radius={[2, 2, 0, 0]} fill={(entry: any) => entry.win ? theme.accent.green : theme.accent.red} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card title={`Recent Trades (${data.trades.length})`}>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {[...data.trades].reverse().slice(0, 20).map((t: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm py-1 border-b" style={{ borderColor: theme.border.subtle }}>
                  <span style={{ color: theme.text.muted }}>{t.date}</span>
                  <span style={{ color: theme.text.secondary }}>₹{fmt(t.spot)}</span>
                  <span style={{ color: theme.accent.purple }}>IV: {t.iv}%</span>
                  <span style={{ color: t.win ? theme.accent.green : theme.accent.red, fontWeight: 700 }}>
                    {t.pnl >= 0 ? "+" : ""}₹{fmt(t.pnl)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
      {!data && !isPending && (
        <div className="text-center py-16" style={{ color: theme.text.muted }}>
          <div className="text-4xl mb-3">📊</div>
          <div className="text-sm">Configure and run backtest</div>
        </div>
      )}
    </>
  );
}
