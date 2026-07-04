/**
 * TradePro Simulator - Option Model
 * Core option leg and contract interfaces.
 */

export type OptionType   = "CE" | "PE";
export type ActionType   = "BUY" | "SELL";
export type UnderlyingType = "NIFTY" | "BANKNIFTY" | "MIDCPNIFTY";
export type ExpiryType   = "WEEKLY" | "MONTHLY";

// ─── Option Contract ─────────────────────────────────────────────────────────
export interface OptionContract {
  symbol      : UnderlyingType;
  strike      : number;
  optionType  : OptionType;
  expiry      : string;          // ISO date string
  expiryType  : ExpiryType;
  lotSize     : number;
  tickSize    : number;
}

// ─── Option Leg ──────────────────────────────────────────────────────────────
export interface OptionLeg {
  id          : string;          // uuid
  contract    : OptionContract;
  action      : ActionType;
  lots        : number;
  entryPrice  : number;
  currentPrice: number;
  iv          : number;          // implied volatility %
  isActive    : boolean;
}

// ─── Option Quote ─────────────────────────────────────────────────────────────
export interface OptionQuote {
  symbol      : string;
  strike      : number;
  optionType  : OptionType;
  ltp         : number;
  bid         : number;
  ask         : number;
  oi          : number;
  volume      : number;
  iv          : number;
  delta       : number;
  gamma       : number;
  theta       : number;
  vega        : number;
  timestamp   : number;
}

// ─── Lot sizes ────────────────────────────────────────────────────────────────
export const LOT_SIZES: Record<UnderlyingType, number> = {
  NIFTY      : 50,
  BANKNIFTY  : 15,
  MIDCPNIFTY : 75,
};

// ─── Tick sizes ───────────────────────────────────────────────────────────────
export const TICK_SIZES: Record<UnderlyingType, number> = {
  NIFTY      : 0.05,
  BANKNIFTY  : 0.05,
  MIDCPNIFTY : 0.05,
};

// ─── Strike steps ─────────────────────────────────────────────────────────────
export const STRIKE_STEPS: Record<UnderlyingType, number> = {
  NIFTY      : 50,
  BANKNIFTY  : 100,
  MIDCPNIFTY : 25,
};
