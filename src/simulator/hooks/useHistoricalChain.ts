/**
 * TradePro Simulator - Historical Option Chain hook
 *
 * This is the exact same state/effects/handlers that used to live inline
 * inside HistoricalOptionChain.tsx — extracted into a hook so the
 * redesigned Simulator layout (separate Replay Control Bar, Walk-Forward
 * Bar, and Option Chain panel, each in different parts of the page) can
 * all share one instance of it. HistoricalOptionChain.tsx itself now just
 * calls this hook internally, so the standalone Backtest page keeps
 * working exactly as before. No calculation/business logic changed.
 *
 * ── Enhancement pass (Historical Context + Snapshot Tools) ────────────────
 * Everything below the original SPEEDS/BASE_INTERVAL_MS constant through
 * the end of the exported hook return is additive: bookmarking, resume-
 * last-session, compare-snapshot mode, market phase, DTE, PCR, and gap%.
 * None of the pre-existing exported fields were renamed, removed, or had
 * their computed values changed — this pass only adds new ones alongside.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  fetchArchivedChain, fetchArchivedDates, fetchArchivedExpiries, fetchArchivedTimes,
  fetchHistorical, runWalkForwardBacktest,
} from "../../utils/api";
import type { ArchivedChainRow, Timeframe, WalkForwardResponse } from "../../utils/api";
import { useSimulatorStore, makeOptionLeg } from "../state/simulatorStore";
import { LOT_SIZES } from "../models/Option";

export const SYMBOLS = ["NIFTY", "BANKNIFTY"] as const;

export const TIMEFRAMES: {
  key: Timeframe; label: string; shortLabel: string; snapshotStep: number | "day";
}[] = [
  { key: "5m",  label: "5 Min",  shortLabel: "5m",  snapshotStep: 1  },
  { key: "15m", label: "15 Min", shortLabel: "15m", snapshotStep: 3  },
  { key: "30m", label: "30 Min", shortLabel: "30m", snapshotStep: 6  },
  { key: "1h",  label: "1 Hour", shortLabel: "1H",  snapshotStep: 12 },
  { key: "2h",  label: "2 Hour", shortLabel: "2H",  snapshotStep: 24 },
  { key: "1d",  label: "1 Day",  shortLabel: "1D",  snapshotStep: "day" },
];

// 0.25× added alongside the existing set — nothing removed, so any code
// (or persisted user preference) referencing the old speed values keeps
// working exactly as before.
export const SPEEDS = [0.25, 0.5, 1, 2, 5, 10] as const;
const BASE_INTERVAL_MS = 3000;

export const OPTIONAL_COLS: { key: string; field: string; fmt: (v: number) => string }[] = [
  { key: "oi",     field: "oi",     fmt: (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v) },
  { key: "volume", field: "volume", fmt: (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v) },
  { key: "iv",     field: "iv",     fmt: (v) => v.toFixed(1) },
  { key: "delta",  field: "delta",  fmt: (v) => v.toFixed(2) },
];

export function fmt(n: number | null | undefined): string {
  if (n == null) return "-";
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function fmtTime(epoch: number): string {
  return new Date(epoch * 1000).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export function fmtDateLabel(d: string): string {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch {
    return d;
  }
}

// ─── Static curated macro-event calendar ──────────────────────────────────
// Expiry-day markers are auto-detected elsewhere from real archived data
// (selectedDate === expiry). RBI/Budget/Results dates have no backend
// endpoint yet, so this is a manually-curated constant — extend as needed.
// Each entry is clearly typed so the UI can label its source honestly
// rather than implying it's live data.
export const EVENT_CALENDAR: { date: string; label: string; type: "RBI" | "BUDGET" | "RESULT" }[] = [
  { date: "2026-02-01", label: "Union Budget", type: "BUDGET" },
  { date: "2026-02-06", label: "RBI Policy",   type: "RBI" },
  { date: "2026-04-09", label: "RBI Policy",   type: "RBI" },
  { date: "2026-06-05", label: "RBI Policy",   type: "RBI" },
  { date: "2026-08-06", label: "RBI Policy",   type: "RBI" },
  { date: "2026-10-08", label: "RBI Policy",   type: "RBI" },
  { date: "2026-12-05", label: "RBI Policy",   type: "RBI" },
];

export function getEventForDate(date: string): { label: string; type: "RBI" | "BUDGET" | "RESULT" } | null {
  return EVENT_CALENDAR.find(e => e.date === date) ?? null;
}

// ─── Bookmarked snapshots — localStorage, same lightweight pattern as
// strategyStorage.ts elsewhere in this codebase ────────────────────────────
export interface SnapshotBookmark {
  id     : string;
  symbol : string;
  expiry : string;
  date   : string;
  time   : number;
  label  : string;
  savedAt: number;
}
const BOOKMARKS_KEY = "tradepro_snapshot_bookmarks";
const LAST_SESSION_KEY = "tradepro_last_session";

function loadBookmarks(): SnapshotBookmark[] {
  try { return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) ?? "[]"); } catch { return []; }
}
function persistBookmarks(list: SnapshotBookmark[]) {
  try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(list)); } catch { /* storage unavailable, non-fatal */ }
}

