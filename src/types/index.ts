export interface BacktestResponse {
  success     : boolean;
  symbol?     : string;
  data_source?: "LIVE" | "MOCK";
  summary     : BacktestSummary;
  trades      : BacktestTrade[];
  equity_curve: { date: string; equity: number }[];
}