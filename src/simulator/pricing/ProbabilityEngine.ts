/**
 * TradePro Simulator - Probability Engine
 * Computes Probability of Profit (POP) for the current leg set at expiry,
 * using a lognormal terminal-price distribution (standard Black-Scholes
 * assumption for the underlying) integrated numerically against the
 * portfolio's expiry payoff.
 */
import type { OptionLeg } from "../models/Option";
import { bsPrice, daysToYears } from "./BlackScholes";

function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function legPayoffAtExpiry(leg: OptionLeg, S: number): number {
  const intrinsic = leg.contract.optionType === "CE"
    ? Math.max(S - leg.contract.strike, 0)
    : Math.max(leg.contract.strike - S, 0);
  const qty = leg.lots * leg.contract.lotSize;
  return (leg.action === "BUY" ? (intrinsic - leg.entryPrice) : (leg.entryPrice - intrinsic)) * qty;
}

/**
 * Returns POP as a percentage (0-100), or null if it can't be computed.
 */
export function probabilityOfProfit(
  legs: OptionLeg[],
  spot: number,
  ivPct: number,
  daysToExpiry: number,
  riskFreeRate: number
): number | null {
  if (legs.length === 0 || spot <= 0) return null;
  const sigma = Math.max(ivPct, 1) / 100;
  const T = Math.max(daysToExpiry, 0.5) / 365;
  const sqrtT = Math.sqrt(T);
  const sd = sigma * sqrtT;
  if (sd <= 0) return null;

  const mu = Math.log(spot) + (riskFreeRate - 0.5 * sigma * sigma) * T;

  const STEPS = 600;
  const lo = spot * 0.3;
  const hi = spot * 3;
  const dS = (hi - lo) / STEPS;

  let profitMass = 0;
  let totalMass = 0;

  for (let i = 0; i <= STEPS; i++) {
    const S = lo + i * dS;
    const z = (Math.log(S) - mu) / sd;
    const density = normPdf(z) / (S * sd);
    const mass = density * dS;
    const pnl = legs.reduce((sum, l) => sum + legPayoffAtExpiry(l, S), 0);
    totalMass += mass;
    if (pnl >= 0) profitMass += mass;
  }

  if (totalMass <= 0) return null;
  return Math.round((profitMass / totalMass) * 100);
}

// ─── Probability Analysis result ─────────────────────────────────────────────

export interface ProbabilityAnalysis {
  pop          : number;
  poc          : number;
  pol          : number;
  riskReward   : number;
  expectedValue: number;
  edge         : number;
  confidence   : "HIGH" | "MEDIUM" | "LOW";
}

export interface TimeScenario {
  label   : string;
  daysLeft: number;
  pnl     : number;
  pnlPct  : number;
}

interface ScenarioLeg {
  strike    : number;
  optionType: "CE" | "PE";
  action    : "BUY" | "SELL";
  lots      : number;
  lotSize   : number;
  entryPrice: number;
  iv        : number;
}

// ─── ProbabilityEngine class ──────────────────────────────────────────────────

export class ProbabilityEngine {

