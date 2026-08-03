import {
  bsPrice, bsGreeks, calculateIV,
  daysToYears, spotRange,
} from "./BlackScholes";
import type { Greeks, GreeksInput } from "../models/Greeks";
import type { OptionLeg }           from "../models/Option";

export interface PriceBreakdown {
  theoretical  : number;
  intrinsic    : number;
  extrinsic    : number;
  timeValue    : number;
  iv           : number;
  moneyness    : "DEEP_ITM" | "ITM" | "ATM" | "OTM" | "DEEP_OTM";
  moneynessAmt : number;
  moneynessP   : number;
  putCallParity: number;
}

export interface IVResult {
  iv           : number;
  ivDecimal    : number;
  converged    : boolean;
  iterations   : number;
  error        : number;
  vegaAtSolution: number;
}

export interface LegPricing {
  legId        : string;
  symbol       : string;
  strike       : number;
  optionType   : "CE" | "PE";
  action       : "BUY" | "SELL";
  lots         : number;
  qty          : number;
  entryPrice   : number;
  currentPrice : number;
  breakdown    : PriceBreakdown;
  greeks       : Greeks;
  pnl          : number;
  pnlPct       : number;
  deltaDollars : number;
  thetaPerDay  : number;
  vegaPerPct   : number;
}

export interface PortfolioPricing {
  legs          : LegPricing[];
  netPremium    : number;
  netDelta      : number;
  netGamma      : number;
  netTheta      : number;
  netVega       : number;
  netRho        : number;
  totalValue    : number;
  totalPnl      : number;
  totalPnlPct   : number;
  marginRequired: number;
  thetaPerDay   : number;
  vegaPerPct    : number;
  deltaExposure : number;
}

export interface StrikeLadderRow {
  strike      : number;
  moneyness   : string;
  ce_price    : number;
  pe_price    : number;
  ce_iv       : number;
  pe_iv       : number;
  ce_delta    : number;
  pe_delta    : number;
  ce_gamma    : number;
  pe_gamma    : number;
  ce_theta    : number;
  pe_theta    : number;
  ce_vega     : number;
  pe_vega     : number;
  ce_intrinsic: number;
  pe_intrinsic: number;
  ce_extrinsic: number;
  pe_extrinsic: number;
  isATM       : boolean;
}

export interface QuickPriceResult {
  ce          : number;
  pe          : number;
  ce_greeks   : Greeks;
  pe_greeks   : Greeks;
  ce_breakdown: PriceBreakdown;
  pe_breakdown: PriceBreakdown;
  syntheticFwd: number;
}

function r(n: number, d: number): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

function moneyness(
  S: number, K: number, optType: "CE" | "PE"
): PriceBreakdown["moneyness"] {
  const pct = Math.abs((S - K) / K) * 100;
  const itm = optType === "CE" ? S > K : S < K;
  if (pct < 0.5)  return "ATM";
  if (pct < 2.0)  return itm ? "ITM"      : "OTM";
  return itm ? "DEEP_ITM" : "DEEP_OTM";
}

export class PricingEngine {

  static breakdown(
    S          : number,
    K          : number,
    T          : number,
    r_         : number,
    sigma      : number,
    optionType : "CE" | "PE",
    marketPrice?: number,
  ): PriceBreakdown {
    const theoretical = bsPrice(S, K, T, r_, sigma, optionType);
    const intrinsic   = optionType === "CE" ? Math.max(S - K, 0) : Math.max(K - S, 0);
    const extrinsic   = Math.max(theoretical - intrinsic, 0);
    const iv          = marketPrice
      ? calculateIV(marketPrice, S, K, T, r_, optionType)
      : r(sigma * 100, 4);
    const moneynessAmt = r(S - K, 2);
    const moneynessP   = r((moneynessAmt / K) * 100, 3);
    const putCallParity = r(S - K * Math.exp(-r_ * T), 2);
    return {
      theoretical : r(theoretical,   2),
      intrinsic   : r(intrinsic,     2),
      extrinsic   : r(extrinsic,     2),
      timeValue   : r(extrinsic,     2),
      iv          : typeof iv === "number" ? r(iv, 4) : iv,
      moneyness   : moneyness(S, K, optionType),
      moneynessAmt,
      moneynessP,
      putCallParity,
    };
  }

