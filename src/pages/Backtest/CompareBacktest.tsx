import { useState } from "react";
import { runBacktest, type Timeframe } from "../../utils/api";
import Card from "../../components/ui/Card";
import Loader from "../../components/ui/Loader";
import ErrorBox from "../../components/ui/ErrorBox";
import {
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useTheme } from "../../store/themeStore";
import { STRATEGIES, DataSourceBadge, fmt, fmtPct } from "./shared";

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

export default function CompareBacktest({
  symbol, resolution, days, setDays, slPct, setSlPct, tgtPct, setTgtPct, lotSize, setLotSize, maxDays,
}: Props) {
  const theme = useTheme();
  const COLORS = [theme.accent.cyan, theme.accent.orange, theme.accent.purple, theme.accent.red, theme.accent.green];

  const [selected, setSelected]             = useState<string[]>(["ironCondor", "straddle"]);
  const [compareResults, setCompareResults] = useState<any[] | null>(null);
  const [isComparing, setIsComparing]       = useState(false);
  const [compareError, setCompareError]     = useState(false);

  const toggleSelected = (key: string) => {
    setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const runCompare = async () => {
    if (selected.length < 2) return;
    setIsComparing(true); setCompareError(false); setCompareResults(null);
    try {
      const results = await Promise.all(
        selected.map(async key => {
          const res   = await runBacktest({ symbol, strategy: key, days, resolution, sl_pct: slPct, tgt_pct: tgtPct, lot_size: lotSize });
          const label = STRATEGIES.find(s => s.key === key)?.label ?? key;
          return { key, label, data: res };
        })
      );
      setCompareResults(results);
    } catch { setCompareError(true); }
    finally { setIsComparing(false); }
  };

  const compareChartData = (() => {
    if (!compareResults) return [];
    const maxLen = Math.max(...compareResults.map(r => r.data.equity_curve?.length ?? 0));
    const rows: any[] = [];
    for (let i = 0; i < maxLen; i++) {
      const row: any = { i };
      compareResults.forEach(r => { row[r.key] = r.data.equity_curve?.[i]?.equity ?? null; });
      rows.push(row);
    }
    return rows;
  })();

  return (
    <>
      <Card title="Backtest Configuration">
        <div className="space-y-3">
          <div>
            <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Select 2+ strategies to compare</div>
            <div className="flex flex-wrap gap-1">
              {STRATEGIES.map((st, i) => {
                const on = selected.includes(st.key);
                return (
                  <button key={st.key} onClick={() => toggleSelected(st.key)}
                    className="px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1"
                    style={{ background: on ? `${COLORS[i % COLORS.length]}20` : theme.bg.surfaceAlt, color: on ? COLORS[i % COLORS.length] : theme.text.muted, border: `1px solid ${on ? COLORS[i % COLORS.length] : theme.border.subtle}` }}>
                    {on && <span style={{ width: 6, height: 6, borderRadius: 99, background: COLORS[i % COLORS.length] }} />}
                    {st.label}
                  </button>
                );
              })}
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
          <button onClick={runCompare} disabled={isComparing || selected.length < 2}
            className="w-full py-2.5 rounded-xl text-sm font-black"
            style={{ background: theme.accent.cyan, color: theme.bg.page, opacity: (isComparing || selected.length < 2) ? 0.5 : 1 }}>
            {isComparing ? "Comparing..." : selected.length < 2 ? "Select 2+ strategies" : "▶ Run Comparison"}
          </button>
        </div>
      </Card>

      {isComparing  && <Loader text="Running comparison..." />}
      {compareError && <ErrorBox message="Comparison failed" />}
      {compareResults && (
        <>
          <div className="flex justify-end"><DataSourceBadge source={compareResults[0]?.data?.data_source} theme={theme} /></div>
          <Card title="Strategy Comparison">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: theme.text.muted }}>
                    <th className="text-left  py-1">Strategy</th>
                    <th className="text-right py-1">Total P&L</th>
                    <th className="text-right py-1">Win %</th>
                    <th className="text-right py-1">Max DD</th>
                    <th className="text-right py-1">Sharpe</th>
                    <th className="text-right py-1">PF</th>
                  </tr>
                </thead>
                <tbody>
                  {compareResults.map((r, i) => {
                    const rs = r.data.summary;
                    return (
                      <tr key={r.key} style={{ borderTop: `1px solid ${theme.border.subtle}` }}>
                        <td className="py-1.5 font-bold flex items-center gap-1" style={{ color: COLORS[i % COLORS.length] }}>
                          <span style={{ width: 6, height: 6, borderRadius: 99, background: COLORS[i % COLORS.length], display: "inline-block" }} />
                          {r.label}
                        </td>
                        <td className="text-right" style={{ color: rs.total_pnl >= 0 ? theme.accent.green : theme.accent.red }}>₹{fmt(rs.total_pnl)}</td>
                        <td className="text-right" style={{ color: theme.text.secondary }}>{fmtPct(rs.win_rate)}</td>
                        <td className="text-right" style={{ color: theme.accent.red }}>₹{fmt(Math.abs(rs.max_drawdown))}</td>
                        <td className="text-right" style={{ color: theme.text.secondary }}>{rs.sharpe}</td>
                        <td className="text-right" style={{ color: theme.text.secondary }}>{rs.profit_factor}x</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <Card title="Equity Curve Comparison">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={compareChartData}>
                <CartesianGrid stroke={theme.border.subtle} strokeDasharray="3 3" />
                <XAxis dataKey="i" tick={{ fill: theme.text.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: theme.text.muted, fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} width={44} />
                <Tooltip contentStyle={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, borderRadius: 8, fontSize: 13 }}
                  formatter={(v) => [`₹${fmt(Number(v ?? 0))}`, ""]} />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={(key: string) => compareResults.find(r => r.key === key)?.label ?? key} />
                <ReferenceLine y={0} stroke={theme.text.faint} strokeDasharray="4 4" />
                {compareResults.map((r, i) => (
                  <Line key={r.key} type="monotone" dataKey={r.key} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}
      {!compareResults && !isComparing && (
        <div className="text-center py-16" style={{ color: theme.text.muted }}>
          <div className="text-4xl mb-3">⚖️</div>
          <div className="text-sm">Select 2+ strategies and run comparison</div>
        </div>
      )}
    </>
  );
}
