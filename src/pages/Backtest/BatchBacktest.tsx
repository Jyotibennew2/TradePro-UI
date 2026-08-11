import { useState, useEffect } from "react";
import {
  runBatchBacktest, runBatchWalkForward,
  fetchArchivedDates, fetchArchivedExpiries, fetchArchivedTimes,
  type BatchRankMetric, type BatchResultRow,
} from "../../utils/api";
import Card from "../../components/ui/Card";
import Loader from "../../components/ui/Loader";
import ErrorBox from "../../components/ui/ErrorBox";
import { useTheme } from "../../store/themeStore";
import { STRATEGIES, SYMBOLS, TIMEFRAMES, DataSourceBadge, fmt, fmtPct, fmtExpiryLabel } from "./shared";

const RANK_OPTIONS: { key: BatchRankMetric; label: string }[] = [
  { key: "total_pnl",     label: "Total P&L"     },
  { key: "roi_pct",       label: "ROI %"         },
  { key: "win_rate",      label: "Win Rate"      },
  { key: "max_drawdown",  label: "Max Drawdown"  },
  { key: "profit_factor", label: "Profit Factor" },
  { key: "risk_reward",   label: "Risk/Reward"   },
];

type SweepMode = "strategy" | "realdata";

/**
 * Batch Backtest — two sweep modes, both through the backend
 * BatchBacktestEngine (POST /api/backtest/batch):
 *
 * "strategy" (V1)  : strategies x symbols x timeframes, Black-Scholes based,
 *                     reuses run_synthetic_backtest.
 * "realdata" (new) : strategies x symbols x expiries x strikes, replayed on
 *                     REAL archived option-chain snapshots, reuses
 *                     run_walkforward_backtest + strategy_leg_offsets.
 *                     Expiry/date/time pickers reuse fetchArchivedDates /
 *                     fetchArchivedExpiries / fetchArchivedTimes — already
 *                     in api.ts, previously unused by any UI component.
 *
 * This component is orchestration + display only, same as CompareBacktest —
 * no P&L/ranking math lives here.
 */
