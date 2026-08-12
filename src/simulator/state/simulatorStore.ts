/**
 * TradePro Simulator - Zustand Store
 * Central state for the options simulator.
 *
 * ── Manual Exit pass ────────────────────────────────────────────────────
 * addLeg now stamps entryTime (epoch ms) on creation. A new exitLeg action
 * replaces direct removeLeg calls from Position Book's exit controls: it
 * validates the requested quantity, records an ExitRecord (persisted via
 * exitHistoryStorage), reduces the leg's remaining lots, and marks the leg
 * CLOSED (never deletes it) once lots reach 0 — preserving full exit
 * history for CLOSED legs instead of losing it when the leg used to be
 * removed outright. removeLeg itself is unchanged and still exists for
 * deleting a leg that was never exited (e.g. discarding a mistaken add).
 *
 * ── Persistence pass ────────────────────────────────────────────────────
 * `legs` is now persisted to localStorage via zustand's `persist`
 * middleware (key: "tradepro_simulator_legs"), so a CLOSED leg — and its
 * exit history, which is looked up by legId from exitHistoryStorage — is
 * still there after a refresh/reconnect instead of vanishing along with
 * the rest of the in-memory store. Only `legs` is persisted (via
 * `partialize`); every other field (market inputs, payoff, greeks,
 * isCalculating, strategyType) is intentionally excluded and keeps
 * resetting to its default on load exactly as before — those are
 * derived/session values, not part of what this task asked to persist.
 */

import { create }             from "zustand";
import { persist }            from "zustand/middleware";
import { v4 as uuidv4 }       from "uuid";
import type { OptionLeg, UnderlyingType } from "../models/Option";
import type { ExitRecord }                from "../models/Exit";
import type { StrategyType }              from "../models/Strategy";
import type { PayoffResult }              from "../models/Payoff";
import type { PortfolioGreeks }           from "../models/Greeks";
import { LOT_SIZES }                      from "../models/Option";
import { exitHistoryStorage }             from "../services/exitHistoryStorage";

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
  // Records a manual partial/full exit on a leg. Returns an error string
  // ("ALREADY_CLOSED" | "INVALID_QTY" | "NOT_FOUND") on rejection, or null
  // on success — callers (Position Book) surface the error inline rather
  // than allowing a duplicate/invalid/wrong-leg exit to mutate state.
  exitLeg   : (legId: string, exitQty: number, exitLtp: number) => string | null;

  // Actions — Strategy
  setStrategyType: (t: StrategyType) => void;

  // Actions — Results
  setPayoff       : (p: PayoffResult | null)    => void;
  setGreeks       : (g: PortfolioGreeks | null) => void;
  setIsCalculating: (v: boolean)                => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSimulatorStore = create<SimulatorState>()(
  persist(
    (set, get) => ({
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
        legs: [...state.legs, { ...leg, id: uuidv4(), entryTime: Date.now(), status: "OPEN" }],
      })),

      removeLeg: (id) => set(state => ({
        legs: state.legs.filter(l => l.id !== id),
      })),

      updateLeg: (id, patch) => set(state => ({
        legs: state.legs.map(l => l.id === id ? { ...l, ...patch } : l),
      })),

      clearLegs: () => set({ legs: [], payoff: null, greeks: null }),

      exitLeg: (legId, exitQty, exitLtp) => {
        const leg = get().legs.find(l => l.id === legId);
        if (!leg) return "NOT_FOUND";
        if (leg.status === "CLOSED") return "ALREADY_CLOSED";
        if (!Number.isFinite(exitQty) || exitQty <= 0) return "INVALID_QTY";
        if (!Number.isFinite(exitLtp) || exitLtp < 0) return "INVALID_QTY";

        // Clamp: exiting more than what's remaining exits everything
        // that's left (same behavior as before — "qty >= remaining" means
        // full exit) rather than rejecting the action or going negative.
        const qtyToExit = Math.min(exitQty, leg.lots);

        const sign = leg.action === "BUY" ? 1 : -1;
        const lotSize = leg.contract.lotSize ?? 1;
        const sliceRealized = (exitLtp - leg.entryPrice) * qtyToExit * lotSize * sign;

        const record: ExitRecord = {
          id: uuidv4(),
          legId,
          entryTime: leg.entryTime,
          exitTime: Date.now(),
          exitQty: qtyToExit,
          exitLtp,
          exitReason: "MANUAL",
          realizedPnl: sliceRealized,
        };
        exitHistoryStorage.add(record);

        const remainingLots = leg.lots - qtyToExit;
        set(state => ({
          legs: state.legs.map(l => l.id === legId ? {
            ...l,
            lots: remainingLots,
            realizedPnl: (l.realizedPnl ?? 0) + sliceRealized,
            status: remainingLots <= 0 ? "CLOSED" : "OPEN",
          } : l),
        }));
        return null;
      },

      // Strategy
      setStrategyType: (strategyType) => set({ strategyType }),

      // Results
      setPayoff       : (payoff)        => set({ payoff }),
      setGreeks       : (greeks)        => set({ greeks }),
      setIsCalculating: (isCalculating) => set({ isCalculating }),
    }),
    {
      name: "tradepro_simulator_legs",
      // Only `legs` survives a refresh/reconnect — every other field
      // (market inputs, payoff, greeks, strategyType) keeps resetting to
      // its default exactly as it did before this pass, since those are
      // session/derived values rather than positions the trader needs
      // preserved.
      partialize: (state) => ({ legs: state.legs }),
    }
  )
);

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
