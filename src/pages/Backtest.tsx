import { useState, useEffect } from "react";
import { runBacktest, fetchHistorical, fetchHistoricalChain, fetchArchivedChain, fetchArchivedDates, type Timeframe, type HistoricalChainRow, type ArchivedChainRow } from "../utils/api";
import Card from "../components/ui/Card";
import Loader from "../components/ui/Loader";
import ErrorBox from "../components/ui/ErrorBox";
import ChainColumnToggle from "../components/ui/ChainColumnToggle";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useTheme } from "../store/themeStore";
import { useChainColumnsStore } from "../store/chainColumnsStore";
import type { Theme } from "../styles/theme";

const STRATEGIES = [
  { key: "straddle",   label: "Short Straddle"  },
  { key: "strangle",   label: "Short Strangle"  },
  { key: "ironCondor", label: "Iron Condor"      },
  { key: "longCall",   label: "Long Call"        },
  { key: "longPut",    label: "Long Put"         },
];

const SYMBOLS = ["NIFTY", "BANKNIFTY"];

// Matches backend/validators.py RESOLUTION_MAP + MAX_DAYS_BY_RESOLUTION
const TIMEFRAMES: { key: Timeframe; label: string; maxDays: number }[] = [
  { key: "5m",  label: "5 Min",  maxDays: 30  },
  { key: "15m", label: "15 Min", maxDays: 60  },
  { key: "30m", label: "30 Min", maxDays: 90  },
  { key: "1h",  label: "1 Hour", maxDays: 180 },
  { key: "2h",  label: "2 Hour", maxDays: 270 },
  { key: "1d",  label: "1 Day",  maxDays: 365 },
];

// Optional columns shown on both CE and PE sides (LTP + Strike are always shown)
const OPTIONAL_COLS: { key: "oi" | "iv" | "delta" | "gamma" | "theta" | "vega"; fmt: (n: number) => string }[] = [
  { key: "oi",    fmt: (n) => (n / 100000).toFixed(1) + "L" },
  { key: "iv",    fmt: (n) => n.toFixed(1) + "%" },
  { key: "delta", fmt: (n) => n.toFixed(2) },
  { key: "gamma", fmt: (n) => n.toFixed(4) },
  { key: "theta", fmt: (n) => n.toFixed(1) },
  { key: "vega",  fmt: (n) => n.toFixed(1) },
];

