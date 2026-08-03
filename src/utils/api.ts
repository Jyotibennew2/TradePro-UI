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

/**
 * Tries to surface the backend's actual error message (e.g. "No matching
 * rows found for batch ...") instead of a generic "HTTP 404" - important
 * for delete/mutation calls where a silent failure otherwise looks like
 * nothing happened at all.
 */
async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE" });
  if (!res.ok) {
    let message = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // response wasn't JSON - keep the generic message
    }
    throw new Error(message);
  }
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

// ─── Multi-scenario Batch Backtest (many expiries x strikes x timeframes x
// strategies, incl. Greeks-driven Delta-Neutral / Theta-Harvest, in one run) ──
export type BatchStrategy = "straddle" | "strangle" | "iron_condor" | "delta_neutral" | "theta_harvest";

export interface BatchTriggerResponse {
  success: boolean;
  job_id : string;
  status : "running";
  note   : string;
}

export interface BatchStatusResponse {
  success: boolean;
  job_id : string;
  status : "running" | "done" | "error";
  result : { batch_id: string; scenarios_run: number; saved: number; skipped: number } | null;
  error  : string | null;
}

export const runBatchBacktest = (params: {
  symbols               : string[];
  strategies?           : BatchStrategy[];
  strikeOffsets?        : number[];
  timeframes?           : string[];
  slPct?                : number;
  tgtPct?                : number;
  lots?                  : number;
  maxEntriesPerExpiry?   : number;
}) => post<BatchTriggerResponse>("/backtest/batch", {
  symbols                : params.symbols,
  strategies             : params.strategies,
  strike_offsets         : params.strikeOffsets,
  timeframes             : params.timeframes,
  sl_pct                 : params.slPct ?? 50,
  tgt_pct                : params.tgtPct ?? 50,
  lots                   : params.lots ?? 1,
  max_entries_per_expiry : params.maxEntriesPerExpiry ?? 20,
});

export const fetchBatchStatus = (jobId: string) =>
  get<BatchStatusResponse>(`/backtest/batch/status/${jobId}`);

export interface BatchListItem {
  batch_id  : string;
  created_at: number;
  n         : number;
  total_pnl : number;
  avg_pnl   : number;
  wins      : number;
}

/** Recent batch runs, most recent first — persisted in SQLite, survives server restarts. */
export const fetchBatchList = (limit = 20) =>
  get<{ success: boolean; batches: BatchListItem[] }>(`/backtest/batch/list?limit=${limit}`);

/**
 * Permanently delete results for one batch run. Cannot be undone.
 *
 * - deleteBatch(batchId): removes the ENTIRE batch (every symbol/strategy).
 * - deleteBatch(batchId, symbol, strategy): removes just that one group
 *   within the batch (e.g. drop "straddle" but keep "theta_harvest"),
 *   leaving the rest of the batch intact.
 */
export const deleteBatch = (batchId: string, symbol?: string, strategy?: string) => {
  const qs = [
    symbol   ? `symbol=${symbol}`     : null,
    strategy ? `strategy=${strategy}` : null,
  ].filter(Boolean).join("&");
  return del<{ success: boolean; batch_id: string; symbol: string | null; strategy: string | null; deleted_rows: number }>(
    `/backtest/batch/${batchId}${qs ? `?${qs}` : ""}`
  );
};

export interface BatchGroupSummary {
  symbol   : string;
  strategy : string;
  n        : number;
  total_pnl: number;
  avg_pnl  : number;
  wins     : number;
  best_pnl : number;
  worst_pnl: number;
  win_rate : number;
}

/** Grouped (symbol, strategy) aggregate results for one batch run, best total PnL first. */
export const fetchBatchSummary = (batchId: string) =>
  get<{ success: boolean; batch_id: string; groups: BatchGroupSummary[] }>(
    `/backtest/batch/results?batch_id=${batchId}&summary=true`
  );

/** One option leg as it was actually traded in a batch-backtest scenario. */
export interface BatchLeg {
  strike     : number;
  option_type: "CE" | "PE";
  action     : "BUY" | "SELL";
  lots       : number;
}

export interface BatchResultRow {
  id           : number;
  batch_id     : string;
  created_at   : number;
  symbol       : string;
  strategy     : string;
  expiry_date  : string;    // YYYY-MM-DD - which expiry contract this trade used
  strike_offset: number;
  timeframe    : string;
  legs         : BatchLeg[]; // exact strikes/CE-PE/BUY-SELL/lots that were traded
  entry_spot   : number;
  entry_premium: number;    // total premium collected/paid at entry
  sl_amount    : number;    // stop-loss amount actually applied (currency, not %)
  tgt_amount   : number;    // target amount actually applied
  entry_t      : number;
  exit_t       : number;
  exit_spot    : number;
  exit_reason  : string;    // "SL Hit" | "Target Hit" | "data_ended"
  pnl          : number;
  was_mock     : number;
}

/**
 * Individual scenario results for one batch run, ranked best PnL first -
 * each row includes the exact legs traded, SL/target amounts applied, and
 * exit reason, so any result can be fully explained (which expiry, which
 * strike, buy or sell, how much SL, why it exited).
 *
 * Pass symbol/strategy to drill into one group from the summary view
 * (e.g. the row the user tapped on) instead of the whole batch.
 */
export const fetchBatchResults = (batchId: string, symbol?: string, strategy?: string, limit = 100) =>
  get<{ success: boolean; batch_id: string; results: BatchResultRow[] }>(
    `/backtest/batch/results?batch_id=${batchId}${symbol ? `&symbol=${symbol}` : ""}${strategy ? `&strategy=${strategy}` : ""}&limit=${limit}`
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

/** One paper-trade order exactly as PaperOrder.to_dict() serializes it. */
export interface PaperOrderRecord {
  order_id        : string;
  symbol          : string;
  option_type     : string;
  strike          : number;
  expiry          : string;
  action           : "BUY" | "SELL";
  qty             : number;
  entry_price     : number;
  exit_price      : number;
  sl              : number;
  target          : number;
  status          : "OPEN" | "CLOSED" | "SL_HIT" | "TARGET_HIT";
  entry_time      : string;   // formatted display string, e.g. "02 Aug 14:30:00"
  exit_time       : string;   // formatted display string, "" if still open
  entry_time_epoch: number;   // unix seconds - use this for charts/sorting
  exit_time_epoch : number;   // unix seconds, 0 if still open
  pnl             : number;
  mtm             : number;
}

/** Last N closed paper trades, most-recent-last (chronological order). */
export const fetchHistory = (limit = 50) =>
  get<{ success: boolean; data: PaperOrderRecord[] }>(`/papertrade?action=history&limit=${limit}`);

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
