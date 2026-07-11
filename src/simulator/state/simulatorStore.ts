/**
 * TradePro Simulator - Zustand Store
 * Central state for the options simulator.
 */

import { create }       from "zustand";
import { v4 as uuidv4 } from "uuid";
import type { OptionLeg, UnderlyingType } from "../models/Option";
import type { StrategyType }              from "../models/Strategy";
import type { PayoffResult }              from "../models/Payoff";
import type { PortfolioGreeks }           from "../models/Greeks";
import { LOT_SIZES }                      from "../models/Option";

// ─── State shape ──────────────────────────────────────────────────────────────

interface SimulatorState {
  // Market
  underlying   : UnderlyingType;
  spot         : number;
  iv           : number;
  daysToExpiry : number;
  riskFreeRate : number;

  // Legs
  legs         : OptionLeg[];

  // Strategy
  strategyType : StrategyType;

  // Results
  payoff       : PayoffResult | null;
  greeks       : PortfolioGreeks | null;
  isCalculating: boolean;

  // Actions — Market
  setUnderlying  : (u: UnderlyingType) => void;
  setSpot        : (s: number)         => void;
  setIV          : (iv: number)        => void;
  setDaysToExpiry: (d: number)         => void;
  setRiskFreeRate: (r: number)         => void;

  // Actions — Legs
  addLeg    : (leg: Omit<OptionLeg, "id">) => void;
  setLegs   : (legs: OptionLeg[])          => void;
  removeLeg : (id: string)                 => void;
  updateLeg : (id: string, patch: Partial<OptionLeg>) => void;
  clearLegs : ()                           => void;

  // Actions — Strategy
  setStrategyType: (t: StrategyType) => void;

  // Actions — Results
  setPayoff       : (p: PayoffResult | null)    => void;
  setGreeks       : (g: PortfolioGreeks | null) => void;
  setIsCalculating: (v: boolean)                => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSimulatorStore = create<SimulatorState>((set) => ({
  // Market defaults
  underlying   : "NIFTY",
  spot         : 24300,
  iv           : 15,
  daysToExpiry : 7,
  riskFreeRate : 6.5,

  // Legs
  legs         : [],

  // Strategy
  strategyType : "CUSTOM",

  // Results
  payoff       : null,
  greeks       : null,
  isCalculating: false,

  // Market actions
  setUnderlying  : (underlying)   => set({ underlying, legs: [] }),
  setSpot        : (spot)         => set({ spot }),
  setIV          : (iv)           => set({ iv }),
  setDaysToExpiry: (daysToExpiry) => set({ daysToExpiry }),
  setRiskFreeRate: (riskFreeRate) => set({ riskFreeRate }),

  // Leg actions
  setLegs: (legs) => set({ legs, payoff: null, greeks: null }),

  addLeg: (leg) => set(state => ({
    legs: [...state.legs, { ...leg, id: uuidv4() }],
  })),

  removeLeg: (id) => set(state => ({
    legs: state.legs.filter(l => l.id !== id),
  })),

  updateLeg: (id, patch) => set(state => ({
    legs: state.legs.map(l => l.id === id ? { ...l, ...patch } : l),
  })),

  clearLegs: () => set({ legs: [], payoff: null, greeks: null }),

  // Strategy
  setStrategyType: (strategyType) => set({ strategyType }),

  // Results
  setPayoff       : (payoff)        => set({ payoff }),
  setGreeks       : (greeks)        => set({ greeks }),
  setIsCalculating: (isCalculating) => set({ isCalculating }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function makeOptionLeg(
  underlying : UnderlyingType,
  strike     : number,
  optionType : "CE" | "PE",
  action     : "BUY" | "SELL",
  lots       : number,
  premium    : number,
  iv         : number,
  expiry     : string,
): Omit<OptionLeg, "id"> {
  return {
    contract: {
      symbol    : underlying,
      strike,
      optionType,
      expiry,
      expiryType: "WEEKLY",
      lotSize   : LOT_SIZES[underlying],
      tickSize  : 0.05,
    },
    action,
    lots,
    entryPrice  : premium,
    currentPrice: premium,
    iv,
    isActive    : true,
  };
}