function StatBox({ label, value, color, theme }: { label: string; value: string; color: string; theme: Theme }) {
  return (
    <div className="rounded-xl p-3 text-center"
      style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}` }}>
      <div className="text-sm mb-1" style={{ color: theme.text.muted }}>{label}</div>
      <div className="text-sm font-black" style={{ color }}>{value}</div>
    </div>
  );
}

function DataSourceBadge({ source, theme }: { source?: "LIVE" | "MOCK"; theme: Theme }) {
  if (!source) return null;
  const isLive = source === "LIVE";
  return (
    <span className="text-sm px-2 py-0.5 rounded font-bold flex items-center gap-1"
      style={{
        background: isLive ? theme.accent.green + "20" : theme.accent.orange + "20",
        color     : isLive ? theme.accent.green : theme.accent.orange,
      }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: isLive ? theme.accent.green : theme.accent.orange }} />
      {isLive ? "LIVE historical data" : "MOCK historical data"}
    </span>
  );
}

type Mode = "single" | "compare" | "historical";
type AnyChainRow = HistoricalChainRow | ArchivedChainRow;

export default function Backtest() {
  const theme = useTheme();
  const { columns } = useChainColumnsStore();
  const COLORS = [theme.accent.cyan, theme.accent.orange, theme.accent.purple, theme.accent.red, theme.accent.green];

  const [mode, setMode] = useState<Mode>("single");

  // Shared params
  const [symbol,     setSymbol]     = useState("NIFTY");
  const [resolution, setResolution] = useState<Timeframe>("1d");
  const [days,       setDays]       = useState(90);
  const [slPct,      setSlPct]      = useState(50);
  const [tgtPct,     setTgtPct]     = useState(50);
  const [lotSize,    setLotSize]    = useState(50);

  const activeTf = TIMEFRAMES.find(t => t.key === resolution)!;

  // Clamp days whenever timeframe changes, so intraday timeframes don't request absurd ranges
  useEffect(() => {
    setDays(d => Math.min(d, activeTf.maxDays));
  }, [resolution]);

  // Dates that have REAL saved option-chain snapshots (auto-captured every ~5 min)
  const [archivedDates, setArchivedDates] = useState<string[]>([]);
  useEffect(() => {
    fetchArchivedDates(symbol).then(r => setArchivedDates(r.dates ?? [])).catch(() => setArchivedDates([]));
  }, [symbol]);

  // Single mode
  const [strategy, setStrategy] = useState("ironCondor");
  const [data, setData]         = useState<any>(null);
  const [isPending, setIsPending] = useState(false);
  const [isError, setIsError]     = useState(false);

  const runSingle = async () => {
    setIsPending(true); setIsError(false); setData(null);
    try {
      const res = await runBacktest({ symbol, strategy, days, resolution, sl_pct: slPct, tgt_pct: tgtPct, lot_size: lotSize });
      setData(res);
    } catch {
      setIsError(true);
    } finally {
      setIsPending(false);
    }
  };

  // Compare mode
  const [selected, setSelected] = useState<string[]>(["ironCondor", "straddle"]);
  const [compareResults, setCompareResults] = useState<any[] | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [compareError, setCompareError] = useState(false);

  const toggleSelected = (key: string) => {
    setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const runCompare = async () => {
    if (selected.length < 2) return;
    setIsComparing(true); setCompareError(false); setCompareResults(null);
    try {
      const results = await Promise.all(
        selected.map(async key => {
          const res = await runBacktest({ symbol, strategy: key, days, resolution, sl_pct: slPct, tgt_pct: tgtPct, lot_size: lotSize });
          const label = STRATEGIES.find(s => s.key === key)?.label ?? key;
          return { key, label, data: res };
        })
      );
      setCompareResults(results);
    } catch {
      setCompareError(true);
    } finally {
      setIsComparing(false);
    }
  };

  // Historical data mode
  const [histData, setHistData]       = useState<any>(null);
  const [histLoading, setHistLoading] = useState(false);
  const [histError, setHistError]     = useState(false);

  const loadHistorical = async () => {
    setHistLoading(true); setHistError(false); setHistData(null);
    setChainData(null); setChainError(false);
    try {
      const res = await fetchHistorical(symbol, days, resolution);
      setHistData(res);
      setCandleIdx(res.candles.length > 0 ? res.candles.length - 1 : 0);
    } catch {
      setHistError(true);
    } finally {
      setHistLoading(false);
    }
  };

  // Historical option chain — either reconstructed (Black-Scholes) or real saved/archived data
  const [candleIdx, setCandleIdx]     = useState(0);
  const [chainIv, setChainIv]         = useState(15);
  const [chainDte, setChainDte]       = useState(7);
  const [chainData, setChainData]     = useState<any>(null);
  const [chainIsReal, setChainIsReal] = useState(false);
  const [chainLoading, setChainLoading] = useState(false);
  const [chainError, setChainError]     = useState(false);

  const selectedCandle = histData?.candles?.[candleIdx];
  const selectedDateStr = selectedCandle
    ? new Date(selectedCandle.t * 1000).toISOString().slice(0, 10)
    : "";
  const hasRealData = archivedDates.includes(selectedDateStr);

  const loadHistoricalChain = async () => {
    const candle = histData?.candles?.[candleIdx];
    if (!candle) return;
    setChainLoading(true); setChainError(false); setChainData(null); setChainIsReal(false);
    try {
      const label = isIntradayGlobal(resolution)
        ? new Date(candle.t * 1000).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
        : new Date(candle.t * 1000).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      const res = await fetchHistoricalChain({
        symbol, spot: candle.close, iv: chainIv, daysToExpiry: chainDte, strikecount: 8, label,
      });
      setChainData(res);
    } catch {
      setChainError(true);
    } finally {
      setChainLoading(false);
    }
  };

  const loadRealArchivedChain = async () => {
    if (!selectedDateStr) return;
    setChainLoading(true); setChainError(false); setChainData(null); setChainIsReal(true);
    try {
      const res = await fetchArchivedChain(symbol, selectedDateStr);
      setChainData(res);
    } catch {
      setChainError(true);
    } finally {
      setChainLoading(false);
    }
  };

  function isIntradayGlobal(r: Timeframe) { return r !== "1d"; }

  const s = data?.summary;
  const fmt    = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;

  // Build merged chart data for compare mode: index-based (trade sequence), not date-based
  const compareChartData = (() => {
    if (!compareResults) return [];
    const maxLen = Math.max(...compareResults.map(r => r.data.equity_curve?.length ?? 0));
    const rows: any[] = [];
    for (let i = 0; i < maxLen; i++) {
      const row: any = { i };
      compareResults.forEach(r => {
        row[r.key] = r.data.equity_curve?.[i]?.equity ?? null;
      });
      rows.push(row);
    }
    return rows;
  })();

  // Historical candles → chart-friendly rows (include time for intraday timeframes)
  const isIntraday = resolution !== "1d";
  const histChartData = (histData?.candles ?? []).map((c: any) => ({
    date : isIntraday
      ? new Date(c.t * 1000).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
      : new Date(c.t * 1000).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    close: c.close,
    high : c.high,
    low  : c.low,
  }));

  const histStats = histChartData.length > 0 ? {
    first: histChartData[0].close,
    last : histChartData[histChartData.length - 1].close,
    high : Math.max(...histChartData.map((c: any) => c.high)),
    low  : Math.min(...histChartData.map((c: any) => c.low)),
  } : null;
  const histChangePct = histStats ? ((histStats.last - histStats.first) / histStats.first) * 100 : 0;

  // Column config for the option-chain table — OI only makes sense for real data (reconstructed has none)
  const activeOptional = OPTIONAL_COLS.filter(c => columns[c.key] && (c.key !== "oi" || chainIsReal));
  const gridTemplate = `${"0.8fr ".repeat(activeOptional.length)}1fr 76px 1fr ${"0.8fr ".repeat(activeOptional.length)}`.trim();

  return (
    <div className="p-4 space-y-4">

      {/* Mode toggle */}
      <div className="flex gap-1">
        <button onClick={() => setMode("single")}
          className="flex-1 py-2 rounded-xl text-sm font-bold"
          style={{
            background: mode === "single" ? theme.accent.cyan : theme.bg.surfaceAlt,
            color     : mode === "single" ? theme.bg.page : theme.text.muted,
            border    : `1px solid ${theme.border.subtle}`,
          }}>
          Single Backtest
        </button>
        <button onClick={() => setMode("compare")}
          className="flex-1 py-2 rounded-xl text-sm font-bold"
          style={{
            background: mode === "compare" ? theme.accent.cyan : theme.bg.surfaceAlt,
            color     : mode === "compare" ? theme.bg.page : theme.text.muted,
            border    : `1px solid ${theme.border.subtle}`,
          }}>
          Compare Strategies
        </button>
        <button onClick={() => setMode("historical")}
          className="flex-1 py-2 rounded-xl text-sm font-bold"
          style={{
            background: mode === "historical" ? theme.accent.cyan : theme.bg.surfaceAlt,
            color     : mode === "historical" ? theme.bg.page : theme.text.muted,
            border    : `1px solid ${theme.border.subtle}`,
          }}>
          Historical Data
        </button>
      </div>

      {/* Symbol + Timeframe — shared across all modes */}
      <Card title="Symbol & Timeframe">
        <div className="space-y-3">
          <div>
            <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Symbol</div>
            <div className="flex rounded-lg overflow-hidden"
              style={{ border: `1px solid ${theme.border.subtle}` }}>
              {SYMBOLS.map(sym => (
                <button key={sym} onClick={() => setSymbol(sym)}
                  className="flex-1 py-1.5 text-sm font-bold"
                  style={{
                    background: symbol === sym ? theme.accent.cyan : theme.bg.surfaceAlt,
                    color     : symbol === sym ? theme.bg.page : theme.text.muted,
                  }}>
                  {sym}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm mb-1" style={{ color: theme.text.muted }}>
              Timeframe <span style={{ color: theme.text.faint }}>(max {activeTf.maxDays}d lookback)</span>
            </div>
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

          {archivedDates.length > 0 && (
            <div className="text-sm px-2 py-1.5 rounded-lg flex items-center gap-1"
              style={{ background: theme.accent.green + "15", color: theme.accent.green }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: theme.accent.green }} />
              {archivedDates.length} date{archivedDates.length > 1 ? "s" : ""} of REAL saved option-chain data available (since TradePro started archiving)
            </div>
          )}
        </div>
      </Card>

      {/* ── HISTORICAL DATA MODE ── */}
      {mode === "historical" && (
        <>
          <Card title="Load Historical Data">
            <div className="space-y-3">
              <div>
                <div className="text-sm mb-1" style={{ color: theme.text.muted }}>
                  Days: <span style={{ color: theme.accent.cyan }}>{days}</span>
                </div>
                <input type="range" min={1} max={activeTf.maxDays} value={days}
                  onChange={e => setDays(Number(e.target.value))}
                  className="w-full" />
              </div>
              <button onClick={loadHistorical}
                disabled={histLoading}
                className="w-full py-2.5 rounded-xl text-sm font-black"
                style={{ background: theme.accent.cyan, color: theme.bg.page, opacity: histLoading ? 0.7 : 1 }}>
                {histLoading ? "Loading..." : `▶ Load ${symbol} • ${activeTf.label}`}
              </button>
            </div>
          </Card>

          {histLoading && <Loader text="Fetching historical candles..." />}
          {histError   && <ErrorBox message="Failed to load historical data" />}

          {histData && histStats && (
            <>
              <div className="flex justify-end">
                <DataSourceBadge source={histData.mock ? "MOCK" : "LIVE"} theme={theme} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <StatBox theme={theme} label={`${symbol} — start`}  value={`₹${fmt(histStats.first)}`} color={theme.text.secondary} />
                <StatBox theme={theme} label={`${symbol} — latest`} value={`₹${fmt(histStats.last)}`}  color={theme.accent.cyan} />
                <StatBox theme={theme} label="Period High"          value={`₹${fmt(histStats.high)}`}  color={theme.accent.green} />
                <StatBox theme={theme} label="Period Low"           value={`₹${fmt(histStats.low)}`}   color={theme.accent.red} />
              </div>

              <div className="rounded-xl p-3 text-center"
                style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}` }}>
                <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Change over period</div>
                <div className="text-xl font-black"
                  style={{ color: histChangePct >= 0 ? theme.accent.green : theme.accent.red }}>
                  {histChangePct >= 0 ? "+" : ""}{histChangePct.toFixed(2)}%
                </div>
              </div>

              <Card title={`${symbol} • ${activeTf.label} Price History (${histChartData.length} candles)`}>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={histChartData}>
                    <defs>
                      <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={theme.accent.cyan} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={theme.accent.cyan} stopOpacity={0}   />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={theme.border.subtle} strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fill: theme.text.muted, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis domain={["auto", "auto"]} tick={{ fill: theme.text.muted, fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(1)}k`} axisLine={false} tickLine={false} width={44} />
                    <Tooltip contentStyle={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, borderRadius: 8, fontSize: 13 }} formatter={(v: number) => [`₹${fmt(v)}`, "Close"]} />
                    <Area type="monotone" dataKey="close" stroke={theme.accent.cyan} strokeWidth={2} fill="url(#histGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              {/* ── Historical Option Chain ── */}
              <Card title="Historical Option Chain" extra={<ChainColumnToggle />}>
                <div className="space-y-3">
                  <div className="text-sm" style={{ color: theme.text.faint }}>
                    Fyers doesn't provide real historical option-chain quotes for expired contracts. For dates
                    TradePro was running (auto-saved every ~5 min), you'll see a "Load REAL saved chain" option below,
                    complete with IV and Greeks backed out from the real LTP. For older dates, only a Black-Scholes
                    reconstruction is possible. Use the columns icon above to show/hide OI, IV, Delta, Gamma, Theta, Vega.
                  </div>

                  <div>
                    <div className="text-sm mb-1" style={{ color: theme.text.muted }}>
                      Pick a candle: <span style={{ color: theme.accent.cyan }}>{histChartData[candleIdx]?.date}</span> • Spot ₹{fmt(histData.candles[candleIdx]?.close ?? 0)}
                      {hasRealData && (
                        <span className="ml-2 px-1.5 py-0.5 rounded font-bold" style={{ background: theme.accent.green + "20", color: theme.accent.green }}>
                          REAL DATA AVAILABLE
                        </span>
                      )}
                    </div>
                    <input type="range" min={0} max={Math.max(histData.candles.length - 1, 0)} value={candleIdx}
                      onChange={e => setCandleIdx(Number(e.target.value))}
                      className="w-full" />
                  </div>

                  {hasRealData && (
                    <button onClick={loadRealArchivedChain}
                      disabled={chainLoading}
                      className="w-full py-2 rounded-lg text-sm font-black"
                      style={{ background: theme.accent.green, color: theme.bg.page, opacity: chainLoading ? 0.7 : 1 }}>
                      {chainLoading ? "Loading..." : "✓ Load REAL saved chain for this date"}
                    </button>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Assumed IV %</div>
                      <input type="number" min={1} max={100} value={chainIv}
                        onChange={e => setChainIv(Number(e.target.value))}
                        className="w-full px-2 py-1.5 rounded-lg text-sm outline-none text-center"
                        style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color: theme.accent.purple }} />
                    </div>
                    <div>
                      <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Days to Expiry</div>
                      <input type="number" min={1} max={90} value={chainDte}
                        onChange={e => setChainDte(Number(e.target.value))}
                        className="w-full px-2 py-1.5 rounded-lg text-sm outline-none text-center"
                        style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color: theme.accent.orange }} />
                    </div>
                  </div>

                  <button onClick={loadHistoricalChain}
                    disabled={chainLoading}
                    className="w-full py-2 rounded-lg text-sm font-black"
                    style={{ background: theme.accent.purple, color: theme.bg.page, opacity: chainLoading ? 0.7 : 1 }}>
                    {chainLoading ? "Building chain..." : "▶ View Reconstructed Chain (Black-Scholes)"}
                  </button>

                  {chainError && <ErrorBox message="Failed to load option chain for this date" />}

                  {chainData && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm px-1">
                        <span style={{ color: theme.text.muted }}>{chainIsReal ? chainData.date : chainData.label}</span>
                        <span className="px-2 py-0.5 rounded font-bold"
                          style={{
                            background: chainIsReal ? theme.accent.green + "20" : theme.accent.orange + "20",
                            color     : chainIsReal ? theme.accent.green : theme.accent.orange,
                          }}>
                          {chainIsReal ? "✓ REAL saved data" : "Reconstructed (Black-Scholes)"}
                        </span>
                      </div>

                      {chainIsReal && (chainData.data.expiryData as ArchivedChainRow[]).some(r => r.ce_iv != null) && (
                        <div className="text-sm px-1" style={{ color: theme.text.faint }}>
                          IV/Greeks assume {chainData.days_to_expiry_used ?? 7}d to expiry (nearest weekly contract) — real LTP/OI is exact.
                        </div>
                      )}

                      {activeOptional.length > 0 && (
                        <div className="grid text-center px-1 font-semibold"
                          style={{ gridTemplateColumns: gridTemplate, fontSize: 10, color: theme.text.faint }}>
                          {activeOptional.map(c => <div key={c.key} style={{ color: theme.accent.green }}>CE {c.key.toUpperCase()}</div>)}
                          <div style={{ color: theme.accent.green }}>CE LTP</div>
                          <div style={{ color: theme.accent.cyan  }}>STRIKE</div>
                          <div style={{ color: theme.accent.red   }}>PE LTP</div>
                          {activeOptional.map(c => <div key={c.key} style={{ color: theme.accent.red }}>PE {c.key.toUpperCase()}</div>)}
                        </div>
                      )}

                      {(chainData.data.expiryData as AnyChainRow[]).map((row, i) => (
                        <div key={i} className="grid text-center rounded-md"
                          style={{
                            gridTemplateColumns: gridTemplate,
                            background : row.atm ? theme.accent.cyan + "12" : i % 2 === 0 ? theme.bg.surface : theme.bg.surfaceAlt,
                            border     : row.atm ? `1px solid ${theme.accent.cyan}40` : "1px solid transparent",
                            padding    : "6px 2px",
                            fontSize   : 12,
                          }}>
                          {activeOptional.map(c => {
                            const v = (row as any)[`ce_${c.key}`];
                            return <div key={c.key} style={{ color: theme.text.faint }}>{v != null ? c.fmt(v) : "-"}</div>;
                          })}
                          <div style={{ color: theme.accent.green, fontWeight: row.atm ? 800 : 600 }}>₹{fmt(row.ce_ltp)}</div>
                          <div style={{
                            color: row.atm ? theme.accent.cyan : theme.text.secondary, fontWeight: 700,
                            background: row.atm ? theme.accent.cyan + "15" : "none", borderRadius: 4,
                          }}>{row.strike}</div>
                          <div style={{ color: theme.accent.red, fontWeight: row.atm ? 800 : 600 }}>₹{fmt(row.pe_ltp)}</div>
                          {activeOptional.map(c => {
                            const v = (row as any)[`pe_${c.key}`];
                            return <div key={c.key} style={{ color: theme.text.faint }}>{v != null ? c.fmt(v) : "-"}</div>;
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </>
          )}

          {!histData && !histLoading && (
            <div className="text-center py-16" style={{ color: theme.text.muted }}>
              <div className="text-4xl mb-3">📅</div>
              <div className="text-sm">Load {activeTf.label} candles for {symbol}</div>
              <div className="text-sm mt-1" style={{ color: theme.text.faint }}>Same data feeds the backtest engine</div>
            </div>
          )}
        </>
      )}

      {/* Shared params — single/compare */}
      {mode !== "historical" && (
        <Card title="Backtest Configuration">
          <div className="space-y-3">

            {mode === "single" && (
              <div>
                <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Strategy</div>
                <div className="flex flex-wrap gap-1">
                  {STRATEGIES.map(st => (
                    <button key={st.key} onClick={() => setStrategy(st.key)}
                      className="px-3 py-1.5 rounded-lg text-sm font-bold"
                      style={{
                        background: strategy === st.key ? theme.accent.cyan : theme.bg.surfaceAlt,
                        color     : strategy === st.key ? theme.bg.page : theme.text.muted,
                        border    : `1px solid ${theme.border.subtle}`,
                      }}>
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === "compare" && (
              <div>
                <div className="text-sm mb-1" style={{ color: theme.text.muted }}>
                  Select 2+ strategies to compare
                </div>
                <div className="flex flex-wrap gap-1">
                  {STRATEGIES.map((st, i) => {
                    const on = selected.includes(st.key);
                    return (
                      <button key={st.key} onClick={() => toggleSelected(st.key)}
                        className="px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1"
                        style={{
                          background: on ? `${COLORS[i % COLORS.length]}20` : theme.bg.surfaceAlt,
                          color     : on ? COLORS[i % COLORS.length] : theme.text.muted,
                          border    : `1px solid ${on ? COLORS[i % COLORS.length] : theme.border.subtle}`,
                        }}>
                        {on && <span style={{ width: 6, height: 6, borderRadius: 99, background: COLORS[i % COLORS.length] }} />}
                        {st.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Days",     value: days,    setter: setDays,    min: 1,   max: activeTf.maxDays },
                { label: "SL %",     value: slPct,   setter: setSlPct,   min: 10,  max: 200 },
                { label: "Target %", value: tgtPct,  setter: setTgtPct,  min: 10,  max: 200 },
                { label: "Lot Size", value: lotSize, setter: setLotSize, min: 1,   max: 500 },
              ].map(({ label, value, setter, min, max }) => (
                <div key={label}>
                  <div className="text-sm mb-1" style={{ color: theme.text.muted }}>{label}: <span style={{ color: theme.accent.cyan }}>{value}</span></div>
                  <input type="range" min={min} max={max} value={value}
                    onChange={e => setter(Number(e.target.value))}
                    className="w-full" />
                </div>
              ))}
            </div>

            {mode === "single" ? (
              <button onClick={runSingle}
                disabled={isPending}
                className="w-full py-2.5 rounded-xl text-sm font-black"
                style={{ background: theme.accent.cyan, color: theme.bg.page, opacity: isPending ? 0.7 : 1 }}>
                {isPending ? "Running Backtest..." : "▶ Run Backtest"}
              </button>
            ) : (
              <button onClick={runCompare}
                disabled={isComparing || selected.length < 2}
                className="w-full py-2.5 rounded-xl text-sm font-black"
                style={{
                  background: theme.accent.cyan,
                  color     : theme.bg.page,
                  opacity   : (isComparing || selected.length < 2) ? 0.5 : 1,
                }}>
                {isComparing ? "Comparing..." : selected.length < 2 ? "Select 2+ strategies" : "▶ Run Comparison"}
              </button>
            )}
          </div>
        </Card>
      )}

      {/* SINGLE MODE RESULTS */}
      {mode === "single" && (
        <>
          {isPending && <Loader text="Running backtest simulation..." />}
          {isError   && <ErrorBox message="Backtest failed" />}

          {s && (
            <>
              <div className="flex justify-end">
                <DataSourceBadge source={data?.data_source} theme={theme} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <StatBox theme={theme} label="Total Trades" value={`${s.total}`}                          color={theme.text.secondary} />
                <StatBox theme={theme} label="Win Rate"     value={fmtPct(s.win_rate)}                    color={s.win_rate >= 50 ? theme.accent.green : theme.accent.red} />
                <StatBox theme={theme} label="Total P&L"   value={`₹${fmt(s.total_pnl)}`}               color={s.total_pnl >= 0 ? theme.accent.green : theme.accent.red} />
                <StatBox theme={theme} label="Max Drawdown" value={`₹${fmt(Math.abs(s.max_drawdown))}`}  color={theme.accent.red} />
                <StatBox theme={theme} label="Avg Win"      value={`₹${fmt(s.avg_win)}`}                 color={theme.accent.green} />
                <StatBox theme={theme} label="Avg Loss"     value={`₹${fmt(Math.abs(s.avg_loss))}`}      color={theme.accent.red} />
                <StatBox theme={theme} label="Profit Factor" value={`${s.profit_factor}x`}               color={s.profit_factor >= 1 ? theme.accent.green : theme.accent.red} />
                <StatBox theme={theme} label="Sharpe"       value={`${s.sharpe}`}                        color={s.sharpe >= 1 ? theme.accent.green : theme.accent.orange} />
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
                    <Tooltip contentStyle={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, borderRadius: 8, fontSize: 13 }} formatter={(v: number) => [`₹${fmt(v)}`, "Equity"]} />
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
                    <Tooltip contentStyle={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, borderRadius: 8, fontSize: 13 }} formatter={(v: number) => [`₹${fmt(v)}`, "P&L"]} />
                    <ReferenceLine y={0} stroke={theme.text.faint} />
                    <Bar dataKey="pnl" radius={[2, 2, 0, 0]}
                      // @ts-ignore
                      fill={(entry: any) => entry.win ? theme.accent.green : theme.accent.red} />
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
              <div className="text-sm mt-1" style={{ color: theme.text.faint }}>Simulates strategy over historical data</div>
            </div>
          )}
        </>
      )}

      {/* COMPARE MODE RESULTS */}
      {mode === "compare" && (
        <>
          {isComparing  && <Loader text="Running comparison..." />}
          {compareError && <ErrorBox message="Comparison failed" />}

          {compareResults && (
            <>
              <div className="flex justify-end">
                <DataSourceBadge source={compareResults[0]?.data?.data_source} theme={theme} />
              </div>

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
                    <XAxis dataKey="i" tick={{ fill: theme.text.muted, fontSize: 11 }} axisLine={false} tickLine={false} label={{ value: "Trade #", position: "insideBottom", fill: theme.text.muted, fontSize: 11, dy: 10 }} />
                    <YAxis tick={{ fill: theme.text.muted, fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} width={44} />
                    <Tooltip contentStyle={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, borderRadius: 8, fontSize: 13 }} formatter={(v: number) => [`₹${fmt(v)}`, ""]} />
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
              <div className="text-sm mt-1" style={{ color: theme.text.faint }}>See which strategy performed best historically</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
