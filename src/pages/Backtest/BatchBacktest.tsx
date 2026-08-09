import { useState } from "react";
import { runBatchBacktest, type BatchRankMetric, type BatchResultRow } from "../../utils/api";
import Card from "../../components/ui/Card";
import Loader from "../../components/ui/Loader";
import ErrorBox from "../../components/ui/ErrorBox";
import { useTheme } from "../../store/themeStore";
import { STRATEGIES, SYMBOLS, TIMEFRAMES, DataSourceBadge, fmt, fmtPct } from "./shared";

const RANK_OPTIONS: { key: BatchRankMetric; label: string }[] = [
  { key: "total_pnl",     label: "Total P&L"     },
  { key: "roi_pct",       label: "ROI %"         },
  { key: "win_rate",      label: "Win Rate"      },
  { key: "max_drawdown",  label: "Max Drawdown"  },
  { key: "profit_factor", label: "Profit Factor" },
  { key: "risk_reward",   label: "Risk/Reward"   },
];

/**
 * Batch Backtest (V1) — sweeps strategies x symbols x timeframes through
 * the backend BatchBacktestEngine (POST /api/backtest/batch), which reuses
 * the same run_synthetic_backtest calculation as Single Backtest / Compare.
 * This component is orchestration + display only, same as CompareBacktest.
 */
