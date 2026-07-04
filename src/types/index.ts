// ─── Quote ───────────────────────────────────────────────────────────────────
export interface Quote {
  ltp  : number;
  ch   : number;
  chp  : number;
  open : number;
  high : number;
  low  : number;
  close: number;
  vol  : number;
  oi   : number;
}

export interface QuotesResponse {
  success: boolean;
  mock   : boolean;
  data   : Record<string, Quote>;
}

// ─── Health ──────────────────────────────────────────────────────────────────
export interface HealthResponse {
  status       : string;
  authenticated: boolean;
  mock_mode    : boolean;
  version      : string;
}

// ─── Option Chain ────────────────────────────────────────────────────────────
export interface OptionRow {
  strike  : number;
  ce_ltp  : number;
  pe_ltp  : number;
  ce_oi   : number;
  pe_oi   : number;
  ce_vol  : number;
  pe_vol  : number;
  ce_iv   : number;
  pe_iv   : number;
  ce_delta: number;
  pe_delta: number;
  atm     : boolean;
}

export interface LiveOptionRow {
  strike      : number;
  option_type : string;
  ltp         : number;
  oi          : number;
  volume      : number;
  symbol      : string;
}

export interface ChainResponse {
  success: boolean;
  mock   : boolean;
  spot   : number;
  data   : {
    expiryData: OptionRow[] | LiveOptionRow[];
    atmIndex  : number;
    optionsChain?: LiveOptionRow[];
  };
}

// ─── Greeks ──────────────────────────────────────────────────────────────────
export interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega : number;
  rho  : number;
  iv   : number;
  price: number;
}

export interface GreeksResponse {
  success: boolean;
  data   : Greeks;
}

// ─── Strategy ────────────────────────────────────────────────────────────────
export interface StrategyLeg {
  action : string;
  type   : string;
  strike : number;
  premium: number;
}

export interface Strategy {
  strategy   : string;
  signal     : string;
  entry      : number;
  sl         : number;
  target     : number;
  risk_reward: number;
  max_profit : number;
  max_loss   : number;
  breakeven  : number[];
  legs       : StrategyLeg[];
  description: string;
}

export interface StrategyResponse {
  success: boolean;
  data   : Strategy | Strategy[];
}

// ─── Scanner ─────────────────────────────────────────────────────────────────
export interface ScanResult {
  scanner  : string;
  symbol   : string;
  signal   : string;
  value    : number;
  condition: string;
  strength : string;
}

export interface ScannerResponse {
  success: boolean;
  symbol : string;
  ltp    : number;
  data   : ScanResult[];
}

// ─── Paper Trade ─────────────────────────────────────────────────────────────
export interface PaperOrder {
  order_id   : string;
  symbol     : string;
  option_type: string;
  strike     : number;
  expiry     : string;
  action     : string;
  qty        : number;
  entry_price: number;
  exit_price : number;
  sl         : number;
  target     : number;
  status     : string;
  entry_time : string;
  exit_time  : string;
  pnl        : number;
  mtm        : number;
}

export interface Portfolio {
  capital        : number;
  used_margin    : number;
  available      : number;
  open_positions : PaperOrder[];
  open_count     : number;
  unrealized_pnl : number;
  realized_pnl   : number;
  total_pnl      : number;
}

// ─── Backtest ─────────────────────────────────────────────────────────────────
export interface BacktestSummary {
  total        : number;
  wins         : number;
  losses       : number;
  win_rate     : number;
  total_pnl    : number;
  max_drawdown : number;
  avg_win      : number;
  avg_loss     : number;
  profit_factor: number;
  sharpe       : number;
}

export interface BacktestTrade {
  date: string;
  spot: number;
  iv  : number;
  prem: number;
  pnl : number;
  win : boolean;
}

export interface BacktestResponse {
  success     : boolean;
  summary     : BacktestSummary;
  trades      : BacktestTrade[];
  equity_curve: { date: string; equity: number }[];
}
