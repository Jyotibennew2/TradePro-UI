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

// ─── Expiries ────────────────────────────────────────────────────────────────
export interface ExpiryOption {
  expiry: string;   // raw Fyers value (unix timestamp string)
  date  : string;   // DD-MM-YYYY
}

/** Live/available expiries for a symbol's option chain (weekly + monthly). */
export const fetchExpiries = (symbol: string) =>
  get<{ success: boolean; mock: boolean; expiries: ExpiryOption[] }>(`/optionchain/expiries?symbol=${symbol}`);

// ─── Historical Option Chain (Black-Scholes reconstruction) ──────────────────
export interface HistoricalChainRow {
  strike  : number;
  ce_ltp  : number;
  pe_ltp  : number;
  ce_iv   : number;
  pe_iv   : number;
  ce_delta: number;
  pe_delta: number;
  ce_gamma: number;
  pe_gamma: number;
  ce_theta: number;
  pe_theta: number;
  ce_vega : number;
  pe_vega : number;
  atm     : boolean;
}

export interface HistoricalChainResponse {
  success      : boolean;
  symbol       : string;
  spot         : number;
  label        : string;
  reconstructed: boolean;
  note         : string;
  data: {
    expiryData: HistoricalChainRow[];
    atmIndex  : number;
  };
}

export const fetchHistoricalChain = (params: {
  symbol       : string;
  spot         : number;
  iv?          : number;
  daysToExpiry?: number;
  strikecount? : number;
  label?       : string;
}) => {
  const { symbol, spot, iv = 15, daysToExpiry = 7, strikecount = 10, label = "" } = params;
  return get<HistoricalChainResponse>(
    `/optionchain/historical?symbol=${symbol}&spot=${spot}&iv=${iv}&days_to_expiry=${daysToExpiry}&strikecount=${strikecount}&label=${encodeURIComponent(label)}`
  );
};

// ─── Real Archived Option Chain (saved automatically every ~5 min, per expiry) ─
// Full backtesting field set: timestamp, underlying price, expiry, strike,
// LTP, bid, ask, volume, OI, change in OI, IV, Delta, Gamma, Theta, Vega.
// IV + Greeks are backed out from the real saved LTP at capture time
// (assumed days-to-expiry — see days_to_expiry_used on the response).
export interface ArchivedChainRow {
  strike       : number;
  ce_ltp       : number;
  pe_ltp       : number;
  ce_bid?      : number;
  pe_bid?      : number;
  ce_ask?      : number;
  pe_ask?      : number;
  ce_oi?       : number;
  pe_oi?       : number;
  ce_oi_change?: number;
  pe_oi_change?: number;
  ce_volume?   : number;
  pe_volume?   : number;
  ce_iv?       : number;
  pe_iv?       : number;
  ce_delta?    : number;
  pe_delta?    : number;
  ce_gamma?    : number;
  pe_gamma?    : number;
  ce_theta?    : number;
  pe_theta?    : number;
  ce_vega?     : number;
  pe_vega?     : number;
  atm          : boolean;
}

export interface ArchivedChainResponse {
  success            : boolean;
  symbol             : string;
  date               : string;
  expiry             : string;   // YYYY-MM-DD contract expiry that was returned
  spot               : number;
  saved_at           : number;
  reconstructed      : false;
  was_mock           : boolean;
  days_to_expiry_used?: number;
  note               : string;
  data: {
    expiryData: ArchivedChainRow[];
    atmIndex  : number;
  };
}

/**
 * Fetch a real, previously-saved option-chain snapshot for a given capture
 * date (YYYY-MM-DD). Pass `expiry` (YYYY-MM-DD, the contract's own expiry —
 * see fetchArchivedExpiries) to pick a specific weekly/monthly contract;
 * omit it to get whichever expiry was archived nearest to that date.
 */
export const fetchArchivedChain = (symbol: string, date: string, expiry?: string) =>
  get<ArchivedChainResponse>(`/optionchain/archive?symbol=${symbol}&date=${date}${expiry ? `&expiry=${expiry}` : ""}`);

/**
 * List which capture dates have at least one real saved snapshot.
 * Pass `expiry` (YYYY-MM-DD) to restrict to that specific contract's dates;
 * omit it for the union across all archived expiries.
 */
export const fetchArchivedDates = (symbol: string, expiry?: string) =>
  get<{ success: boolean; symbol: string; expiry: string | null; dates: string[] }>(
    `/optionchain/archive/dates?symbol=${symbol}${expiry ? `&expiry=${expiry}` : ""}`
  );

/**
 * List archived expiry contracts (YYYY-MM-DD) for a symbol. Pass `date`
 * (capture date) to restrict to expiries that have data for that day.
 */
export const fetchArchivedExpiries = (symbol: string, date?: string) =>
  get<{ success: boolean; symbol: string; date: string | null; expiries: string[] }>(
    `/optionchain/archive/expiries?symbol=${symbol}${date ? `&date=${date}` : ""}`
  );

/** Archive DB diagnostics: total rows + file size in MB. */
export const fetchArchiveStats = () =>
  get<{ success: boolean; data: { rows: number; size_bytes: number; size_mb: number; path: string } }>(
    "/optionchain/archive/stats"
  );

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
