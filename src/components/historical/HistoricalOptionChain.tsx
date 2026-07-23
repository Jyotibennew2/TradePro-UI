/**
 * TradePro - Historical Option Chain (shared)
 * Real archived data (per-expiry, every ~5 min) with replay/walk-forward
 * controls: timeframe granularity, forward/reverse stepping, auto-play with
 * speed control, jump-to-date, and a mini price chart with a position marker.
 * Also includes a real Walk-Forward Backtest: runs the current Builder legs
 * forward through actual archived LTPs from the currently-viewed snapshot,
 * applying SL/target rules — not a Black-Scholes simulation.
 * Used by both the Simulator page and the Backtest page.
 */

import { useState, useEffect, useRef, useMemo } from "react";
import {
  fetchArchivedChain, fetchArchivedDates, fetchArchivedExpiries, fetchArchivedTimes,
  fetchHistorical, runWalkForwardBacktest, type ArchivedChainRow, type Timeframe,
  type WalkForwardResponse,
} from "../../utils/api";
import { useSimulatorStore, makeOptionLeg } from "../../simulator/state/simulatorStore";
import { LOT_SIZES } from "../../simulator/models/Option";
import Card from "../ui/Card";
import Loader from "../ui/Loader";
import ErrorBox from "../ui/ErrorBox";
import ChainColumnToggle from "../ui/ChainColumnToggle";
import { useTheme } from "../../store/themeStore";
import { useChainColumnsStore, CHAIN_COLUMN_LABELS, type ChainColumns } from "../../store/chainColumnsStore";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceDot, ReferenceLine, ResponsiveContainer,
} from "recharts";
import { Play, Pause, ChevronLeft, ChevronRight, Calendar, TrendingUp } from "lucide-react";

const SYMBOLS = ["NIFTY", "BANKNIFTY"];

// Timeframe granularity → how many ~5-min archived snapshots to skip per step.
// "1d" is special-cased to jump a whole capture date instead.
const TIMEFRAMES: { key: Timeframe; label: string; snapshotStep: number | "day" }[] = [
  { key: "5m",  label: "5 Min",  snapshotStep: 1  },
  { key: "15m", label: "15 Min", snapshotStep: 3  },
  { key: "30m", label: "30 Min", snapshotStep: 6  },
  { key: "1h",  label: "1 Hour", snapshotStep: 12 },
  { key: "2h",  label: "2 Hour", snapshotStep: 24 },
  { key: "1d",  label: "1 Day",  snapshotStep: "day" },
];

const SPEEDS = [0.5, 1, 2, 5] as const;
const BASE_INTERVAL_MS = 3000; // at 1x, one step every 3s

const OPTIONAL_COLS: { key: keyof ChainColumns; field: string; fmt: (n: number) => string }[] = [
  { key: "oi",       field: "oi",        fmt: (n) => (n / 100000).toFixed(1) + "L" },
  { key: "oiChange", field: "oi_change", fmt: (n) => (n >= 0 ? "+" : "") + (n / 100000).toFixed(2) + "L" },
  { key: "volume",   field: "volume",    fmt: (n) => (n / 100000).toFixed(1) + "L" },
  { key: "bid",      field: "bid",       fmt: (n) => n.toFixed(2) },
  { key: "ask",      field: "ask",       fmt: (n) => n.toFixed(2) },
  { key: "iv",       field: "iv",        fmt: (n) => n.toFixed(1) + "%" },
  { key: "delta",    field: "delta",     fmt: (n) => n.toFixed(2) },
  { key: "gamma",    field: "gamma",     fmt: (n) => n.toFixed(4) },
  { key: "theta",    field: "theta",     fmt: (n) => n.toFixed(1) },
  { key: "vega",     field: "vega",      fmt: (n) => n.toFixed(1) },
];

function fmtTime(epoch: number) {
  return new Date(epoch * 1000).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}
