// src/utils/equityQuantScanner.ts
//
// Client-side quant scoring engine for equity swing/momentum scanning.
// Runs entirely against TradePro's existing /historical endpoint —
// no backend changes required, no external repo copied.
//
// Produces an explainable 0-100 composite score per symbol (EMA trend,
// RSI momentum, MACD crossover, volume confirmation, ATR volatility fit)
// and classifies it BUY / SELL / HOLD for the Equity Scanner panel.

import { fetchHistorical } from './api';
import type { Signal, SignalType } from '../components/signal_engine/SignalCard';

interface Candle {
  t: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface EquityScanFilter {
  signal?: SignalType | '';
  minConfidence: number;
  minVolume: number;
  minPrice: number;
  maxPrice: number;
}

export interface EquityScanResult {
  symbol: string;
  signal: Signal;
  avg_volume: number;
  last_price: number;
}

// ─── Symbol normalization ─────────────────────────────────────────

/**
 * TradePro's backend follows Fyers symbol convention elsewhere in the app
 * (e.g. "NSE:NIFTY50-INDEX" for quotes). Equity scan input is a plain name
 * like "RELIANCE" for convenience — normalize it to the qualified Fyers
 * equity symbol before hitting /historical. If the user already typed a
 * fully-qualified symbol (contains ":"), leave it as-is.
 */
function toFyersSymbol(sym: string): string {
  const s = sym.trim().toUpperCase();
  if (s.includes(':')) return s;
  return `NSE:${s}-EQ`;
}

// ─── Indicators ────────────────────────────────────────────────────────────

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[0] : values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

function rsi(values: number[], period = 14): number[] {
  const out: number[] = new Array(values.length).fill(50);
  if (values.length <= period) return out;

  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gain += diff; else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

function macd(values: number[]) {
  const ema12 = ema(values, 12);
  const ema26 = ema(values, 26);
  const macdLine = values.map((_, i) => ema12[i] - ema26[i]);
  const signalLine = ema(macdLine, 9);
  const hist = macdLine.map((v, i) => v - signalLine[i]);
  return { macdLine, signalLine, hist };
}

function atr(candles: Candle[], period = 14): number[] {
  const tr: number[] = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prevClose = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));
  });
  return ema(tr, period);
}

// ─── Composite quant score (0-100, explainable) ─────────────────────────────

interface ScoreResult {
  score: number;
  signal: SignalType;
  confidence: number;
  reason: string;
}

function scoreCandles(candles: Candle[]): ScoreResult | null {
  if (candles.length < 55) return null; // need enough bars for EMA50/MACD to settle

  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const rsiVals = rsi(closes, 14);
  const { macdLine, signalLine, hist } = macd(closes);
  const atrVals = atr(candles, 14);

  const i = closes.length - 1;
  const price = closes[i];
  const avgVol20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, volumes.length);
  const volSurge = avgVol20 > 0 ? volumes[i] / avgVol20 : 1;
  const atrPct = price > 0 ? (atrVals[i] / price) * 100 : 0;

  let bull = 0, bear = 0;
  const reasons: string[] = [];

  // 1) EMA trend alignment — weight 25
  if (price > ema20[i] && ema20[i] > ema50[i]) { bull += 25; reasons.push('Price>EMA20>EMA50 (uptrend)'); }
  else if (price < ema20[i] && ema20[i] < ema50[i]) { bear += 25; reasons.push('Price<EMA20<EMA50 (downtrend)'); }

  // 2) RSI momentum — weight 20
  const r = rsiVals[i];
  if (r > 50 && r < 70) { bull += 20; reasons.push(`RSI ${r.toFixed(0)} bullish momentum`); }
  else if (r < 50 && r > 30) { bear += 20; reasons.push(`RSI ${r.toFixed(0)} bearish momentum`); }
  else if (r >= 70) { reasons.push(`RSI ${r.toFixed(0)} overbought`); }
  else if (r <= 30) { reasons.push(`RSI ${r.toFixed(0)} oversold`); }

  // 3) MACD crossover — weight 25
  const macdBull = macdLine[i] > signalLine[i] && hist[i] > hist[i - 1];
  const macdBear = macdLine[i] < signalLine[i] && hist[i] < hist[i - 1];
  if (macdBull) { bull += 25; reasons.push('MACD bullish crossover, rising histogram'); }
  else if (macdBear) { bear += 25; reasons.push('MACD bearish crossover, falling histogram'); }

  // 4) Volume surge confirmation — weight 15
  if (volSurge >= 1.5) {
    if (bull > bear) { bull += 15; reasons.push(`Volume ${volSurge.toFixed(1)}x avg confirms move`); }
    else if (bear > bull) { bear += 15; reasons.push(`Volume ${volSurge.toFixed(1)}x avg confirms move`); }
  }

  // 5) ATR volatility fit for swing trades (1.5%-6% of price) — weight 15
  if (atrPct >= 1.5 && atrPct <= 6) {
    if (bull >= bear) bull += 15; else bear += 15;
    reasons.push(`ATR ${atrPct.toFixed(1)}% — tradeable volatility`);
  } else {
    reasons.push(`ATR ${atrPct.toFixed(1)}% — ${atrPct > 6 ? 'too volatile' : 'too quiet'} for swing`);
  }

  const score = Math.max(bull, bear);
  const signal: SignalType = bull >= 65 && bull > bear ? 'BUY' : bear >= 65 && bear > bull ? 'SELL' : 'HOLD';
  const confidence = Math.min(score, 100) / 100;

  return { score, signal, confidence, reason: reasons.join(' • ') };
}

