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

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE" });
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
 * see fetchArchivedExpiries) to pick a specific weekly/monthly contract.
 * Pass `time` (unix epoch seconds) to pick the snapshot closest to that
 * exact moment — used for replay/walk-forward stepping through the day;
 * omit both for the last snapshot of the day (closing chain).
 */
export const fetchArchivedChain = (symbol: string, date: string, expiry?: string, time?: number) =>
  get<ArchivedChainResponse>(
    `/optionchain/archive?symbol=${symbol}&date=${date}${expiry ? `&expiry=${expiry}` : ""}${time ? `&time=${time}` : ""}`
  );

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

/**
 * List every captured_at timestamp (unix epoch seconds) available for a
 * given symbol+expiry+capture date — used to step forward/backward through
 * the day's snapshots at whatever granularity the user picks.
 */
export const fetchArchivedTimes = (symbol: string, date: string, expiry: string) =>
  get<{ success: boolean; symbol: string; date: string; expiry: string; times: number[] }>(
    `/optionchain/archive/times?symbol=${symbol}&date=${date}&expiry=${expiry}`
  );

/** Archive DB diagnostics: total rows + file size in MB. */
export const fetchArchiveStats = () =>
  get<{ success: boolean; data: { rows: number; size_bytes: number; size_mb: number; path: string } }>(
    "/optionchain/archive/stats"
  );

// ─── Walk-Forward Backtest (real archived LTPs, not Black-Scholes) ───────────
export interface WalkForwardLeg {
  strike     : number;
  option_type: "CE" | "PE";
  action     : "BUY" | "SELL";
  lots       : number;
}

export interface WalkForwardResponse {
  success       : boolean;
  symbol        : string;
  expiry        : string;
  was_mock      : boolean;
  entry         : { t: number; spot: number; premium_abs: number };
  exit          : { t: number; spot: number; reason: string };
  sl_amount     : number;
  tgt_amount    : number;
  final_pnl     : number;
  equity_curve  : { t: number; pnl: number; spot: number }[];
  snapshots_used: number;
  note          : string;
}

export const runWalkForwardBacktest = (params: {
  symbol    : string;
  expiry    : string;   // YYYY-MM-DD
  entryTime : number;   // unix epoch seconds
  legs      : WalkForwardLeg[];
  lotSize   : number;
  slPct     : number;
  tgtPct    : number;
  exitTime? : number;
}) => post<WalkForwardResponse>("/backtest/walkforward", {
  symbol      : params.symbol,
  expiry      : params.expiry,
  entry_time  : params.entryTime,
  legs        : params.legs,
  lot_size    : params.lotSize,
  sl_pct      : params.slPct,
  tgt_pct     : params.tgtPct,
  exit_time   : params.exitTime,
});

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

// ─── Batch Backtest (V1 + Real-Data Multi-Leg Sweep) ───────────────────────────
// Sweeps strategies x symbols x timeframes (or, in walkforward mode, strategies
// x symbols x expiries x strikes against REAL archived option-chain data) via
// the backend BatchBacktestEngine, which itself calls the SAME
// run_synthetic_backtest/run_walkforward_backtest functions the single-run
// and walk-forward endpoints use — no duplicated calculation here.
export interface BatchGreeksFilter {
  min_iv?   : number;
  max_iv?   : number;
  min_delta?: number;
  max_delta?: number;
}

export type BatchRankMetric = "total_pnl" | "roi_pct" | "win_rate" | "max_drawdown" | "profit_factor" | "risk_reward";

export interface BatchJobSummary {
  total_pnl    : number;
  roi_pct      : number;
  win_rate     : number;
  max_drawdown : number;
  profit_factor: number;
  risk_reward  : number;
}

export interface BatchResultRow {
  job     : string;
  kind    : "synthetic" | "walkforward";
  symbol  : string;
  strategy?: string;
  resolution?: string;
  expiry? : string;
  legs?   : WalkForwardLeg[];
  summary : BatchJobSummary;
  rank    : number;
  stopped_early?: boolean;
  stop_reason?  : string | null;
  exit_reason?  : string;
}

export interface BatchBacktestResponse {
  success        : boolean;
  rank_by        : BatchRankMetric;
  /** Raw combination count BEFORE the backend's MAX_JOBS cap was applied. */
  requested_jobs : number;
  /** Combos actually executed — equal to requested_jobs unless capped. */
  total_jobs     : number;
  ranked         : BatchResultRow[];
  failed         : { job: string; error: string }[];
}

