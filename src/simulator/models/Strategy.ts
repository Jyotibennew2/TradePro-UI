/**
 * TradePro Simulator - Strategy Model
 * Strategy definitions, legs, and results.
 */

import type { OptionLeg, UnderlyingType } from "./Option";
import type { PortfolioGreeks }           from "./Greeks";

// ─── Strategy types ───────────────────────────────────────────────────────────
export type StrategyType =
  | "LONG_CALL"
  | "LONG_PUT"
  | "SHORT_CALL"
  | "SHORT_PUT"
  | "SHORT_STRADDLE"
  | "SHORT_STRANGLE"
  | "IRON_CONDOR"
  | "IRON_FLY"
  | "BULL_CALL_SPREAD"
  | "BEAR_PUT_SPREAD"
  | "BULL_PUT_SPREAD"
  | "BEAR_CALL_SPREAD"
  | "CUSTOM";

export type StrategySignal  = "BUY" | "SELL" | "NEUTRAL";
export type StrategyStatus  = "DRAFT" | "ACTIVE" | "CLOSED" | "EXPIRED";
export type MarketOutlook   = "BULLISH" | "BEARISH" | "NEUTRAL" | "VOLATILE" | "SIDEWAYS";

// ─── Strategy definition ──────────────────────────────────────────────────────
export interface StrategyDefinition {
  type       : StrategyType;
  name       : string;
  description: string;
  outlook    : MarketOutlook;
  maxProfit  : "UNLIMITED" | number;
  maxLoss    : "UNLIMITED" | number;
  legs       : number;
  complexity : "BASIC" | "INTERMEDIATE" | "ADVANCED";
}

// ─── Strategy leg template ────────────────────────────────────────────────────
export interface StrategyLegTemplate {
  action      : "BUY" | "SELL";
  optionType  : "CE" | "PE";
  strikeOffset: number;    // 0 = ATM, +1 = 1 strike OTM, -1 = ITM
  lots        : number;
}

// ─── Built strategy ───────────────────────────────────────────────────────────
export interface BuiltStrategy {
  id          : string;
  type        : StrategyType;
  name        : string;
  underlying  : UnderlyingType;
  spot        : number;
  legs        : OptionLeg[];
  netPremium  : number;     // positive = credit, negative = debit
  maxProfit   : number;
  maxLoss     : number;
  breakevens  : number[];
  greeks      : PortfolioGreeks;
  status      : StrategyStatus;
  createdAt   : number;
  updatedAt   : number;
}

// ─── Strategy result ──────────────────────────────────────────────────────────
export interface StrategyResult {
  strategy   : StrategyType;
  signal     : StrategySignal;
  entry      : number;
  sl         : number;
  target     : number;
  riskReward : number;
  maxProfit  : number | "UNLIMITED";
  maxLoss    : number | "UNLIMITED";
  breakevens : number[];
  legs       : StrategyLegResult[];
  description: string;
  outlook    : MarketOutlook;
}

export interface StrategyLegResult {
  action  : "BUY" | "SELL";
  type    : "CE" | "PE";
  strike  : number;
  premium : number;
  lots    : number;
}

// ─── Strategy catalog ─────────────────────────────────────────────────────────
export const STRATEGY_CATALOG: Record<StrategyType, StrategyDefinition> = {
  LONG_CALL: {
    type: "LONG_CALL", name: "Long Call", legs: 1,
    description: "Buy ATM/OTM call — unlimited upside, limited risk",
    outlook: "BULLISH", maxProfit: "UNLIMITED", maxLoss: 0,
    complexity: "BASIC",
  },
  LONG_PUT: {
    type: "LONG_PUT", name: "Long Put", legs: 1,
    description: "Buy ATM/OTM put — profit on downside",
    outlook: "BEARISH", maxProfit: "UNLIMITED", maxLoss: 0,
    complexity: "BASIC",
  },
  SHORT_CALL: {
    type: "SHORT_CALL", name: "Short Call", legs: 1,
    description: "Sell call — collect premium, unlimited risk",
    outlook: "BEARISH", maxProfit: 0, maxLoss: "UNLIMITED",
    complexity: "BASIC",
  },
  SHORT_PUT: {
    type: "SHORT_PUT", name: "Short Put", legs: 1,
    description: "Sell put — collect premium, limited upside",
    outlook: "BULLISH", maxProfit: 0, maxLoss: "UNLIMITED",
    complexity: "BASIC",
  },
  SHORT_STRADDLE: {
    type: "SHORT_STRADDLE", name: "Short Straddle", legs: 2,
    description: "Sell ATM CE + PE — profit if market stays flat",
    outlook: "SIDEWAYS", maxProfit: 0, maxLoss: "UNLIMITED",
    complexity: "INTERMEDIATE",
  },
  SHORT_STRANGLE: {
    type: "SHORT_STRANGLE", name: "Short Strangle", legs: 2,
    description: "Sell OTM CE + PE — wider range, lower premium",
    outlook: "SIDEWAYS", maxProfit: 0, maxLoss: "UNLIMITED",
    complexity: "INTERMEDIATE",
  },
  IRON_CONDOR: {
    type: "IRON_CONDOR", name: "Iron Condor", legs: 4,
    description: "Sell inner, buy outer strikes — defined risk",
    outlook: "SIDEWAYS", maxProfit: 0, maxLoss: 0,
    complexity: "ADVANCED",
  },
  IRON_FLY: {
    type: "IRON_FLY", name: "Iron Fly", legs: 4,
    description: "Sell ATM straddle, buy wings — defined risk",
    outlook: "SIDEWAYS", maxProfit: 0, maxLoss: 0,
    complexity: "ADVANCED",
  },
  BULL_CALL_SPREAD: {
    type: "BULL_CALL_SPREAD", name: "Bull Call Spread", legs: 2,
    description: "Buy lower CE, sell higher CE — capped profit",
    outlook: "BULLISH", maxProfit: 0, maxLoss: 0,
    complexity: "INTERMEDIATE",
  },
  BEAR_PUT_SPREAD: {
    type: "BEAR_PUT_SPREAD", name: "Bear Put Spread", legs: 2,
    description: "Buy higher PE, sell lower PE — capped profit",
    outlook: "BEARISH", maxProfit: 0, maxLoss: 0,
    complexity: "INTERMEDIATE",
  },
  BULL_PUT_SPREAD: {
    type: "BULL_PUT_SPREAD", name: "Bull Put Spread", legs: 2,
    description: "Sell higher PE, buy lower PE — credit spread",
    outlook: "BULLISH", maxProfit: 0, maxLoss: 0,
    complexity: "INTERMEDIATE",
  },
  BEAR_CALL_SPREAD: {
    type: "BEAR_CALL_SPREAD", name: "Bear Call Spread", legs: 2,
    description: "Sell lower CE, buy higher CE — credit spread",
    outlook: "BEARISH", maxProfit: 0, maxLoss: 0,
    complexity: "INTERMEDIATE",
  },
  CUSTOM: {
    type: "CUSTOM", name: "Custom Strategy", legs: 0,
    description: "Build your own multi-leg strategy",
    outlook: "NEUTRAL", maxProfit: "UNLIMITED", maxLoss: "UNLIMITED",
    complexity: "ADVANCED",
  },
};