// ─── Scanner runner ──────────────────────────────────────────────────────────

/**
 * Runs the quant swing/momentum scan across a universe of symbols.
 * Pure client-side — uses the existing /historical endpoint per symbol,
 * computes an explainable 0-100 score, and applies the panel's filters.
 *
 * Throws a descriptive error (surfaced in the panel's error box) when the
 * scan produces zero results because of a fetch/data problem, so failures
 * are never silent — as opposed to just showing an empty result list.
 */
export async function runEquityQuantScan(
  universe: string[],
  filter: EquityScanFilter
): Promise<EquityScanResult[]> {
  const results: EquityScanResult[] = [];

  let attempted = 0;
  let fetchFailures = 0;
  let noCandleData = 0;
  let insufficientHistory = 0;
  let firstErrorMsg = '';

  // Small batches so we don't hammer the backend proxy with parallel calls.
  const BATCH = 5;
  for (let i = 0; i < universe.length; i += BATCH) {
    const batch = universe.slice(i, i + BATCH).map(s => s.trim()).filter(Boolean);
    if (batch.length === 0) continue;

    const settled = await Promise.allSettled(
      batch.map(sym => fetchHistorical(toFyersSymbol(sym), 120, '1d'))
    );

    settled.forEach((res, idx) => {
      const symbol = batch[idx];
      attempted++;

      if (res.status !== 'fulfilled') {
        fetchFailures++;
        if (!firstErrorMsg) firstErrorMsg = res.reason?.message || String(res.reason);
        return;
      }
      if (!res.value.candles?.length) { noCandleData++; return; }

      const candles = res.value.candles;
      const scored = scoreCandles(candles);
      if (!scored) { insufficientHistory++; return; }

      const lastPrice = candles[candles.length - 1].close;
      const avgVolume =
        candles.slice(-20).reduce((a, c) => a + c.volume, 0) / Math.min(20, candles.length);

      if (filter.signal && scored.signal !== filter.signal) return;
      if (scored.confidence < filter.minConfidence) return;
      if (avgVolume < filter.minVolume) return;
      if (lastPrice < filter.minPrice || lastPrice > filter.maxPrice) return;

      results.push({
        symbol,
        avg_volume: avgVolume,
        last_price: lastPrice,
        signal: {
          symbol,
          signal: scored.signal,
          confidence: scored.confidence,
          reason: scored.reason,
          price: lastPrice,
          timestamp: new Date().toISOString(),
        },
      });
    });
  }

  // Surface *why* nothing came back instead of a silent empty list.
  if (results.length === 0 && attempted > 0) {
    if (fetchFailures === attempted) {
      throw new Error(
        `Historical data fetch failed for all ${attempted} symbol(s). ` +
        `First error: ${firstErrorMsg || 'unknown'}. Check backend connectivity / symbol format.`
      );
    }
    if (noCandleData === attempted) {
      throw new Error(
        `Backend returned no candle data for any of the ${attempted} symbol(s) — ` +
        `symbols may be unsupported/unlisted on the data feed.`
      );
    }
    if (insufficientHistory === attempted) {
      throw new Error(
        `Not enough historical bars (need 55+) for any of the ${attempted} symbol(s) — ` +
        `try a longer-listed symbol or check the /historical response.`
      );
    }
    // Mixed outcome with zero matches: fetched fine but filters excluded everything.
    throw new Error(
      `Scanned ${attempted} symbol(s) successfully but none matched your filters ` +
      `(min confidence ${filter.minConfidence}, min volume ${filter.minVolume}). Try loosening them.`
    );
  }

  // Strongest signals first.
  return results.sort((a, b) => b.signal.confidence - a.signal.confidence);
}
