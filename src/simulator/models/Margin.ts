/**
 * TradePro Simulator - Margin Interfaces
 * Margin calculation and risk management types.
 */

import type { UnderlyingType } from "./Option";

// ─── Margin types ─────────────────────────────────────────────────────────────
export type MarginType = "SPAN" | "EXPOSURE" | "TOTAL" | "PREMIUM";

// ─── Single leg margin ────────────────────────────────────────────────────────
export interface LegMargin {
  legId       : string;
  symbol      : string;
  strike      : number;
  optionType  : "CE" | "PE";
  action      : "BUY" | "SELL";
  lots        : number;
  spanMargin  : number;
  exposure    : number;
  premium     : number;
  total       : number;
}

// ─── Portfolio margin ─────────────────────────────────────────────────────────
export interface PortfolioMargin {
  legs          : LegMargin[];
  grossSpan     : number;
  grossExposure : number;
  hedgeBenefit  : number;    // margin reduction due to hedging
  netSpan       : number;
  netExposure   : number;
  totalMargin   : number;
  premiumPaid   : number;
  premiumReceived: number;
  netPremium    : number;
}

// ─── Margin config per underlying ─────────────────────────────────────────────
export interface MarginConfig {
  underlying      : UnderlyingType;
  spanPct         : number;    // % of contract value for SPAN
  exposurePct     : number;    // % of contract value for exposure
  hedgeDiscount   : number;    // % discount for hedged positions
}

// ─── Default margin configs ───────────────────────────────────────────────────
export const MARGIN_CONFIGS: Record<UnderlyingType, MarginConfig> = {
  NIFTY: {
    underlying   : "NIFTY",
    spanPct      : 0.085,
    exposurePct  : 0.03,
    hedgeDiscount: 0.75,
  },
  BANKNIFTY: {
    underlying   : "BANKNIFTY",
    spanPct      : 0.095,
    exposurePct  : 0.035,
    hedgeDiscount: 0.75,
  },
  MIDCPNIFTY: {
    underlying   : "MIDCPNIFTY",
    spanPct      : 0.10,
    exposurePct  : 0.04,
    hedgeDiscount: 0.70,
  },
};

// ─── Margin check result ──────────────────────────────────────────────────────
export interface MarginCheckResult {
  required    : number;
  available   : number;
  sufficient  : boolean;
  shortfall   : number;
  utilizationPct: number;
}

// ─── Risk limits ──────────────────────────────────────────────────────────────
export interface RiskLimits {
  maxMarginUtilization: number;    // e.g. 0.80 = 80%
  maxPositions        : number;
  maxLossPerDay       : number;
  maxLossPerTrade     : number;
  maxDelta            : number;
  maxVega             : number;
}

export const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxMarginUtilization: 0.80,
  maxPositions        : 10,
  maxLossPerDay       : 5000,
  maxLossPerTrade     : 2000,
  maxDelta            : 50,
  maxVega             : 10000,
};
