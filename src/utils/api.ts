import type {
  HealthResponse,
  QuotesResponse,
  ChainResponse,
  GreeksResponse,
  StrategyResponse,
  ScannerResponse,
  Portfolio,
  BacktestResponse,
} from "../types";

const BASE = "/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method : "POST",
    headers: { "Content-Type": "application/json" },
    body   : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
}

export type Timeframe = "5m" | "15m" | "30m" | "1h" | "2h" | "1d";

// ─── Health ──────────────────────────────────────────────────────────────────
export const fetchHealth = () =>
  get<HealthResponse>("/health");

// ─── Quotes ──────────────────────────────────────────────────────────────────
export const fetchQuotes = (symbols: string = "NSE:NIFTY50-INDEX,NSE:NIFTYBANK-INDEX,NSE:NIFTYMID100-INDEX") =>
  get<QuotesResponse>(`/quotes?symbols=${symbols}`);

// ─── Option Chain ─────────────────────────────────────────────────────────────
export const fetchChain = (symbol: string, expiry = "", strikecount = 10) =>
  get<ChainResponse>(`/optionchain?symbol=${symbol}&expiry=${expiry}&strikecount=${strikecount}`);

// ─── Greeks ──────────────────────────────────────────────────────────────────
export const fetchGreeks = (spot: number, strike: number, expiry: number, iv: number, type: string) =>
  get<GreeksResponse>(`/greeks?spot=${spot}&strike=${strike}&expiry=${expiry}&iv=${iv}&type=${type}`);

// ─── Strategy ────────────────────────────────────────────────────────────────
export const fetchStrategy = (spot: number, expiry: number, iv: number, name = "all") =>
  get<StrategyResponse>(`/strategy?spot=${spot}&expiry=${expiry}&iv=${iv}&name=${name}`);

// ─── Scanner ─────────────────────────────────────────────────────────────────
export const fetchScanner = (symbol: string) =>
  get<ScannerResponse>(`/scanner?symbol=${symbol}`);

// ─── Paper Trade ─────────────────────────────────────────────────────────────
export const fetchPortfolio = () =>
  get<{ success: boolean; data: Portfolio }>("/papertrade?action=portfolio");

export const fetchHistory = (limit = 50) =>
  get<{ success: boolean; data: unknown[] }>(`/papertrade?action=history&limit=${limit}`);

export const placePaperOrder = (order: {
  symbol      : string;
  option_type : string;
  strike      : number;
  expiry      : string;
  action      : string;
  qty         : number;
  entry_price : number;
  sl          : number;
  target      : number;
}) => post<{ success: boolean; order_id?: string; error?: string }>("/papertrade", order);

export const exitPaperOrder = (order_id: string, exit_price: number) =>
  post<{ success: boolean; pnl?: number }>("/papertrade/exit", { order_id, exit_price });

export const modifyPaperOrder = (order_id: string, sl?: number, target?: number) =>
  post<{ success: boolean }>("/papertrade/modify", { order_id, sl, target });

// ─── Portfolio ───────────────────────────────────────────────────────────────
export const fetchPortfolioSummary = () =>
  get<{ success: boolean; data: unknown }>("/portfolio?action=summary");

// ─── Backtest ─────────────────────────────────────────────────────────────────
export const runBacktest = (params: {
  symbol    ?: string;
  strategy  : string;
  days      : number;
  resolution?: Timeframe;
  sl_pct    : number;
  tgt_pct   : number;
  lot_size  : number;
}) => post<BacktestResponse>("/backtest", params);

// ─── Historical ──────────────────────────────────────────────────────────────
export const fetchHistorical = (symbol: string, days = 30, resolution: Timeframe = "1d") =>
  get<{
    success   : boolean;
    symbol    : string;
    interval  : string;
    days_used?: number;
    candles   : { t: number; open: number; high: number; low: number; close: number; volume: number }[];
    mock      : boolean;
  }>(`/historical?symbol=${symbol}&days=${days}&resolution=${resolution}`);

// ─── Funds ───────────────────────────────────────────────────────────────────
export const fetchFunds = () =>
  get<{ success: boolean; mock: boolean; data: { total: number; used: number; available: number } }>("/funds");
