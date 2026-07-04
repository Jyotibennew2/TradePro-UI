/**
 * TradePro Simulator - Black-Scholes Pricing Engine
 * Pure TypeScript implementation. No external dependencies.
 */

import type { Greeks, GreeksInput } from "../models/Greeks";

// ─── Normal distribution helpers ─────────────────────────────────────────────

function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  const t = 1.0 / (1.0 + 0.3275911 * x);
  const y = 1.0 - (((((1.061405429 * t - 1.453152027) * t)
    + 1.421413741) * t - 0.284496736) * t
    + 0.254829592) * t * Math.exp(-x * x);
  return sign * y;
}

export function normCDF(x: number): number {
  return 0.5 * (1.0 + erf(x / Math.sqrt(2.0)));
}

export function normPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2.0 * Math.PI);
}

// ─── d1, d2 ──────────────────────────────────────────────────────────────────

function computeD(S: number, K: number, T: number, r: number, sigma: number) {
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  return { d1, d2, sqrtT };
}

// ─── Price ────────────────────────────────────────────────────────────────────

export function bsPrice(
  S: number, K: number, T: number, r: number,
  sigma: number, optionType: "CE" | "PE"
): number {
  if (T <= 0) {
    return optionType === "CE"
      ? Math.max(S - K, 0)
      : Math.max(K - S, 0);
  }
  const { d1, d2 } = computeD(S, K, T, r, sigma);
  const disc = Math.exp(-r * T);
  if (optionType === "CE") {
    return S * normCDF(d1) - K * disc * normCDF(d2);
  }
  return K * disc * normCDF(-d2) - S * normCDF(-d1);
}

// ─── Greeks ───────────────────────────────────────────────────────────────────

export function bsGreeks(input: GreeksInput): Greeks {
  const { spot: S, strike: K, timeToExpiry: T, riskFreeRate: r,
          volatility: sigma, optionType, marketPrice } = input;

  if (T <= 0 || sigma <= 0) {
    return {
      delta: optionType === "CE" ? (S > K ? 1 : 0) : (S < K ? -1 : 0),
      gamma: 0, theta: 0, vega: 0, rho: 0,
      iv   : marketPrice ? calculateIV(marketPrice, S, K, 0, r, optionType) : sigma * 100,
      price: bsPrice(S, K, T, r, sigma, optionType),
    };
  }

  const { d1, d2, sqrtT } = computeD(S, K, T, r, sigma);
  const disc   = Math.exp(-r * T);
  const pdf_d1 = normPDF(d1);

  // Delta
  const delta = optionType === "CE"
    ? normCDF(d1)
    : normCDF(d1) - 1;

  // Gamma
  const gamma = pdf_d1 / (S * sigma * sqrtT);

  // Theta (per calendar day)
  const term1 = -(S * pdf_d1 * sigma) / (2 * sqrtT);
  const term2 = optionType === "CE"
    ? -r * K * disc * normCDF(d2)
    :  r * K * disc * normCDF(-d2);
  const theta = (term1 + term2) / 365;

  // Vega (per 1% IV)
  const vega = S * pdf_d1 * sqrtT / 100;

  // Rho (per 1% rate)
  const rho = optionType === "CE"
    ?  K * T * disc * normCDF(d2)  / 100
    : -K * T * disc * normCDF(-d2) / 100;

  // IV
  const iv = marketPrice
    ? calculateIV(marketPrice, S, K, T, r, optionType)
    : sigma * 100;

  return {
    delta : round(delta, 6),
    gamma : round(gamma, 6),
    theta : round(theta, 6),
    vega  : round(vega,  6),
    rho   : round(rho,   6),
    iv    : round(iv,    4),
    price : round(bsPrice(S, K, T, r, sigma, optionType), 2),
  };
}

// ─── IV Solver (bisection) ────────────────────────────────────────────────────

export function calculateIV(
  marketPrice : number,
  S           : number,
  K           : number,
  T           : number,
  r           : number,
  optionType  : "CE" | "PE",
  precision   : number = 0.0001,
  maxIter     : number = 200,
): number {
  if (T <= 0 || marketPrice <= 0) return 0;

  let lo = 0.001, hi = 5.0;

  for (let i = 0; i < maxIter; i++) {
    const mid   = (lo + hi) / 2;
    const price = bsPrice(S, K, T, r, mid, optionType);
    if (Math.abs(price - marketPrice) < precision) return round(mid * 100, 4);
    if (price < marketPrice) lo = mid;
    else hi = mid;
  }
  return round(((lo + hi) / 2) * 100, 4);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

export function daysToYears(days: number): number {
  return days / 365;
}

export function spotRange(
  spot : number,
  pct  : number = 0.10,
  steps: number = 100,
): number[] {
  const min  = spot * (1 - pct);
  const max  = spot * (1 + pct);
  const step = (max - min) / steps;
  return Array.from({ length: steps + 1 }, (_, i) => round(min + i * step, 2));
}