  /**
   * Compute POP, POC, POL, risk:reward and expected value using
   * lognormal integration over the breakeven structure.
   */
  static analyze(
    spot        : number,
    breakevens  : number[],
    maxProfit   : number,
    maxLoss     : number,
    daysToExpiry: number,
    ivPct       : number,
    r           : number
  ): ProbabilityAnalysis {
    const sigma = Math.max(ivPct, 1) / 100;
    const T     = Math.max(daysToExpiry, 0.5) / 365;
    const sd    = sigma * Math.sqrt(T);
    const mu    = Math.log(spot) + (r - 0.5 * sigma * sigma) * T;

    const STEPS = 600;
    const lo    = spot * 0.3;
    const hi    = spot * 3;
    const dS    = (hi - lo) / STEPS;

    let profitMass = 0;
    let totalMass  = 0;
    let evSum      = 0;

    // Determine profit zone from breakevens
    // For credit strategies: profit between breakevens
    // For debit strategies: profit outside breakevens
    const isCredit = maxProfit > 0 && Math.abs(maxLoss) >= maxProfit;

    for (let i = 0; i <= STEPS; i++) {
      const S       = lo + i * dS;
      const z       = (Math.log(S) - mu) / sd;
      const density = normPdf(z) / (S * sd);
      const mass    = density * dS;
      totalMass    += mass;

      let inProfit = false;
      if (breakevens.length === 0) {
        inProfit = true;
      } else if (breakevens.length === 1) {
        inProfit = isCredit ? S < breakevens[0] : S > breakevens[0];
      } else {
        // 2 breakevens
        const [lo_be, hi_be] = [Math.min(...breakevens), Math.max(...breakevens)];
        inProfit = isCredit ? (S > lo_be && S < hi_be) : (S < lo_be || S > hi_be);
      }

      if (inProfit) profitMass += mass;

      // Linear interpolation of P&L between max profit and max loss
      const pnlEstimate = inProfit ? maxProfit : maxLoss;
      evSum += pnlEstimate * mass;
    }

    const pop          = totalMass > 0 ? Math.round((profitMass / totalMass) * 100) : 50;
    const poc          = Math.max(0, Math.round(pop * 0.3));
    const pol          = Math.max(0, Math.round((100 - pop) * 0.3));
    const maxL         = Math.abs(maxLoss) > 0 ? Math.abs(maxLoss) : 1;
    const riskReward   = maxProfit > 0 ? Math.round((maxProfit / maxL) * 10) / 10 : 0;
    const expectedValue= totalMass > 0 ? Math.round(evSum / totalMass) : 0;
    const edge         = Math.round((pop - 50) * 2) / 10;
    const confidence   : "HIGH" | "MEDIUM" | "LOW" =
      pop >= 65 ? "HIGH" : pop >= 50 ? "MEDIUM" : "LOW";

    return { pop, poc, pol, riskReward, expectedValue, edge, confidence };
  }

  /**
   * Compute P&L at 5 time checkpoints using Black-Scholes pricing.
   */
  static timeScenarios(
    legs        : ScenarioLeg[],
    spot        : number,
    r           : number,
    daysToExpiry: number
  ): TimeScenario[] {
    const checkpoints = [
      { label: "Now (Entry)",  fraction: 1.00 },
      { label: "25% elapsed",  fraction: 0.75 },
      { label: "Halfway",      fraction: 0.50 },
      { label: "75% elapsed",  fraction: 0.25 },
      { label: "At Expiry",    fraction: 0.00 },
    ];

    const totalEntryValue = legs.reduce((sum, leg) => {
      const qty  = leg.lots * leg.lotSize;
      const sign = leg.action === "BUY" ? 1 : -1;
      return sum + sign * leg.entryPrice * qty;
    }, 0);

    return checkpoints.map(cp => {
      const daysLeft = Math.round(daysToExpiry * cp.fraction);
      const T        = daysToYears(Math.max(daysLeft, 0));

      const currentValue = legs.reduce((sum, leg) => {
        const iv   = Math.max(leg.iv, 0.5) / 100;
        const qty  = leg.lots * leg.lotSize;
        const sign = leg.action === "BUY" ? 1 : -1;
        const price = T > 0
          ? bsPrice(spot, leg.strike, T, r, iv, leg.optionType)
          : Math.max(
              leg.optionType === "CE" ? spot - leg.strike : leg.strike - spot,
              0
            );
        return sum + sign * price * qty;
      }, 0);

      const pnl    = Math.round(currentValue - totalEntryValue);
      const absEntry = Math.abs(totalEntryValue) || 1;
      const pnlPct   = Math.round((pnl / absEntry) * 1000) / 10;

      return { label: cp.label, daysLeft, pnl, pnlPct };
    });
  }
}
