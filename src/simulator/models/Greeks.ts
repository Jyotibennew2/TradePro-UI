/**
 * TradePro Simulator - Greeks Interfaces
 * All Greeks and IV related types.
 */

// ─── Single option Greeks ─────────────────────────────────────────────────────
export interface Greeks {
  delta : number;   // -1 to +1
  gamma : number;   // always positive
  theta : number;   // per day (negative for long)
  vega  : number;   // per 1% IV change
  rho   : number;   // per 1% rate change
  iv    : number;   // implied volatility %
  price : number;   // theoretical price
}

// ─── Portfolio Greeks (sum of all legs) ───────────────────────────────────────
export interface PortfolioGreeks {
  netDelta  : number;
  netGamma  : number;
  netTheta  : number;
  netVega   : number;
  netRho    : number;
  totalValue: number;
}

// ─── Greeks input params ──────────────────────────────────────────────────────
export interface GreeksInput {
  spot       : number;
  strike     : number;
  timeToExpiry: number;   // in years
  riskFreeRate: number;   // decimal e.g. 0.065
  volatility : number;    // decimal e.g. 0.18
  optionType : "CE" | "PE";
  marketPrice?: number;   // if provided, IV is calculated
}

// ─── IV Surface point ────────────────────────────────────────────────────────
export interface IVSurfacePoint {
  strike  : number;
  expiry  : string;
  iv      : number;
  delta   : number;
}

// ─── Greeks sensitivity ───────────────────────────────────────────────────────
export interface GreeksSensitivity {
  spotChange  : number;   // e.g. +100
  ivChange    : number;   // e.g. +1%
  daysChange  : number;   // e.g. -1
  pnlImpact   : number;
  deltaImpact : number;
  vegaImpact  : number;
  thetaImpact : number;
}