  static solveIV(
    marketPrice: number,
    S          : number,
    K          : number,
    T          : number,
    r_         : number,
    optionType : "CE" | "PE",
  ): IVResult {
    if (T <= 0 || marketPrice <= 0) {
      return { iv: 0, ivDecimal: 0, converged: false, iterations: 0, error: 0, vegaAtSolution: 0 };
    }
    let sigma    = 0.20;
    let iters    = 0;
    const maxNR  = 100;
    const tol    = 1e-6;
    for (let i = 0; i < maxNR; i++) {
      iters++;
      const price = bsPrice(S, K, T, r_, sigma, optionType);
      const vega  = bsGreeks({ spot: S, strike: K, timeToExpiry: T, riskFreeRate: r_, volatility: sigma, optionType }).vega * 100;
      const diff  = price - marketPrice;
      if (Math.abs(diff) < tol) {
        return { iv: r(sigma * 100, 4), ivDecimal: r(sigma, 6), converged: true, iterations: iters, error: r(Math.abs(diff), 8), vegaAtSolution: r(vega, 4) };
      }
      if (Math.abs(vega) < 1e-10) break;
      sigma -= diff / (vega / 100);
      sigma  = Math.max(0.001, Math.min(sigma, 5.0));
    }
    let lo = 0.001, hi = 5.0;
    for (let i = 0; i < 200; i++) {
      iters++;
      const mid   = (lo + hi) / 2;
      const price = bsPrice(S, K, T, r_, mid, optionType);
      if (Math.abs(price - marketPrice) < tol) { sigma = mid; break; }
      price < marketPrice ? (lo = mid) : (hi = mid);
    }
    const finalVega = bsGreeks({ spot: S, strike: K, timeToExpiry: T, riskFreeRate: r_, volatility: sigma, optionType }).vega * 100;
    return { iv: r(sigma * 100, 4), ivDecimal: r(sigma, 6), converged: false, iterations: iters, error: r(Math.abs(bsPrice(S, K, T, r_, sigma, optionType) - marketPrice), 8), vegaAtSolution: r(finalVega, 4) };
  }

  static greeks(input: GreeksInput): Greeks { return bsGreeks(input); }

  static quickPrice(spot: number, strike: number, daysLeft: number, iv: number, r_: number): QuickPriceResult {
    const T     = daysToYears(daysLeft);
    const sigma = iv / 100;
    const ce = r(bsPrice(spot, strike, T, r_, sigma, "CE"), 2);
    const pe = r(bsPrice(spot, strike, T, r_, sigma, "PE"), 2);
    const ce_greeks   = bsGreeks({ spot, strike, timeToExpiry: T, riskFreeRate: r_, volatility: sigma, optionType: "CE" });
    const pe_greeks   = bsGreeks({ spot, strike, timeToExpiry: T, riskFreeRate: r_, volatility: sigma, optionType: "PE" });
    const ce_breakdown = PricingEngine.breakdown(spot, strike, T, r_, sigma, "CE");
    const pe_breakdown = PricingEngine.breakdown(spot, strike, T, r_, sigma, "PE");
    const syntheticFwd = r(ce - pe + strike * Math.exp(-r_ * T), 2);
    return { ce, pe, ce_greeks, pe_greeks, ce_breakdown, pe_breakdown, syntheticFwd };
  }

  static priceLeg(leg: OptionLeg, spot: number, r_: number, daysLeft: number): LegPricing {
    const { contract, action, lots, entryPrice, iv } = leg;
    const T      = daysToYears(Math.max(daysLeft, 0));
    const sigma  = iv / 100;
    const K      = contract.strike;
    const optType= contract.optionType;
    const qty    = lots * contract.lotSize;
    const m      = action === "BUY" ? 1 : -1;
    const bd     = PricingEngine.breakdown(spot, K, T, r_, sigma, optType);
    const g      = bsGreeks({ spot, strike: K, timeToExpiry: T, riskFreeRate: r_, volatility: sigma, optionType: optType });
    const currentPrice = bd.theoretical;
    const pnl          = r(m * (currentPrice - entryPrice) * qty, 2);
    const pnlPct       = entryPrice > 0 ? r((pnl / (entryPrice * qty)) * 100, 2) : 0;
    const deltaDollars = r(m * g.delta * qty * spot, 2);
    const thetaPerDay  = r(m * g.theta * qty, 2);
    const vegaPerPct   = r(m * g.vega  * qty, 2);
    return { legId: leg.id, symbol: contract.symbol, strike: K, optionType: optType, action, lots, qty, entryPrice, currentPrice: r(currentPrice, 2), breakdown: bd, greeks: g, pnl, pnlPct, deltaDollars, thetaPerDay, vegaPerPct };
  }