interface LastSession { symbol: string; expiry: string; date: string; time: number; }
function loadLastSession(): LastSession | null {
  try { return JSON.parse(localStorage.getItem(LAST_SESSION_KEY) ?? "null"); } catch { return null; }
}
function persistLastSession(s: LastSession) {
  try { localStorage.setItem(LAST_SESSION_KEY, JSON.stringify(s)); } catch { /* storage unavailable, non-fatal */ }
}

// ─── Market phase — derived purely from the archived snapshot's clock time
// against NSE's standard cash/derivatives session (09:15–15:30 IST) ───────
export type MarketPhase = "PRE_OPEN" | "OPENING" | "MORNING" | "MIDDAY" | "CLOSING" | "CLOSED";

export function getMarketPhase(epoch: number): MarketPhase {
  const d = new Date(epoch * 1000);
  const mins = d.getHours() * 60 + d.getMinutes();
  if (mins < 9 * 60 + 15) return "PRE_OPEN";
  if (mins < 9 * 60 + 45) return "OPENING";
  if (mins < 12 * 60) return "MORNING";
  if (mins < 14 * 60) return "MIDDAY";
  if (mins <= 15 * 60 + 30) return "CLOSING";
  return "CLOSED";
}

export const MARKET_PHASE_LABEL: Record<MarketPhase, string> = {
  PRE_OPEN: "Pre-Open", OPENING: "Opening", MORNING: "Morning",
  MIDDAY: "Midday", CLOSING: "Closing", CLOSED: "Closed",
};

// ─── Snapshot Score — a lightweight, clearly-labeled heuristic (NOT a
// trading signal) blending PCR and CE/PE IV skew into Bullish/Bearish/
// Neutral, purely to give a quick eyeball read while scrubbing history ────
export type SnapshotBias = "BULLISH" | "BEARISH" | "NEUTRAL";

export function computeSnapshotScore(pcr: number | null, ceIvAtm: number | null, peIvAtm: number | null): SnapshotBias {
  if (pcr == null) return "NEUTRAL";
  let score = 0;
  if (pcr > 1.15) score += 1;
  else if (pcr < 0.85) score -= 1;
  if (ceIvAtm != null && peIvAtm != null) {
    const skew = peIvAtm - ceIvAtm;
    if (skew > 1) score += 1;      // richer puts -> hedging/fear -> mildly bearish tilt handled below
    else if (skew < -1) score -= 1;
  }
  if (score > 0) return "BULLISH";
  if (score < 0) return "BEARISH";
  return "NEUTRAL";
}