export default function BatchBacktest() {
  const theme = useTheme();
  const [sweepMode, setSweepMode] = useState<SweepMode>("strategy");

  // -- shared across both modes --------------------------------------------
  const [slPct,    setSlPct]    = useState(50);
  const [tgtPct,   setTgtPct]   = useState(50);
  const [lotSize,  setLotSize]  = useState(50);
  const [trailSl,  setTrailSl]  = useState(0);   // 0 = disabled
  const [rankBy,   setRankBy]   = useState<BatchRankMetric>("total_pnl");

  const [result, setResult]   = useState<BatchResultRow[] | null>(null);
  const [dataSource, setDataSource] = useState<"LIVE" | "MOCK" | undefined>();
  const [failedCount, setFailedCount] = useState(0);
  // requested_jobs = raw combo count before the backend's MAX_JOBS cap;
  // executedJobs = total_jobs actually run (== requested unless capped).
  const [requestedJobs, setRequestedJobs] = useState<number | null>(null);
  const [executedJobs,  setExecutedJobs]  = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [errored, setErrored] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggle = (list: string[], setList: (v: string[]) => void, key: string) => {
    setList(list.includes(key) ? list.filter(k => k !== key) : [...list, key]);
  };

  // -- "strategy" mode (Black-Scholes sweep) -------------------------------
  const [strategies, setStrategies] = useState<string[]>(["straddle", "strangle", "ironCondor"]);
  const [symbols,     setSymbols]     = useState<string[]>(["NIFTY"]);
  const [resolutions, setResolutions] = useState<string[]>(["1d"]);
  const [days,     setDays]     = useState(90);
  const [useGreeks, setUseGreeks] = useState(false);
  const [minDelta, setMinDelta] = useState(0.2);
  const [maxDelta, setMaxDelta] = useState(0.8);

  const canRunStrategy = strategies.length > 0 && symbols.length > 0 && resolutions.length > 0 && !running;
  const totalStrategyCombos = strategies.length * symbols.length * resolutions.length;

  const runStrategySweep = async () => {
    if (!canRunStrategy) return;
    setRunning(true); setErrored(false); setErrorMsg(null); setResult(null);
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
      setRequestedJobs(res.requested_jobs);
      setExecutedJobs(res.total_jobs);
      // data_source isn't on the batch response (it's per-job); intentionally
      // omitted at aggregate level to avoid implying one uniform source
      // across a mixed sweep.
      setDataSource(undefined);
    } catch {
      setErrored(true);
    } finally {
      setRunning(false);
    }
  };

  // -- "realdata" mode (real archived option-chain sweep) ------------------
  const [realStrategies, setRealStrategies] = useState<string[]>(["straddle"]);
  const [realSymbols,    setRealSymbols]    = useState<string[]>(["NIFTY"]);

  const [captureDate,   setCaptureDate]   = useState<string>("");
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  const [selectedExpiries, setSelectedExpiries] = useState<string[]>([]);
  const [availableExpiries, setAvailableExpiries] = useState<string[]>([]);

  const [entryTime,     setEntryTime]     = useState<number | null>(null);
  const [availableTimes, setAvailableTimes] = useState<number[]>([]);

  const [strikesText, setStrikesText] = useState("");
  const strikes = strikesText.split(",").map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0);

  // Dates are fetched per the first selected instrument — the archiving
  // scheduler snapshots all symbols/expiries together each cycle, so
  // capture dates line up across instruments in practice; a combo missing
  // data for a specific symbol simply reports in "failed" rather than
  // blocking the batch.
  useEffect(() => {
    if (sweepMode !== "realdata" || realSymbols.length === 0) return;
    setSelectedExpiries([]); setAvailableExpiries([]); setEntryTime(null); setAvailableTimes([]);
    fetchArchivedDates(realSymbols[0]).then(r => setAvailableDates(r.dates || [])).catch(() => setAvailableDates([]));
  }, [sweepMode, realSymbols[0]]);

  useEffect(() => {
    if (sweepMode !== "realdata" || !captureDate || realSymbols.length === 0) return;
    setSelectedExpiries([]); setEntryTime(null); setAvailableTimes([]);
    fetchArchivedExpiries(realSymbols[0], captureDate).then(r => setAvailableExpiries(r.expiries || [])).catch(() => setAvailableExpiries([]));
  }, [captureDate, realSymbols[0]]);

  useEffect(() => {
    if (sweepMode !== "realdata" || !captureDate || selectedExpiries.length === 0 || realSymbols.length === 0) return;
    setEntryTime(null);
    fetchArchivedTimes(realSymbols[0], captureDate, selectedExpiries[0]).then(r => setAvailableTimes(r.times || [])).catch(() => setAvailableTimes([]));
  }, [captureDate, selectedExpiries[0], realSymbols[0]]);

  const canRunRealData = realStrategies.length > 0 && realSymbols.length > 0 &&
    selectedExpiries.length > 0 && strikes.length > 0 && entryTime !== null && !running;
  const totalRealDataCombos = realStrategies.length * realSymbols.length * selectedExpiries.length * strikes.length;

  const runRealDataSweep = async () => {
    if (!canRunRealData || entryTime === null) return;
    setRunning(true); setErrored(false); setErrorMsg(null); setResult(null);
    try {
      const res = await runBatchWalkForward({
        symbols: realSymbols, expiries: selectedExpiries, strikes,
        entryTime, strategies: realStrategies,
        lotSize, slPct, tgtPct,
        trailingSlPct: trailSl > 0 ? trailSl : undefined,
        rankBy,
      });
      setResult(res.ranked);
      setFailedCount(res.failed?.length ?? 0);
      setRequestedJobs(res.requested_jobs);
      setExecutedJobs(res.total_jobs);
      setDataSource(undefined);
    } catch (e: any) {
      setErrored(true);
      setErrorMsg(e?.message || null);
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <div className="flex gap-1">
        <button onClick={() => { setSweepMode("strategy"); setResult(null); }}
          className="flex-1 py-2 rounded-xl text-sm font-bold"
          style={{ background: sweepMode === "strategy" ? theme.accent.cyan : theme.bg.surfaceAlt, color: sweepMode === "strategy" ? theme.bg.page : theme.text.muted, border: `1px solid ${theme.border.subtle}` }}>
          Strategy Sweep (Simulated)
        </button>
        <button onClick={() => { setSweepMode("realdata"); setResult(null); }}
          className="flex-1 py-2 rounded-xl text-sm font-bold"
          style={{ background: sweepMode === "realdata" ? theme.accent.cyan : theme.bg.surfaceAlt, color: sweepMode === "realdata" ? theme.bg.page : theme.text.muted, border: `1px solid ${theme.border.subtle}` }}>
          Real-Data Sweep (Expiry/Strike)
        </button>
      </div>

      {sweepMode === "strategy" && (
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
              <div>
                <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Days: <span style={{ color: theme.accent.cyan }}>{days}</span></div>
                <input type="range" min={1} max={365} value={days} onChange={e => setDays(Number(e.target.value))} className="w-full" />
              </div>
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
          </div>
        </Card>
      )}

      {sweepMode === "realdata" && (
        <Card title="Real-Data Sweep Configuration">
          <div className="space-y-3">
            <div>
              <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Strategies</div>
              <div className="flex flex-wrap gap-1">
                {STRATEGIES.map(st => {
                  const on = realStrategies.includes(st.key);
                  return (
                    <button key={st.key} onClick={() => toggle(realStrategies, setRealStrategies, st.key)}
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
                  const on = realSymbols.includes(sym);
                  return (
                    <button key={sym} onClick={() => toggle(realSymbols, setRealSymbols, sym)}
                      className="px-3 py-1.5 rounded-lg text-sm font-bold"
                      style={{ background: on ? theme.accent.purple : theme.bg.surfaceAlt, color: on ? theme.bg.page : theme.text.muted, border: `1px solid ${theme.border.subtle}` }}>
                      {sym}
                    </button>
                  );
                })}
              </div>
              <div className="text-sm mt-1" style={{ color: theme.text.faint }}>
                Expiry/date/time below are looked up for <strong>{realSymbols[0] || "the first selected instrument"}</strong>; each job still only uses its own instrument's archived data.
              </div>
            </div>

            <div>
              <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Capture Date</div>
              <select value={captureDate} onChange={e => setCaptureDate(e.target.value)}
                className="w-full py-1.5 px-2 rounded-lg text-sm"
                style={{ background: theme.bg.surfaceAlt, color: theme.text.secondary, border: `1px solid ${theme.border.subtle}` }}>
                <option value="">— select a date with archived data —</option>
                {availableDates.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {captureDate && (
              <div>
                <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Expiries</div>
                <div className="flex flex-wrap gap-1">
                  {availableExpiries.length === 0 && <div className="text-sm" style={{ color: theme.text.faint }}>No archived expiries for this date</div>}
                  {availableExpiries.map(exp => {
                    const on = selectedExpiries.includes(exp);
                    return (
                      <button key={exp} onClick={() => toggle(selectedExpiries, setSelectedExpiries, exp)}
                        className="px-3 py-1.5 rounded-lg text-sm font-bold"
                        style={{ background: on ? theme.accent.orange : theme.bg.surfaceAlt, color: on ? theme.bg.page : theme.text.muted, border: `1px solid ${theme.border.subtle}` }}>
                        {fmtExpiryLabel(exp)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedExpiries.length > 0 && (
              <div>
                <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Entry Snapshot Time</div>
                <select value={entryTime ?? ""} onChange={e => setEntryTime(e.target.value ? Number(e.target.value) : null)}
                  className="w-full py-1.5 px-2 rounded-lg text-sm"
                  style={{ background: theme.bg.surfaceAlt, color: theme.text.secondary, border: `1px solid ${theme.border.subtle}` }}>
                  <option value="">— select a snapshot —</option>
                  {availableTimes.map(t => (
                    <option key={t} value={t}>{new Date(t * 1000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</option>
                  ))}
                </select>
                <div className="text-sm mt-1" style={{ color: theme.text.faint }}>
                  Times shown are for {realSymbols[0]} / {fmtExpiryLabel(selectedExpiries[0])}
                </div>
              </div>
            )}

            <div>
              <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Anchor Strikes (ATM per job, comma-separated)</div>
              <input type="text" value={strikesText} onChange={e => setStrikesText(e.target.value)}
                placeholder="e.g. 24000, 24500, 25000"
                className="w-full py-1.5 px-2 rounded-lg text-sm"
                style={{ background: theme.bg.surfaceAlt, color: theme.text.secondary, border: `1px solid ${theme.border.subtle}` }} />
              <div className="text-sm mt-1" style={{ color: theme.text.faint }}>
                Each strategy's legs (e.g. Strangle = ±200 from anchor) are built around every anchor you enter here.
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card title="Risk & Ranking (applies to either sweep)">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[
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

          {sweepMode === "strategy" ? (
            <button onClick={runStrategySweep} disabled={!canRunStrategy}
              className="w-full py-2.5 rounded-xl text-sm font-black"
              style={{ background: theme.accent.cyan, color: theme.bg.page, opacity: canRunStrategy ? 1 : 0.5 }}>
              {running ? "Running batch..." : `▶ Run Batch (${totalStrategyCombos} combo${totalStrategyCombos === 1 ? "" : "s"})`}
            </button>
          ) : (
            <button onClick={runRealDataSweep} disabled={!canRunRealData}
              className="w-full py-2.5 rounded-xl text-sm font-black"
              style={{ background: theme.accent.cyan, color: theme.bg.page, opacity: canRunRealData ? 1 : 0.5 }}>
              {running ? "Running batch..." : `▶ Run Real-Data Batch (${totalRealDataCombos} combo${totalRealDataCombos === 1 ? "" : "s"})`}
            </button>
          )}
        </div>
      </Card>

      {running && <Loader text="Running batch backtest..." />}
      {errored && <ErrorBox message={errorMsg || "Batch backtest failed"} />}

      {result && (
        <>
          {requestedJobs !== null && executedJobs !== null && (
            <div className="text-sm" style={{ color: executedJobs < requestedJobs ? theme.accent.orange : theme.text.muted }}>
              Executed {executedJobs} of {requestedJobs} requested combos
              {executedJobs < requestedJobs ? " (capped at MAX_JOBS)" : ""}
            </div>
          )}
          <div className="flex justify-between items-center">
            <div className="text-sm" style={{ color: theme.text.muted }}>
              {result.length} ranked{failedCount > 0 ? `, ${failedCount} failed (missing data for that combo)` : ""}
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
                        {r.kind === "walkforward" && <span className="ml-1 text-sm" style={{ color: theme.text.faint }}>(real data)</span>}
                        {r.stopped_early && <span className="ml-1 text-sm" style={{ color: theme.accent.orange }}>⚡trail-stopped</span>}
                        {r.exit_reason && r.exit_reason !== "data_ended" && <span className="ml-1 text-sm" style={{ color: theme.accent.orange }}>({r.exit_reason})</span>}
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
          <div className="text-sm">
            {sweepMode === "strategy"
              ? "Select strategies, instruments & timeframes and run the batch"
              : "Select strategies, instruments, a capture date, expiries, entry time & strikes, then run the batch"}
          </div>
        </div>
      )}
    </>
  );
}
