/**
 * TradePro Simulator - Probability Engine
 * Probability of Profit, Expected Value, Risk-Reward
 */

import { normCDF, bsPrice, daysToYears } from "./BlackScholes";

// ─── Result types ─────────────────────────────────────────────────────────────

export interface ProbabilityResult {
  pop          : number;   // Probability of Profit %
  poc          : number;   // Probability of max profit (all OTM) %
  pol          : number;   // Probability of max loss %
  expectedValue: number;   // Expected value ₹
  riskReward   : number;   // Risk:Reward ratio
  edge         : number;   // Statistical edge %
  breakevens   : number[];
  confidence   : "HIGH" | "MEDIUM" | "LOW";
}

export interface TimeScenario {
  label     : string;
  daysLeft  : number;
  pnl       : number;
  pnlPct    : number;
  breakevens: number[];
}

// ─── Probability Engine ───────────────────────────────────────────────────────

export class ProbabilityEngine {

  // ── Probability of spot being above/below strike at expiry ────────────────

  static probAbove(S: number, K: number, T: number, r: number, sigma: number): number {
    if (T <= 0) return S > K ? 100 : 0;
    const d2 = (Math.log(S / K) + (r - 0.5 * sigma ** 2) * T) / (sigma * Math.sqrt(T));
    return Math.round(normCDF(d2) * 10000) / 100;
  }

  static probBelow(S: number, K: number, T: number, r: number, sigma: number): number {
    return Math.round((100 - ProbabilityEngine.probAbove(S, K, T, r, sigma)) * 100) / 100;
  }

  static probBetween(
    S: number, K1: number, K2: number, T: number, r: number, sigma: number
  ): number {
    const lo = Math.min(K1, K2);
    const hi = Math.max(K1, K2);
    return Math.round(
      (ProbabilityEngine.probAbove(S, lo, T, r, sigma) -
       ProbabilityEngine.probAbove(S, hi, T, r, sigma)) * 100
    ) / 100;
  }

  // ── Full probability analysis ─────────────────────────────────────────────

  static analyze(
    spot      : number,
    breakevens: number[],
    maxProfit : number,
    maxLoss   : number,
    daysLeft  : number,
    iv        : number,
    r         : number,
  ): ProbabilityResult {
    const T     = daysToYears(daysLeft);
    const sigma = iv / 100;

    // POP = probability spot stays in profitable zone
    let pop = 50;
    if (breakevens.length === 1) {
      const be = breakevens[0];
      // If max profit is above breakeven → bullish
      pop = maxProfit > 0 && maxLoss < 0
        ? ProbabilityEngine.probAbove(spot, be, T, r, sigma)
        : ProbabilityEngine.probBelow(spot, be, T, r, sigma);
    } else if (breakevens.length === 2) {
      const lo = Math.min(...breakevens);
      const hi = Math.max(...breakevens);
      pop = ProbabilityEngine.probBetween(spot, lo, hi, T, r, sigma);
    }

    // POC (probability of collecting max profit — all legs expire OTM)
    const poc = breakevens.length === 2
      ? ProbabilityEngine.probBetween(spot, breakevens[0], breakevens[1], T, r, sigma)
      : pop;

    // POL (probability of max loss)
    const pol = Math.max(0, Math.round((100 - pop - (poc - pop)) * 100) / 100);

    // Expected value
    const ev = Math.round(
      (pop / 100) * Math.abs(maxProfit) - ((100 - pop) / 100) * Math.abs(maxLoss)
    );

    // Risk reward
    const rr = maxLoss !== 0
      ? Math.round((Math.abs(maxProfit) / Math.abs(maxLoss)) * 100) / 100
      : 0;

    // Edge
    const edge = Math.round((pop - 50) * 2 * 100) / 100;

    const confidence: ProbabilityResult["confidence"] =
      daysLeft > 14 && Math.abs(sigma) > 0.05 ? "HIGH" :
      daysLeft > 5  ? "MEDIUM" : "LOW";

    return {
      pop    : Math.round(pop * 100) / 100,
      poc    : Math.round(poc * 100) / 100,
      pol    : Math.round(pol * 100) / 100,
      expectedValue: ev,
      riskReward   : rr,
      edge,
      breakevens,
      confidence,
    };
  }

  // ── Time scenarios (T+1, T+2, T+5, expiry) ───────────────────────────────

  static timeScenarios(
    legs    : Array<{ strike: number; optionType: "CE" | "PE"; action: "BUY" | "SELL"; lots: number; lotSize: number; entryPrice: number; iv: number }>,
    spot    : number,
    r       : number,
    daysLeft: number,
  ): TimeScenario[] {
    const offsets = [
      { label: "Today",  days: 0 },
      { label: "T+1",    days: 1 },
      { label: "T+2",    days: 2 },
      { label: "T+5",    days: 5 },
      { label: "T+7",    days: 7 },
      { label: "Expiry", days: daysLeft },
    ].filter(s => s.days <= daysLeft);

    return offsets.map(({ label, days }) => {
      const T    = daysToYears(Math.max(daysLeft - days, 0));
      const pnl  = legs.reduce((sum, leg) => {
        const sigma = leg.iv / 100;
        const price = T > 0
          ? bsPrice(spot, leg.strike, T, r, sigma, leg.optionType)
          : Math.max(
              leg.optionType === "CE" ? spot - leg.strike : leg.strike - spot,
              0
            );
        const m   = leg.action === "BUY" ? 1 : -1;
        const qty = leg.lots * leg.lotSize;
        return sum + m * (price - leg.entryPrice) * qty;
      }, 0);

      const totalCost = legs.reduce((s, l) => s + l.entryPrice * l.lots * l.lotSize, 0);
      const pnlPct    = totalCost > 0 ? Math.round((pnl / totalCost) * 10000) / 100 : 0;

      // Approximate breakevens at this time point
      const breakevens: number[] = [];

      return {
        label,
        daysLeft: daysLeft - days,
        pnl     : Math.round(pnl),
        pnlPct,
        breakevens,
      };
    });
  }
}
