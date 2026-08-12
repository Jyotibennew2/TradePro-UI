/**
 * TradePro Simulator - Option Model
 * Core option leg and contract interfaces.
 */

export type OptionType   = "CE" | "PE";
export type ActionType   = "BUY" | "SELL";
export type UnderlyingType = "NIFTY" | "BANKNIFTY" | "MIDCPNIFTY";
export type ExpiryType   = "WEEKLY" | "MONTHLY";
export type PositionStatus = "OPEN" | "CLOSED";

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
  // Cumulative realized P&L (₹) from partial exits already taken on this
  // leg. Undefined/0 means nothing has been partially exited yet — the
  // leg's full remaining `lots` are still open. Set by Position Book's
  // partial-exit action; never touched by any pricing/Greeks calculation.
  realizedPnl?: number;
  // Epoch ms when this leg was created (via template, manual Add Leg, or
  // Option Chain "B/S"). Optional so legs created/saved before this field
  // existed (older saved strategies, imports) still load fine — Position
  // Book falls back to "-" for the Entry column when absent. Never
  // modified after creation, including across partial exits.
  entryTime?  : number;
  // "OPEN" (default when absent, for backward compatibility with legs
  // created before this field existed) while any lots remain; "CLOSED"
  // once a full exit brings remaining lots to 0. A CLOSED leg is never
  // removed from the store — it stays visible with its exit history so
  // Position Book can keep showing it after a full exit.
  status?     : PositionStatus;
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