export default function BatchBacktest() {
  const theme = useTheme();

  const [strategies, setStrategies] = useState<string[]>(["straddle", "strangle", "ironCondor"]);
  const [symbols,     setSymbols]     = useState<string[]>(["NIFTY"]);
  const [resolutions, setResolutions] = useState<string[]>(["1d"]);

  const [days,     setDays]     = useState(90);
  const [slPct,    setSlPct]    = useState(50);
  const [tgtPct,   setTgtPct]   = useState(50);
  const [lotSize,  setLotSize]  = useState(50);
  const [trailSl,  setTrailSl]  = useState(0);   // 0 = disabled
  const [useGreeks, setUseGreeks] = useState(false);
  const [minDelta, setMinDelta] = useState(0.2);
  const [maxDelta, setMaxDelta] = useState(0.8);
  const [rankBy,   setRankBy]   = useState<BatchRankMetric>("total_pnl");

  const [result, setResult]   = useState<BatchResultRow[] | null>(null);
  const [dataSource, setDataSource] = useState<"LIVE" | "MOCK" | undefined>();
  const [failedCount, setFailedCount] = useState(0);
  const [running, setRunning] = useState(false);
  const [errored, setErrored] = useState(false);

  const toggle = (list: string[], setList: (v: string[]) => void, key: string) => {
    setList(list.includes(key) ? list.filter(k => k !== key) : [...list, key]);
  };

  const canRun = strategies.length > 0 && symbols.length > 0 && resolutions.length > 0 && !running;

  const runBatch = async () => {
    if (!canRun) return;
    setRunning(true); setErrored(false); setResult(null);
    try {
      const res = await runBatchBacktest({
        strategies, symbols, resolutions: resolutions as any,
        days, lotSize, slPct, tgtPct,
        trailingSlPct: trailSl > 0 ? trailSl : undefined,
        greeksFilter : useGreeks ? { min_delta: minDelta, max_delta: maxDelta } : undefined,
        rankBy,
      });
      setResult(res.ranked);
      setFailedCount(res.failed?.length ?? 0);
      // data_source isn't on the batch response (it's per-job); show MOCK/LIVE
      // is intentionally omitted at aggregate level to avoid implying one
      // uniform source across a mixed sweep.
      setDataSource(undefined);
    } catch {
      setErrored(true);
    } finally {
      setRunning(false);
    }
  };

  const totalCombos = strategies.length * symbols.length * resolutions.length;

  return (
    <>
      <Card title="Batch Configuration">
        <div className="space-y-3">
          <div>
            <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Strategies</div>
            <div className="flex flex-wrap gap-1">
              {STRATEGIES.map(st => {
                const on = strategies.includes(st.key);
                return (
                  <button key={st.key} onClick={() => toggle(strategies, setStrategies, st.key)}
                    className="px-3 py-1.5 rounded-lg text-sm font-bold"
                    style={{ background: on ? theme.accent.cyan : theme.bg.surfaceAlt, color: on ? theme.bg.page : theme.text.muted, border: `1px solid ${theme.border.subtle}` }}>
                    {st.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Instruments</div>
            <div className="flex flex-wrap gap-1">
              {SYMBOLS.map(sym => {
                const on = symbols.includes(sym);
                return (
                  <button key={sym} onClick={() => toggle(symbols, setSymbols, sym)}
                    className="px-3 py-1.5 rounded-lg text-sm font-bold"
                    style={{ background: on ? theme.accent.purple : theme.bg.surfaceAlt, color: on ? theme.bg.page : theme.text.muted, border: `1px solid ${theme.border.subtle}` }}>
                    {sym}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Timeframes</div>
            <div className="flex flex-wrap gap-1">
              {TIMEFRAMES.map(tf => {
                const on = resolutions.includes(tf.key);
                return (
                  <button key={tf.key} onClick={() => toggle(resolutions, setResolutions, tf.key)}
                    className="px-3 py-1.5 rounded-lg text-sm font-bold"
                    style={{ background: on ? theme.accent.orange : theme.bg.surfaceAlt, color: on ? theme.bg.page : theme.text.muted, border: `1px solid ${theme.border.subtle}` }}>
                    {tf.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Days",              value: days,    setter: setDays,    min: 1,  max: 365 },
              { label: "SL %",              value: slPct,   setter: setSlPct,   min: 10, max: 200 },
              { label: "Target %",          value: tgtPct,  setter: setTgtPct,  min: 10, max: 200 },
              { label: "Lot Size",          value: lotSize, setter: setLotSize, min: 1,  max: 500 },
              { label: "Trailing SL % (0=off)", value: trailSl, setter: setTrailSl, min: 0, max: 100 },
            ].map(({ label, value, setter, min, max }) => (
              <div key={label}>
                <div className="text-sm mb-1" style={{ color: theme.text.muted }}>{label}: <span style={{ color: theme.accent.cyan }}>{value}</span></div>
                <input type="range" min={min} max={max} value={value} onChange={e => setter(Number(e.target.value))} className="w-full" />
              </div>
            ))}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-bold" style={{ color: theme.text.muted }}>
              <input type="checkbox" checked={useGreeks} onChange={e => setUseGreeks(e.target.checked)} />
              Apply Greeks condition (Delta range)
            </label>
            {useGreeks && (
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Min |Delta|: <span style={{ color: theme.accent.cyan }}>{minDelta.toFixed(2)}</span></div>
                  <input type="range" min={0} max={1} step={0.05} value={minDelta} onChange={e => setMinDelta(Number(e.target.value))} className="w-full" />
                </div>
                <div>
                  <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Max |Delta|: <span style={{ color: theme.accent.cyan }}>{maxDelta.toFixed(2)}</span></div>
                  <input type="range" min={0} max={1} step={0.05} value={maxDelta} onChange={e => setMaxDelta(Number(e.target.value))} className="w-full" />
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Rank results by</div>
            <div className="flex flex-wrap gap-1">
              {RANK_OPTIONS.map(r => (
                <button key={r.key} onClick={() => setRankBy(r.key)}
                  className="px-3 py-1.5 rounded-lg text-sm font-bold"
                  style={{ background: rankBy === r.key ? theme.accent.green : theme.bg.surfaceAlt, color: rankBy === r.key ? theme.bg.page : theme.text.muted, border: `1px solid ${theme.border.subtle}` }}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={runBatch} disabled={!canRun}
            className="w-full py-2.5 rounded-xl text-sm font-black"
            style={{ background: theme.accent.cyan, color: theme.bg.page, opacity: canRun ? 1 : 0.5 }}>
            {running ? "Running batch..." : `▶ Run Batch (${totalCombos} combo${totalCombos === 1 ? "" : "s"})`}
          </button>
        </div>
      </Card>

      {running && <Loader text="Running batch backtest..." />}
      {errored && <ErrorBox message="Batch backtest failed" />}

      {result && (
        <>
          <div className="flex justify-between items-center">
            <div className="text-sm" style={{ color: theme.text.muted }}>
              {result.length} ranked{failedCount > 0 ? `, ${failedCount} failed` : ""}
            </div>
            <DataSourceBadge source={dataSource} theme={theme} />
          </div>
          <Card title={`Ranked Results — by ${RANK_OPTIONS.find(r => r.key === rankBy)?.label}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: theme.text.muted }}>
                    <th className="text-left  py-1">#</th>
                    <th className="text-left  py-1">Job</th>
                    <th className="text-right py-1">P&L</th>
                    <th className="text-right py-1">ROI</th>
                    <th className="text-right py-1">Win %</th>
                    <th className="text-right py-1">Max DD</th>
                    <th className="text-right py-1">PF</th>
                    <th className="text-right py-1">R:R</th>
                  </tr>
                </thead>
                <tbody>
                  {result.map(r => (
                    <tr key={r.rank} style={{ borderTop: `1px solid ${theme.border.subtle}` }}>
                      <td className="py-1.5 font-bold" style={{ color: theme.text.faint }}>{r.rank}</td>
                      <td className="py-1.5 font-bold" style={{ color: theme.text.secondary }}>
                        {r.job}
                        {r.stopped_early && <span className="ml-1 text-sm" style={{ color: theme.accent.orange }}>⚡trail-stopped</span>}
                      </td>
                      <td className="text-right" style={{ color: r.summary.total_pnl >= 0 ? theme.accent.green : theme.accent.red }}>₹{fmt(r.summary.total_pnl)}</td>
                      <td className="text-right" style={{ color: theme.text.secondary }}>{fmtPct(r.summary.roi_pct)}</td>
                      <td className="text-right" style={{ color: theme.text.secondary }}>{fmtPct(r.summary.win_rate)}</td>
                      <td className="text-right" style={{ color: theme.accent.red }}>₹{fmt(Math.abs(r.summary.max_drawdown))}</td>
                      <td className="text-right" style={{ color: theme.text.secondary }}>{r.summary.profit_factor}x</td>
                      <td className="text-right" style={{ color: theme.text.secondary }}>{r.summary.risk_reward}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {!result && !running && (
        <div className="text-center py-16" style={{ color: theme.text.muted }}>
          <div className="text-4xl mb-3">📊</div>
          <div className="text-sm">Select strategies, instruments &amp; timeframes and run the batch</div>
        </div>
      )}
    </>
  );
}
