/**
 * TradePro Simulator - Payoff Interfaces
 * Payoff diagram, P&L calculation interfaces.
 */

import type { OptionLeg } from "./Option";

// ─── Payoff point ─────────────────────────────────────────────────────────────
export interface PayoffPoint {
  spot      : number;
  pnl       : number;
  pnlPct    : number;    // % of max risk
  intrinsic : number;    // intrinsic value only
  timeValue : number;    // time value component
}

// ─── Payoff curve ─────────────────────────────────────────────────────────────
export interface PayoffCurve {
  points      : PayoffPoint[];
  maxProfit   : number;
  maxLoss     : number;
  breakevens  : number[];
  currentPnl  : number;
  currentSpot : number;
}

// ─── Leg payoff ───────────────────────────────────────────────────────────────
export interface LegPayoff {
  leg    : OptionLeg;
  points : PayoffPoint[];
  color  : string;
}

// ─── Payoff request ───────────────────────────────────────────────────────────
export interface PayoffRequest {
  legs        : OptionLeg[];
  spotRange   : { min: number; max: number; steps: number };
  daysToExpiry: number;
  riskFreeRate: number;
  useBS       : boolean;    // true = Black-Scholes, false = intrinsic only
}

// ─── Payoff result ────────────────────────────────────────────────────────────
export interface PayoffResult {
  combined    : PayoffCurve;
  perLeg      : LegPayoff[];
  netPremium  : number;
  marginReq   : number;
  rorPct      : number;    // return on risk %
}

// ─── Scenario analysis ────────────────────────────────────────────────────────
export interface Scenario {
  name        : string;
  spotChange  : number;    // % change from current
  ivChange    : number;    // % change in IV
  daysChange  : number;    // days passed
  pnl         : number;
  pnlPct      : number;
}

export interface ScenarioMatrix {
  baseSpot    : number;
  baseIV      : number;
  scenarios   : Scenario[];
  matrix      : ScenarioMatrixCell[][];   // spotChange x ivChange grid
}

export interface ScenarioMatrixCell {
  spotChange  : number;
  ivChange    : number;
  pnl         : number;
  pnlPct      : number;
}

// ─── Payoff colors ────────────────────────────────────────────────────────────
export const LEG_COLORS: string[] = [
  "#00c8f0",
  "#00d97e",
  "#f03060",
  "#9b5cf6",
  "#f0a030",
  "#ff6b6b",
];
