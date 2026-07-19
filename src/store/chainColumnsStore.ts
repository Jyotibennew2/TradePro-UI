/**
 * TradePro - Option Chain Column Visibility Store
 * Shared across Live Option Chain, Real Archived Chain, and Reconstructed
 * (Black-Scholes) Chain views so a user's column preferences stay
 * consistent everywhere and persist across sessions.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ChainColumns {
  oi       : boolean;
  oiChange : boolean;
  volume   : boolean;
  bid      : boolean;
  ask      : boolean;
  iv       : boolean;
  delta    : boolean;
  gamma    : boolean;
  theta    : boolean;
  vega     : boolean;
}

export const CHAIN_COLUMN_LABELS: Record<keyof ChainColumns, string> = {
  oi      : "OI",
  oiChange: "OI Chg",
  volume  : "Volume",
  bid     : "Bid",
  ask     : "Ask",
  iv      : "IV %",
  delta   : "Delta",
  gamma   : "Gamma",
  theta   : "Theta",
  vega    : "Vega",
};

interface ChainColumnsState {
  columns: ChainColumns;
  toggle : (key: keyof ChainColumns) => void;
  setAll : (visible: boolean) => void;
}

export const useChainColumnsStore = create<ChainColumnsState>()(
  persist(
    (set, get) => ({
      // LTP and Strike are always shown; these start as a sensible default
      columns: {
        oi: true, oiChange: false, volume: false, bid: false, ask: false,
        iv: true, delta: false, gamma: false, theta: false, vega: false,
      },
      toggle : (key) => set({ columns: { ...get().columns, [key]: !get().columns[key] } }),
      setAll : (visible) => set({
        columns: {
          oi: visible, oiChange: visible, volume: visible, bid: visible, ask: visible,
          iv: visible, delta: visible, gamma: visible, theta: visible, vega: visible,
        },
      }),
    }),
    { name: "tradepro-chain-columns" }
  )
);