/** Multi-strategy / multi-instrument / multi-timeframe sweep. */
export const runBatchBacktest = (params: {
  strategies     : string[];
  symbols        : string[];
  resolutions?   : Timeframe[];
  days?          : number;
  lotSize?       : number;
  slPct?         : number;
  tgtPct?        : number;
  trailingSlPct? : number;
  greeksFilter?  : BatchGreeksFilter;
  rankBy?        : BatchRankMetric;
}) => post<BatchBacktestResponse>("/backtest/batch", {
  mode            : "synthetic",
  strategies      : params.strategies,
  symbols         : params.symbols,
  resolutions     : params.resolutions ?? ["1d"],
  days            : params.days ?? 90,
  lot_size        : params.lotSize ?? 50,
  sl_pct          : params.slPct ?? 50,
  tgt_pct         : params.tgtPct ?? 50,
  trailing_sl_pct : params.trailingSlPct,
  greeks_filter   : params.greeksFilter,
  rank_by         : params.rankBy ?? "total_pnl",
});

/**
 * Multi-instrument / multi-expiry / multi-strike sweep against REAL archived
 * option-chain data (not Black-Scholes).
 *
 * Pass `strategies` to replay actual multi-leg strategies (straddle/strangle/
 * ironCondor/longCall/longPut) — each `strikes` entry is treated as the ATM
 * anchor for that job and the strategy's real legs are built around it
 * server-side (backend/routes/backtest.py: strategy_leg_offsets()). Every
 * job is scoped to exactly one symbol + one expiry, so strikes/expiries are
 * never mixed across instruments.
 *
 * Omit `strategies` to fall back to the original single naked-leg sweep
 * (optionType/action apply in that case only).
 */
export const runBatchWalkForward = (params: {
  symbols       : string[];
  expiries      : string[];
  strikes       : number[];
  entryTime     : number;
  exitTime?     : number;
  strategies?   : string[];
  optionType?   : "CE" | "PE";
  action?       : "BUY" | "SELL";
  lots?         : number;
  lotSize?      : number;
  slPct?        : number;
  tgtPct?       : number;
  trailingSlPct?: number;
  rankBy?       : BatchRankMetric;
}) => post<BatchBacktestResponse>("/backtest/batch", {
  mode            : "walkforward",
  symbols         : params.symbols,
  expiries        : params.expiries,
  strikes         : params.strikes,
  entry_time      : params.entryTime,
  exit_time       : params.exitTime,
  strategies      : params.strategies,
  option_type     : params.optionType ?? "CE",
  action          : params.action ?? "BUY",
  lots            : params.lots ?? 1,
  lot_size        : params.lotSize ?? 50,
  sl_pct          : params.slPct ?? 50,
  tgt_pct         : params.tgtPct ?? 50,
  trailing_sl_pct : params.trailingSlPct,
  rank_by         : params.rankBy ?? "total_pnl",
});

// ─── Saved Backtests (Phase 1: save any backtest result, view it later) ──────
// Thin CRUD over whatever the frontend already has after calling
// runBacktest/runBatchBacktest/runBatchWalkForward/runWalkForwardBacktest —
// no new calculation, the backend just persists the request/result JSON.
export type SavedBacktestKind = "single" | "compare" | "batch" | "batch_realdata" | "walkforward";

export interface SavedBacktestListItem {
  id          : number;
  created_at  : number;   // unix epoch seconds
  label       : string | null;
  kind        : SavedBacktestKind;
  symbol      : string | null;
  data_source : string | null;
}

export interface SavedBacktestFull extends SavedBacktestListItem {
  request: any;
  result : any;
}

export const saveBacktest = (params: {
  kind       : SavedBacktestKind;
  request    : unknown;
  result     : unknown;
  label?     : string;
  symbol?    : string;
  dataSource?: string;
}) => post<{ success: boolean; id: number }>("/backtest/save", {
  kind        : params.kind,
  request     : params.request,
  result      : params.result,
  label       : params.label,
  symbol      : params.symbol,
  data_source : params.dataSource,
});

export const listSavedBacktests = (limit = 100) =>
  get<{ success: boolean; data: SavedBacktestListItem[] }>(`/backtest/saved?limit=${limit}`);

export const getSavedBacktest = (id: number) =>
  get<{ success: boolean; data: SavedBacktestFull }>(`/backtest/saved/${id}`);

export const deleteSavedBacktest = (id: number) =>
  del<{ success: boolean; deleted: number }>(`/backtest/saved/${id}`);

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
