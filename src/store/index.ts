import { create } from "zustand";

// ─── App Store ────────────────────────────────────────────────────────────────
interface AppState {
  // Server
  isLive     : boolean;
  isMock     : boolean;
  setLive    : (v: boolean) => void;
  setMock    : (v: boolean) => void;

  // Quotes
  nifty      : number;
  bankNifty  : number;
  setNifty   : (v: number) => void;
  setBankNifty: (v: number) => void;

  // Option Chain
  chainSymbol  : string;
  chainExpiry  : string;
  setChainSymbol: (v: string) => void;
  setChainExpiry: (v: string) => void;

  // Scanner
  scannerSymbol   : string;
  setScannerSymbol: (v: string) => void;

  // Strategy
  strategySymbol   : string;
  strategyName     : string;
  setStrategySymbol: (v: string) => void;
  setStrategyName  : (v: string) => void;

  // Paper Trade
  paperSymbol   : string;
  setPaperSymbol: (v: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Server
  isLive      : false,
  isMock      : true,
  setLive     : (v) => set({ isLive: v }),
  setMock     : (v) => set({ isMock: v }),

  // Quotes
  nifty       : 0,
  bankNifty   : 0,
  setNifty    : (v) => set({ nifty: v }),
  setBankNifty: (v) => set({ bankNifty: v }),

  // Option Chain
  chainSymbol   : "NIFTY",
  chainExpiry   : "",
  setChainSymbol: (v) => set({ chainSymbol: v }),
  setChainExpiry: (v) => set({ chainExpiry: v }),

  // Scanner
  scannerSymbol   : "NIFTY",
  setScannerSymbol: (v) => set({ scannerSymbol: v }),

  // Strategy
  strategySymbol   : "NIFTY",
  strategyName     : "all",
  setStrategySymbol: (v) => set({ strategySymbol: v }),
  setStrategyName  : (v) => set({ strategyName: v }),

  // Paper Trade
  paperSymbol   : "NIFTY",
  setPaperSymbol: (v) => set({ paperSymbol: v }),
}));