  static pricePortfolio(legs: OptionLeg[], spot: number, r_: number, daysLeft: number): PortfolioPricing {
    const pricedLegs = legs.map(leg => PricingEngine.priceLeg(leg, spot, r_, daysLeft));
    const sum = (fn: (l: LegPricing, leg: OptionLeg) => number) => pricedLegs.reduce((s, l, i) => s + fn(l, legs[i]), 0);
    const m   = (leg: OptionLeg) => leg.action === "BUY" ? 1 : -1;
    const qty = (leg: OptionLeg) => leg.lots * leg.contract.lotSize;
    const netDelta     = r(sum((l, leg) => m(leg) * l.greeks.delta * qty(leg)), 4);
    const netGamma     = r(sum((l, leg) => m(leg) * l.greeks.gamma * qty(leg)), 6);
    const netTheta     = r(sum((l, leg) => m(leg) * l.greeks.theta * qty(leg)), 2);
    const netVega      = r(sum((l, leg) => m(leg) * l.greeks.vega  * qty(leg)), 2);
    const netRho       = r(sum((l, leg) => m(leg) * l.greeks.rho   * qty(leg)), 2);
    const totalValue   = r(sum((l, leg) => m(leg) * l.currentPrice * qty(leg)), 2);
    const totalPnl     = r(pricedLegs.reduce((s, l) => s + l.pnl, 0), 2);
    const thetaPerDay  = r(pricedLegs.reduce((s, l) => s + l.thetaPerDay, 0), 2);
    const vegaPerPct   = r(pricedLegs.reduce((s, l) => s + l.vegaPerPct, 0), 2);
    const deltaExposure= r(netDelta * spot, 2);
    const netPremium = r(legs.reduce((s, leg) => { const sign = leg.action === "SELL" ? 1 : -1; return s + sign * leg.entryPrice * qty(leg); }, 0), 2);
    const totalCost = legs.reduce((s, leg) => s + leg.entryPrice * qty(leg), 0);
    const totalPnlPct = totalCost > 0 ? r((totalPnl / totalCost) * 100, 2) : 0;
    const marginRequired = r(legs.filter(l => l.action === "SELL").reduce((s, leg) => { const pl = pricedLegs.find(x => x.legId === leg.id)!; return s + pl.currentPrice * qty(leg) * 10; }, 0), 2);
    return { legs: pricedLegs, netPremium, netDelta, netGamma, netTheta, netVega, netRho, totalValue, totalPnl, totalPnlPct, marginRequired, thetaPerDay, vegaPerPct, deltaExposure };
  }

  static strikeLadder(spot: number, step: number, count: number, daysLeft: number, iv: number, r_: number): StrikeLadderRow[] {
    const T     = daysToYears(daysLeft);
    const sigma = iv / 100;
    const atm   = Math.round(spot / step) * step;
    const rows: StrikeLadderRow[] = [];
    for (let i = -count; i <= count; i++) {
      const K  = atm + i * step;
      const ce = bsGreeks({ spot, strike: K, timeToExpiry: T, riskFreeRate: r_, volatility: sigma, optionType: "CE" });
      const pe = bsGreeks({ spot, strike: K, timeToExpiry: T, riskFreeRate: r_, volatility: sigma, optionType: "PE" });
      const ce_iv = r(sigma * 100, 2);
      const pe_iv = r(sigma * 100, 2);
      const ce_int = Math.max(spot - K, 0);
      const pe_int = Math.max(K - spot, 0);
      rows.push({ strike: K, moneyness: K === atm ? "ATM" : i > 0 ? `+${i}` : `${i}`, ce_price: r(ce.price, 2), pe_price: r(pe.price, 2), ce_iv, pe_iv, ce_delta: r(ce.delta, 4), pe_delta: r(pe.delta, 4), ce_gamma: r(ce.gamma, 6), pe_gamma: r(pe.gamma, 6), ce_theta: r(ce.theta, 2), pe_theta: r(pe.theta, 2), ce_vega: r(ce.vega, 2), pe_vega: r(pe.vega, 2), ce_intrinsic: r(ce_int, 2), pe_intrinsic: r(pe_int, 2), ce_extrinsic: r(Math.max(ce.price - ce_int, 0), 2), pe_extrinsic: r(Math.max(pe.price - pe_int, 0), 2), isATM: K === atm });
    }
    return rows;
  }

  static intrinsicValue(S: number, K: number, optionType: "CE" | "PE"): number {
    return r(optionType === "CE" ? Math.max(S - K, 0) : Math.max(K - S, 0), 2);
  }

  static extrinsicValue(S: number, K: number, T: number, r_: number, sigma: number, optionType: "CE" | "PE"): number {
    const price     = bsPrice(S, K, T, r_, sigma, optionType);
    const intrinsic = PricingEngine.intrinsicValue(S, K, optionType);
    return r(Math.max(price - intrinsic, 0), 2);
  }
}

export { bsPrice, bsGreeks, calculateIV, daysToYears, spotRange };
