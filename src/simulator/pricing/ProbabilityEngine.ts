/**
 * TradePro Simulator - Probability Engine
 * Computes Probability of Profit (POP) for the current leg set at expiry,
 * using a lognormal terminal-price distribution (standard Black-Scholes
 * assumption for the underlying) integrated numerically against the
 * portfolio's expiry payoff. This is a new, self-contained calculation —
 * it does not modify PayoffEngine, MarginEngine, or BlackScholes.ts.
 *
 * Caveat shown alongside the number in the UI: this assumes lognormal
 * price movement at the given IV — it is a model estimate, not a guarantee.
 */
import type { OptionLeg } from "../models/Option";

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
 * Returns POP as a percentage (0-100), or null if it can't be computed
 * (no legs, zero/invalid spot, or zero time/volatility).
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

  // Risk-neutral drift of ln(S_T)
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
    const density = normPdf(z) / (S * sd); // lognormal pdf of S at this point
    const mass = density * dS;
    const pnl = legs.reduce((sum, l) => sum + legPayoffAtExpiry(l, S), 0);
    totalMass += mass;
    if (pnl >= 0) profitMass += mass;
  }

  if (totalMass <= 0) return null;
  return Math.round((profitMass / totalMass) * 100);
}
