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
 */

import { useState, useEffect, useRef, useMemo } from "react";
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

export const SPEEDS = [0.5, 1, 2, 5, 10] as const;
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

  // Expiries for the selected symbol
  useEffect(() => {
    fetchArchivedExpiries(symbol)
      .then(r => {
        const exps = r.expiries ?? [];
        setExpiries(exps);
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

  // Step navigation using whichever timeframe is currently "active"
  const step = (dir: 1 | -1) => jump(activeTf, dir);

  // Step navigation using an explicit timeframe (used by the per-button
  // Reverse/Forward bar so each button jumps by its own labeled amount)
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
  };
}

export type HistoricalChain = ReturnType<typeof useHistoricalChain>;