export function useHistoricalChain() {
  const { addLeg, legs } = useSimulatorStore();

  const [symbol, setSymbol]         = useState<string>("NIFTY");
  const [resolution, setResolution] = useState<Timeframe>("15m");
  const activeTf = TIMEFRAMES.find(t => t.key === resolution) ?? TIMEFRAMES[1];

  const [expiries, setExpiries] = useState<string[]>([]);
  const [expiry, setExpiry]     = useState("");
  const [dates, setDates]       = useState<string[]>([]);
  const [dateIdx, setDateIdx]   = useState(0);
  const [times, setTimes]       = useState<number[]>([]);
  const [timeIdx, setTimeIdx]   = useState(0);

  const [chainData, setChainData] = useState<ArchivedChainRow[] | null>(null);
  const [chainMeta, setChainMeta] = useState<{ spot: number; savedAt: number; expiry: string } | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(false);
  const [legMsg, setLegMsg]       = useState("");

  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed]         = useState<(typeof SPEEDS)[number]>(1);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [miniChart, setMiniChart] = useState<{ date: string; close: number; t: number }[]>([]);

  const [wfSlPct, setWfSlPct]   = useState(50);
  const [wfTgtPct, setWfTgtPct] = useState(50);
  const [wfResult, setWfResult] = useState<WalkForwardResponse | null>(null);
  const [wfLoading, setWfLoading] = useState(false);
  const [wfError, setWfError]     = useState("");

  // Remember the currently-selected date/time so an expiry change can try
  // to preserve them instead of always jumping to the latest snapshot.
  const selectedDateRef = useRef("");
  const selectedTimeRef = useRef<number | null>(null);

  // ── Bookmarks ────────────────────────────────────────────────────────────
  const [bookmarks, setBookmarks] = useState<SnapshotBookmark[]>(() => loadBookmarks());

  // ── Compare-snapshot mode ────────────────────────────────────────────────
  const [compareMode, setCompareMode] = useState(false);
  const [compareDate, setCompareDate] = useState<string>("");
  const [compareTime, setCompareTime] = useState<number | null>(null);
  const [compareChainData, setCompareChainData] = useState<ArchivedChainRow[] | null>(null);
  const [compareChainMeta, setCompareChainMeta] = useState<{ spot: number; savedAt: number; expiry: string } | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  // ── Resume-last-session guard (only auto-restore once, on first mount) ──
  const resumedRef = useRef(false);

  // Expiries for the selected symbol
  useEffect(() => {
    fetchArchivedExpiries(symbol)
      .then(r => {
        const exps = r.expiries ?? [];
        setExpiries(exps);
        // On first load only, try to resume the last session's expiry if
        // it's still in the list; otherwise fall back to original behavior
        // (latest expiry). Every subsequent symbol change still behaves
        // exactly as before.
        if (!resumedRef.current) {
          const last = loadLastSession();
          if (last && last.symbol === symbol && exps.includes(last.expiry)) {
            setExpiry(last.expiry);
            return;
          }
        }
        setExpiry(exps[0] ?? "");
      })
      .catch(() => { setExpiries([]); setExpiry(""); });
  }, [symbol]);

  // Dates for the selected expiry — keep the same date selected if this
  // expiry also has data for it, instead of always jumping to the latest.
  useEffect(() => {
    if (!expiry) { setDates([]); return; }
    fetchArchivedDates(symbol, expiry)
      .then(r => {
        const d = r.dates ?? [];
        setDates(d);
        const prev = selectedDateRef.current;
        if (!resumedRef.current) {
          const last = loadLastSession();
          if (last && last.symbol === symbol && last.expiry === expiry && d.includes(last.date)) {
            setDateIdx(d.indexOf(last.date));
            return;
          }
        }
        const idx = prev ? d.indexOf(prev) : -1;
        setDateIdx(idx >= 0 ? idx : Math.max(d.length - 1, 0));
      })
      .catch(() => setDates([]));
  }, [symbol, expiry]);

  const selectedDate = dates[dateIdx] ?? "";
  useEffect(() => { selectedDateRef.current = selectedDate; }, [selectedDate]);
  useEffect(() => { selectedTimeRef.current = times[timeIdx] ?? null; }, [times, timeIdx]);

  // Times for the selected date — try to keep the same time of day selected
  // (closest match) instead of always jumping to the latest snapshot.
  useEffect(() => {
    if (!expiry || !selectedDate) { setTimes([]); return; }
    fetchArchivedTimes(symbol, selectedDate, expiry)
      .then(r => {
        const t = r.times ?? [];
        setTimes(t);
        if (!resumedRef.current) {
          const last = loadLastSession();
          if (last && last.symbol === symbol && last.expiry === expiry && last.date === selectedDate && t.length > 0) {
            let bestIdx = 0, bestDiff = Infinity;
            t.forEach((epoch, i) => {
              const diff = Math.abs(epoch - last.time);
              if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
            });
            setTimeIdx(bestIdx);
            resumedRef.current = true;
            return;
          }
        }
        resumedRef.current = true;
        const prevT = selectedTimeRef.current;
        if (prevT != null && t.length > 0) {
          let bestIdx = 0, bestDiff = Infinity;
          t.forEach((epoch, i) => {
            const diff = Math.abs(epoch - prevT);
            if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
          });
          setTimeIdx(bestIdx);
        } else {
          setTimeIdx(Math.max(t.length - 1, 0));
        }
      })
      .catch(() => setTimes([]));
  }, [symbol, expiry, selectedDate]);

  // Mini spot sparkline for the selected date
  useEffect(() => {
    if (!selectedDate) return;
    fetchHistorical(symbol, 2, "15m")
      .then(r => {
        setMiniChart(
          (r.candles ?? []).map(c => ({
            t: c.t,
            close: c.close,
            date: new Date(c.t * 1000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
          }))
        );
      })
      .catch(() => setMiniChart([]));
  }, [symbol, selectedDate]);

  const loadChainAt = async (epoch: number) => {
    if (!selectedDate || !expiry) return;
    setLoading(true); setError(false);
    try {
      const res = await fetchArchivedChain(symbol, selectedDate, expiry, epoch);
      setChainData(res.data.expiryData);
      setChainMeta({ spot: res.spot, savedAt: res.saved_at, expiry: res.expiry });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (times[timeIdx] != null) loadChainAt(times[timeIdx]);
    setWfResult(null); setWfError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [times, timeIdx]);

  // Persist the current position as "last session" on every settled change
  // (debounced implicitly by only firing once chainMeta actually updates).
  useEffect(() => {
    if (!symbol || !expiry || !selectedDate || times[timeIdx] == null) return;
    persistLastSession({ symbol, expiry, date: selectedDate, time: times[timeIdx] });
  }, [symbol, expiry, selectedDate, times, timeIdx]);

  // Step navigation using whichever timeframe is currently "active"
  const step = (dir: 1 | -1) => jump(activeTf, dir);

  // Step navigation using an explicit timeframe (used by the per-button
  // Reverse/Forward bar so each button jumps by its own labeled amount).
  // Because `times`/`dates` only ever contain snapshots that actually exist
  // in the archive (real trading sessions), stepping through them already
  // skips holidays and non-trading hours — there is no separate "skip"
  // pass needed since the underlying data has nothing to skip past.
  const jump = (tf: (typeof TIMEFRAMES)[number], dir: 1 | -1) => {
    setResolution(tf.key);
    if (tf.snapshotStep === "day") {
      setDateIdx(i => Math.min(Math.max(i + dir, 0), Math.max(dates.length - 1, 0)));
      return;
    }
    const n = tf.snapshotStep;
    setTimeIdx(i => {
      const next = i + dir * n;
      if (next < 0) {
        setDateIdx(d => Math.max(d - 1, 0));
        return 0;
      }
      if (next >= times.length) {
        setDateIdx(d => Math.min(d + 1, Math.max(dates.length - 1, 0)));
        return Math.max(times.length - 1, 0);
      }
      return next;
    });
  };

  useEffect(() => {
    if (isPlaying) {
      playRef.current = setInterval(() => step(1), BASE_INTERVAL_MS / speed);
    }
    return () => { if (playRef.current) clearInterval(playRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, speed, resolution, times.length, dates.length, timeIdx, dateIdx]);

  const handleAddLeg = (row: ArchivedChainRow, optType: "CE" | "PE", action: "BUY" | "SELL") => {
    const ltp = optType === "CE" ? row.ce_ltp : row.pe_ltp;
    if (ltp == null) return;
    const ivField = optType === "CE" ? row.ce_iv : row.pe_iv;
    addLeg(makeOptionLeg(
      symbol as "NIFTY" | "BANKNIFTY",
      row.strike, optType, action, 1, ltp, ivField ?? 15, expiry
    ));
    setLegMsg(`Added ${action} ${row.strike} ${optType} to Builder`);
    setTimeout(() => setLegMsg(""), 2000);
  };

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
    } catch {
      setWfError("Couldn't run — this date/expiry may not have enough archived data ahead of this point yet.");
    } finally {
      setWfLoading(false);
    }
  };

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
      pnl: p.pnl,
    }));
  }, [wfResult]);

  const hasData = expiries.length > 0;
  const replayProgressPct = times.length > 1 ? Math.round((timeIdx / (times.length - 1)) * 100) : 0;

  // ── Historical Context derived values ────────────────────────────────────
  const marketPhase: MarketPhase | null = chainMeta ? getMarketPhase(chainMeta.savedAt) : null;

  const dte: number | null = useMemo(() => {
    if (!chainMeta || !expiry) return null;
    const expiryDate = new Date(expiry + "T15:30:00");
    const snapDate = new Date(chainMeta.savedAt * 1000);
    const diffMs = expiryDate.getTime() - snapDate.getTime();
    return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  }, [chainMeta, expiry]);

  // PCR (Put/Call OI ratio) — only computable when the archive actually has
  // OI on both sides; returns null (rendered as "N/A") otherwise rather than
  // silently showing a misleading 0 or 1.
  const pcr: number | null = useMemo(() => {
    if (!chainData || chainData.length === 0) return null;
    let ceOi = 0, peOi = 0, any = false;
    for (const row of chainData) {
      if (row.ce_oi != null) { ceOi += row.ce_oi; any = true; }
      if (row.pe_oi != null) { peOi += row.pe_oi; any = true; }
    }
    if (!any || ceOi === 0) return null;
    return peOi / ceOi;
  }, [chainData]);

  const atmIvPair = useMemo(() => {
    if (!chainData) return { ce: null as number | null, pe: null as number | null };
    const atmRow = chainData.find(r => r.atm);
    return { ce: atmRow?.ce_iv ?? null, pe: atmRow?.pe_iv ?? null };
  }, [chainData]);

  const atmIv: number | null = useMemo(() => {
    const { ce, pe } = atmIvPair;
    if (ce != null && pe != null) return (ce + pe) / 2;
    return ce ?? pe ?? null;
  }, [atmIvPair]);

  // Gap % — the % move of today's session-open spot vs the previous trading
  // day's closing spot, using the same mini spot sparkline already fetched
  // for the sparkline/cursor feature (no extra network call).
  const gapPct: number | null = useMemo(() => {
    if (!chainMeta || miniChart.length < 2) return null;
    const sameDayPoints = miniChart.filter(c => {
      const d = new Date(c.t * 1000);
      const snap = new Date(chainMeta.savedAt * 1000);
      return d.toDateString() === snap.toDateString();
    });
    if (sameDayPoints.length === 0) return null;
    const todayOpen = sameDayPoints[0].close;
    const priorPoints = miniChart.filter(c => {
      const d = new Date(c.t * 1000);
      const snap = new Date(chainMeta.savedAt * 1000);
      return d.toDateString() !== snap.toDateString();
    });
    if (priorPoints.length === 0) return null;
    const priorClose = priorPoints[priorPoints.length - 1].close;
    if (!priorClose) return null;
    return ((todayOpen - priorClose) / priorClose) * 100;
  }, [chainMeta, miniChart]);

  const snapshotBias: SnapshotBias = useMemo(
    () => computeSnapshotScore(pcr, atmIvPair.ce, atmIvPair.pe),
    [pcr, atmIvPair]
  );

  const currentEvent = useMemo(() => getEventForDate(selectedDate), [selectedDate]);
  const isExpiryDay = selectedDate === expiry;

  // ── Bookmark actions ─────────────────────────────────────────────────────
  const addBookmark = useCallback((label?: string) => {
    if (!selectedDate || times[timeIdx] == null) return;
    const bm: SnapshotBookmark = {
      id: `${symbol}-${expiry}-${selectedDate}-${times[timeIdx]}-${Date.now()}`,
      symbol, expiry, date: selectedDate, time: times[timeIdx],
      label: label?.trim() || `${symbol} ${fmtDateLabel(selectedDate)} ${fmtTime(times[timeIdx])}`,
      savedAt: Date.now(),
    };
    setBookmarks(prev => {
      const next = [bm, ...prev].slice(0, 50); // cap to avoid unbounded growth
      persistBookmarks(next);
      return next;
    });
  }, [symbol, expiry, selectedDate, times, timeIdx]);

  const removeBookmark = useCallback((id: string) => {
    setBookmarks(prev => {
      const next = prev.filter(b => b.id !== id);
      persistBookmarks(next);
      return next;
    });
  }, []);

  const goToBookmark = useCallback((bm: SnapshotBookmark) => {
    if (bm.symbol !== symbol) setSymbol(bm.symbol);
    if (bm.expiry !== expiry) setExpiry(bm.expiry);
    const dIdx = dates.indexOf(bm.date);
    if (dIdx >= 0) setDateIdx(dIdx);
    selectedTimeRef.current = bm.time; // best-effort closest-time match once times[] reloads
  }, [symbol, expiry, dates]);

  const isCurrentBookmarked = bookmarks.some(
    b => b.symbol === symbol && b.expiry === expiry && b.date === selectedDate && b.time === times[timeIdx]
  );

  // ── Compare-snapshot mode ────────────────────────────────────────────────
  const loadCompareChain = useCallback(async (date: string, time: number) => {
    if (!expiry) return;
    setCompareLoading(true);
    try {
      const res = await fetchArchivedChain(symbol, date, expiry, time);
      setCompareChainData(res.data.expiryData);
      setCompareChainMeta({ spot: res.spot, savedAt: res.saved_at, expiry: res.expiry });
    } catch {
      setCompareChainData(null);
      setCompareChainMeta(null);
    } finally {
      setCompareLoading(false);
    }
  }, [symbol, expiry]);

  useEffect(() => {
    if (compareMode && compareDate && compareTime != null) {
      loadCompareChain(compareDate, compareTime);
    }
  }, [compareMode, compareDate, compareTime, loadCompareChain]);

  const toggleCompareMode = useCallback(() => {
    setCompareMode(v => {
      const next = !v;
      if (next && !compareDate) {
        // default the comparison side to whatever's currently selected, so
        // opening compare mode never starts on an empty/blank state
        setCompareDate(selectedDate);
        setCompareTime(times[timeIdx] ?? null);
      }
      return next;
    });
  }, [compareDate, selectedDate, times, timeIdx]);

  return {
    symbol, setSymbol, resolution, setResolution, activeTf,
    expiries, expiry, setExpiry,
    dates, dateIdx, setDateIdx, selectedDate,
    times, timeIdx, setTimeIdx,
    chainData, chainMeta, loading, error, legMsg,
    isPlaying, setIsPlaying, speed, setSpeed,
    miniChart, cursorPoint,
    wfSlPct, setWfSlPct, wfTgtPct, setWfTgtPct,
    wfResult, wfLoading, wfError, wfChartData, runWalkForward,
    step, jump, handleAddLeg, hasData, replayProgressPct,

    // ── New: Historical Context Bar ──
    marketPhase, dte, pcr, atmIv, gapPct, snapshotBias,
    currentEvent, isExpiryDay,

    // ── New: Bookmarks ──
    bookmarks, addBookmark, removeBookmark, goToBookmark, isCurrentBookmarked,

    // ── New: Resume Last Session (informational — restoration itself is
    // automatic on mount via the effects above; this flag lets the UI show
    // a one-time "Resumed last session" toast if desired) ──
    hasResumedSession: resumedRef.current,

    // ── New: Compare Snapshot mode ──
    compareMode, toggleCompareMode,
    compareDate, setCompareDate, compareTime, setCompareTime,
    compareChainData, compareChainMeta, compareLoading,
  };
}

export type HistoricalChain = ReturnType<typeof useHistoricalChain>;