function fmtDateLabel(d: string) {
  try { return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}

export default function HistoricalOptionChain() {
  const theme = useTheme();
  const { columns } = useChainColumnsStore();
  const { addLeg, legs } = useSimulatorStore();

  const [symbol, setSymbol] = useState("NIFTY");
  const [resolution, setResolution] = useState<Timeframe>("15m");
  const activeTf = TIMEFRAMES.find(t => t.key === resolution)!;

  const [expiries, setExpiries] = useState<string[]>([]);
  const [expiry, setExpiry] = useState("");
  const [dates, setDates] = useState<string[]>([]);
  const [dateIdx, setDateIdx] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const [timeIdx, setTimeIdx] = useState(0);

  const [chainData, setChainData] = useState<ArchivedChainRow[] | null>(null);
  const [chainMeta, setChainMeta] = useState<{ spot: number; savedAt: number; expiry: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [legMsg, setLegMsg] = useState("");

  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<typeof SPEEDS[number]>(1);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [miniChart, setMiniChart] = useState<{ date: string; close: number; t: number }[]>([]);

  // Walk-forward backtest (real archived LTPs, not simulated)
  const [wfSlPct, setWfSlPct]   = useState(50);
  const [wfTgtPct, setWfTgtPct] = useState(50);
  const [wfResult, setWfResult] = useState<WalkForwardResponse | null>(null);
  const [wfLoading, setWfLoading] = useState(false);
  const [wfError, setWfError]     = useState("");

  // Load all archived expiries for the symbol
  useEffect(() => {
    fetchArchivedExpiries(symbol).then(r => {
      const exps = r.expiries ?? [];
      setExpiries(exps);
      setExpiry(exps[0] ?? "");
    }).catch(() => { setExpiries([]); setExpiry(""); });
  }, [symbol]);

  // Load capture dates for the selected expiry
  useEffect(() => {
    if (!expiry) { setDates([]); return; }
    fetchArchivedDates(symbol, expiry).then(r => {
      const d = r.dates ?? [];
      setDates(d);
      setDateIdx(d.length - 1);
    }).catch(() => setDates([]));
  }, [symbol, expiry]);

  const selectedDate = dates[dateIdx] ?? "";

  // Load snapshot times for the selected date+expiry
  useEffect(() => {
    if (!expiry || !selectedDate) { setTimes([]); return; }
    fetchArchivedTimes(symbol, selectedDate, expiry).then(r => {
      const t = r.times ?? [];
      setTimes(t);
      setTimeIdx(t.length - 1);
    }).catch(() => setTimes([]));
  }, [symbol, expiry, selectedDate]);

  // Mini price chart (underlying spot candles) for the selected date's day
  useEffect(() => {
    if (!selectedDate) return;
    fetchHistorical(symbol, 2, "15m").then(r => {
      setMiniChart((r.candles ?? []).map(c => ({
        t: c.t, close: c.close,
        date: new Date(c.t * 1000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      })));
    }).catch(() => setMiniChart([]));
  }, [symbol, selectedDate]);

  const loadChainAt = async (epoch: number) => {
    if (!selectedDate || !expiry) return;
    setLoading(true); setError(false);
    try {
      const res = await fetchArchivedChain(symbol, selectedDate, expiry, epoch);
      setChainData(res.data.expiryData as ArchivedChainRow[]);
      setChainMeta({ spot: res.spot, savedAt: res.saved_at, expiry: res.expiry });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // Load chain whenever the current timestamp changes; clear any stale backtest result
  useEffect(() => {
    if (times[timeIdx] != null) loadChainAt(times[timeIdx]);
    setWfResult(null); setWfError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [times, timeIdx]);

  // ─── Forward / Reverse stepping ─────────────────────────────────────────
  const step = (dir: 1 | -1) => {
    if (activeTf.snapshotStep === "day") {
      setDateIdx(i => Math.min(Math.max(i + dir, 0), dates.length - 1));
      return;
    }
    const n = activeTf.snapshotStep as number;
    setTimeIdx(i => {
      const next = i + dir * n;
      if (next < 0) {
        setDateIdx(d => Math.max(d - 1, 0));
        return 0;
      }
      if (next >= times.length) {
        setDateIdx(d => Math.min(d + 1, dates.length - 1));
        return times.length - 1;
      }
      return next;
    });
  };

  // ─── Auto-play ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (isPlaying) {
      playRef.current = setInterval(() => step(1), BASE_INTERVAL_MS / speed);
    }
    return () => { if (playRef.current) clearInterval(playRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, speed, resolution, times, dates, timeIdx, dateIdx]);

  const handleAddLeg = (row: ArchivedChainRow, optType: "CE" | "PE", action: "BUY" | "SELL") => {
    const ltp = optType === "CE" ? row.ce_ltp : row.pe_ltp;
    if (ltp == null) return;
    const iv = ((row as any)[`${optType.toLowerCase()}_iv`] ?? 15) as number;
    addLeg(makeOptionLeg(symbol as "NIFTY" | "BANKNIFTY", row.strike, optType, action, 1, ltp, iv, ""));
    setLegMsg(`✓ Added ${action} ${row.strike} ${optType} to Builder`);
    setTimeout(() => setLegMsg(""), 2000);
  };

  // ─── Walk-forward backtest: replay Builder legs from the current snapshot ─
  const runWalkForward = async () => {
    if (!chainMeta || !expiry || legs.length === 0) return;
    setWfLoading(true); setWfError(""); setWfResult(null);
    try {
      const res = await runWalkForwardBacktest({
        symbol, expiry,
        entryTime: chainMeta.savedAt,
        legs: legs.map(l => ({
          strike: l.contract.strike, option_type: l.contract.optionType,
          action: l.action, lots: l.lots,
        })),
        lotSize: LOT_SIZES[symbol as "NIFTY" | "BANKNIFTY"] ?? 50,
        slPct: wfSlPct, tgtPct: wfTgtPct,
      });
      setWfResult(res);
    } catch (e: any) {
      setWfError(e?.message?.includes("400") || e?.message?.includes("404")
        ? "Couldn't run — strikes may be outside the archived range at this point."
        : "Walk-forward backtest failed");
    } finally {
      setWfLoading(false);
    }
  };

  const fmt = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  const activeOptional = OPTIONAL_COLS.filter(c => columns[c.key]);
  const gridTemplate = `${"0.8fr ".repeat(activeOptional.length)}1fr 76px 1fr ${"0.8fr ".repeat(activeOptional.length)}`.trim();

  const cursorPoint = useMemo(() => {
    if (!chainMeta || miniChart.length === 0) return null;
    return miniChart.reduce((best, c) =>
      Math.abs(c.t - chainMeta.savedAt) < Math.abs(best.t - chainMeta.savedAt) ? c : best
    );
  }, [chainMeta, miniChart]);

  const wfChartData = useMemo(() => {
    if (!wfResult) return [];
    return wfResult.equity_curve.map(p => ({
      time: new Date(p.t * 1000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      pnl : p.pnl,
    }));
  }, [wfResult]);

  const hasData = expiries.length > 0;

  return (
    <Card title="Historical Option Chain (Replay)" extra={<ChainColumnToggle />}>
      <div className="space-y-3">
        <div className="text-sm" style={{ color: theme.text.faint }}>
          Real archived data, captured every ~5 min. Step through time with the timeframe + ◀/▶ controls, or hit ▶
          Auto-play to replay the day. Tap <b style={{ color: theme.accent.green }}>B</b>/<b style={{ color: theme.accent.red }}>S</b> to
          send a strike to the leg Builder above.
        </div>

        {/* Symbol */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${theme.border.subtle}` }}>
          {SYMBOLS.map(s => (
            <button key={s} onClick={() => setSymbol(s)}
              className="flex-1 py-1.5 text-sm font-bold"
              style={{ background: symbol === s ? theme.accent.cyan : theme.bg.surfaceAlt, color: symbol === s ? theme.bg.page : theme.text.muted }}>
              {s}
            </button>
          ))}
        </div>

        {!hasData ? (
          <div className="text-center py-8" style={{ color: theme.text.muted }}>
            <div className="text-2xl mb-1">📭</div>
            <div className="text-sm">No archived data yet for {symbol} — check back after market hours today</div>
          </div>
        ) : (
          <>
            {/* Expiry */}
            <div>
              <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Expiry contract</div>
              <div className="flex flex-wrap gap-1">
                {expiries.map(e => (
                  <button key={e} onClick={() => setExpiry(e)}
                    className="px-3 py-1.5 rounded-lg text-sm font-bold"
                    style={{
                      background: expiry === e ? theme.accent.green : theme.bg.surfaceAlt,
                      color     : expiry === e ? theme.bg.page : theme.text.muted,
                      border    : `1px solid ${theme.border.subtle}`,
                    }}>
                    {fmtDateLabel(e)}
                  </button>
                ))}
              </div>
            </div>

            {/* Timeframe granularity */}
            <div>
              <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Step size</div>
              <div className="flex flex-wrap gap-1">
                {TIMEFRAMES.map(tf => (
                  <button key={tf.key} onClick={() => setResolution(tf.key)}
                    className="px-3 py-1.5 rounded-lg text-sm font-bold"
                    style={{
                      background: resolution === tf.key ? theme.accent.purple : theme.bg.surfaceAlt,
                      color     : resolution === tf.key ? theme.bg.page : theme.text.muted,
                      border    : `1px solid ${theme.border.subtle}`,
                    }}>
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Jump to date */}
            <div className="flex items-center gap-2">
              <Calendar size={16} color={theme.text.muted} />
              <select value={dateIdx} onChange={e => setDateIdx(Number(e.target.value))}
                className="flex-1 px-2 py-1.5 rounded-lg text-sm outline-none"
                style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color: theme.text.secondary }}>
                {dates.map((d, i) => <option key={d} value={i}>{fmtDateLabel(d)}</option>)}
              </select>
            </div>

            {/* Current position + Forward/Reverse */}
            <div className="rounded-xl p-3" style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}` }}>
              <div className="text-center text-sm mb-2" style={{ color: theme.text.muted }}>
                Viewing: <span style={{ color: theme.accent.cyan, fontWeight: 700 }}>
                  {chainMeta ? fmtTime(chainMeta.savedAt) : "..."}
                </span>
                {chainMeta && <span> • Spot ₹{fmt(chainMeta.spot)}</span>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => step(-1)}
                  className="py-2 rounded-lg flex items-center justify-center gap-1 text-sm font-bold"
                  style={{ background: theme.border.subtle, color: theme.text.secondary }}>
                  <ChevronLeft size={16} /> Reverse
                </button>
                <button onClick={() => setIsPlaying(p => !p)}
                  className="py-2 rounded-lg flex items-center justify-center gap-1 text-sm font-bold"
                  style={{ background: isPlaying ? theme.accent.red + "20" : theme.accent.green + "20", color: isPlaying ? theme.accent.red : theme.accent.green }}>
                  {isPlaying ? <><Pause size={16} /> Pause</> : <><Play size={16} /> Auto-play</>}
                </button>
                <button onClick={() => step(1)}
                  className="py-2 rounded-lg flex items-center justify-center gap-1 text-sm font-bold"
                  style={{ background: theme.border.subtle, color: theme.text.secondary }}>
                  Forward <ChevronRight size={16} />
                </button>
              </div>

              {/* Speed control */}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm" style={{ color: theme.text.muted }}>Speed:</span>
                {SPEEDS.map(sp => (
                  <button key={sp} onClick={() => setSpeed(sp)}
                    className="px-2 py-1 rounded text-sm font-bold"
                    style={{
                      background: speed === sp ? theme.accent.orange : theme.bg.surface,
                      color     : speed === sp ? theme.bg.page : theme.text.muted,
                    }}>
                    {sp}x
                  </button>
                ))}
              </div>
            </div>

            {/* Mini price chart with position marker */}
            {miniChart.length > 0 && (
              <ResponsiveContainer width="100%" height={90}>
                <AreaChart data={miniChart}>
                  <defs>
                    <linearGradient id="miniGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={theme.accent.cyan} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={theme.accent.cyan} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: theme.text.faint, fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis hide domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="close" stroke={theme.accent.cyan} strokeWidth={1.5} fill="url(#miniGrad)" dot={false} />
                  {cursorPoint && (
                    <ReferenceDot x={cursorPoint.date} y={cursorPoint.close} r={5} fill={theme.accent.orange} stroke={theme.bg.page} />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            )}

            {loading && <Loader text="Loading snapshot..." />}
            {error && <ErrorBox message="Failed to load this snapshot" />}
            {legMsg && (
              <div className="text-sm text-center py-1.5 rounded-lg" style={{ background: theme.accent.green + "15", color: theme.accent.green }}>
                {legMsg}
              </div>
            )}

            {chainData && (
              <>
                {activeOptional.length > 0 && (
                  <div className="grid text-center px-1 font-semibold sticky top-0"
                    style={{ gridTemplateColumns: gridTemplate, fontSize: 10, color: theme.text.faint, background: theme.bg.surfaceAlt }}>
                    {activeOptional.map(c => <div key={c.key} style={{ color: theme.accent.green }}>CE {CHAIN_COLUMN_LABELS[c.key]}</div>)}
                    <div style={{ color: theme.accent.green }}>CE LTP</div>
                    <div style={{ color: theme.accent.cyan }}>STRIKE</div>
                    <div style={{ color: theme.accent.red }}>PE LTP</div>
                    {activeOptional.map(c => <div key={c.key} style={{ color: theme.accent.red }}>PE {CHAIN_COLUMN_LABELS[c.key]}</div>)}
                  </div>
                )}
                <div className="max-h-[380px] overflow-y-auto space-y-0.5 pr-1">
                  {chainData.map((row, i) => (
                    <div key={i} className="grid text-center rounded-md"
                      style={{
                        gridTemplateColumns: gridTemplate,
                        background : row.atm ? theme.accent.cyan + "12" : i % 2 === 0 ? theme.bg.surface : theme.bg.surfaceAlt,
                        border     : row.atm ? `1px solid ${theme.accent.cyan}40` : "1px solid transparent",
                        padding    : "6px 2px", fontSize: 12,
                      }}>
                      {activeOptional.map(c => {
                        const v = (row as any)[`ce_${c.field}`];
                        return <div key={c.key} style={{ color: theme.text.faint }}>{v != null ? c.fmt(v) : "-"}</div>;
                      })}
                      <div>
                        <div style={{ color: theme.accent.green, fontWeight: row.atm ? 800 : 600 }}>₹{fmt(row.ce_ltp)}</div>
                        {row.ce_ltp != null && (
                          <div className="flex gap-1 justify-center mt-0.5">
                            <button onClick={() => handleAddLeg(row, "CE", "BUY")} className="text-xs px-1.5 rounded font-bold" style={{ background: theme.accent.green + "20", color: theme.accent.green }}>B</button>
                            <button onClick={() => handleAddLeg(row, "CE", "SELL")} className="text-xs px-1.5 rounded font-bold" style={{ background: theme.accent.red + "20", color: theme.accent.red }}>S</button>
                          </div>
                        )}
                      </div>
                      <div style={{ color: row.atm ? theme.accent.cyan : theme.text.secondary, fontWeight: 700, background: row.atm ? theme.accent.cyan + "15" : "none", borderRadius: 4 }}>{row.strike}</div>
                      <div>
                        <div style={{ color: theme.accent.red, fontWeight: row.atm ? 800 : 600 }}>₹{fmt(row.pe_ltp)}</div>
                        {row.pe_ltp != null && (
                          <div className="flex gap-1 justify-center mt-0.5">
                            <button onClick={() => handleAddLeg(row, "PE", "BUY")} className="text-xs px-1.5 rounded font-bold" style={{ background: theme.accent.green + "20", color: theme.accent.green }}>B</button>
                            <button onClick={() => handleAddLeg(row, "PE", "SELL")} className="text-xs px-1.5 rounded font-bold" style={{ background: theme.accent.red + "20", color: theme.accent.red }}>S</button>
                          </div>
                        )}
                      </div>
                      {activeOptional.map(c => {
                        const v = (row as any)[`pe_${c.field}`];
                        return <div key={c.key} style={{ color: theme.text.faint }}>{v != null ? c.fmt(v) : "-"}</div>;
                      })}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── Real Walk-Forward Backtest ── */}
            {legs.length > 0 && chainMeta && (
              <div className="rounded-xl p-3 space-y-2" style={{ background: theme.bg.surface, border: `1px solid ${theme.accent.orange}40` }}>
                <div className="flex items-center gap-2 text-sm font-bold" style={{ color: theme.accent.orange }}>
                  <TrendingUp size={16} /> Walk-Forward Backtest (real data, not simulated)
                </div>
                <div className="text-sm" style={{ color: theme.text.faint }}>
                  Replays your {legs.length}-leg Builder strategy forward from <b style={{ color: theme.accent.cyan }}>{fmtTime(chainMeta.savedAt)}</b>,
                  using the actual archived LTPs for each strike, applying SL/Target.
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-sm mb-1" style={{ color: theme.text.muted }}>SL % (of entry premium)</div>
                    <input type="number" min={1} max={500} value={wfSlPct}
                      onChange={e => setWfSlPct(Number(e.target.value))}
                      className="w-full px-2 py-1.5 rounded-lg text-sm outline-none text-center"
                      style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}`, color: theme.accent.red }} />
                  </div>
                  <div>
                    <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Target %</div>
                    <input type="number" min={1} max={500} value={wfTgtPct}
                      onChange={e => setWfTgtPct(Number(e.target.value))}
                      className="w-full px-2 py-1.5 rounded-lg text-sm outline-none text-center"
                      style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}`, color: theme.accent.green }} />
                  </div>
                </div>
                <button onClick={runWalkForward}
                  disabled={wfLoading}
                  className="w-full py-2 rounded-lg text-sm font-black"
                  style={{ background: theme.accent.orange, color: theme.bg.page, opacity: wfLoading ? 0.7 : 1 }}>
                  {wfLoading ? "Running..." : "▶ Run Walk-Forward Backtest"}
                </button>

                {wfError && <ErrorBox message={wfError} />}

                {wfResult && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg p-2 text-center" style={{ background: theme.bg.surfaceAlt }}>
                        <div className="text-sm" style={{ color: theme.text.muted }}>Exit Reason</div>
                        <div className="text-sm font-bold" style={{ color: wfResult.exit.reason === "SL Hit" ? theme.accent.red : wfResult.exit.reason === "Target Hit" ? theme.accent.green : theme.text.secondary }}>
                          {wfResult.exit.reason}
                        </div>
                      </div>
                      <div className="rounded-lg p-2 text-center" style={{ background: theme.bg.surfaceAlt }}>
                        <div className="text-sm" style={{ color: theme.text.muted }}>Final P&L</div>
                        <div className="text-sm font-bold" style={{ color: wfResult.final_pnl >= 0 ? theme.accent.green : theme.accent.red }}>
                          {wfResult.final_pnl >= 0 ? "+" : ""}₹{fmt(wfResult.final_pnl)}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-center" style={{ color: theme.text.faint }}>
                      Entry {fmtTime(wfResult.entry.t)} → Exit {fmtTime(wfResult.exit.t)} • {wfResult.snapshots_used} snapshots
                    </div>
                    {wfChartData.length > 1 && (
                      <ResponsiveContainer width="100%" height={120}>
                        <AreaChart data={wfChartData}>
                          <defs>
                            <linearGradient id="wfGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={theme.accent.orange} stopOpacity={0.3} />
                              <stop offset="95%" stopColor={theme.accent.orange} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="time" tick={{ fill: theme.text.faint, fontSize: 9 }} axisLine={false} tickLine={false} />
                          <YAxis hide />
                          <Tooltip contentStyle={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}`, borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`₹${fmt(v)}`, "P&L"]} />
                          <ReferenceLine y={0} stroke={theme.text.faint} strokeDasharray="3 3" />
                          <Area type="monotone" dataKey="pnl" stroke={theme.accent.orange} strokeWidth={2} fill="url(#wfGrad)" dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
