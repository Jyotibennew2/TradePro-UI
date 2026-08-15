// src/utils/niftyUniverse.ts
//
// Convenience preset symbol lists for the Equity Scanner "universe" field.
// These are commonly-known large-cap NSE constituents used as a quick-fill
// default — not a live index-membership feed. Index membership changes
// periodically; edit the scanner's universe textarea manually any time
// for exact/custom lists.

export const NIFTY_50: string[] = [
  'ADANIENT', 'ADANIPORTS', 'APOLLOHOSP', 'ASIANPAINT', 'AXISBANK',
  'BAJAJ-AUTO', 'BAJFINANCE', 'BAJAJFINSV', 'BEL', 'BHARTIARTL',
  'CIPLA', 'COALINDIA', 'DRREDDY', 'EICHERMOT', 'GRASIM',
  'HCLTECH', 'HDFCBANK', 'HDFCLIFE', 'HEROMOTOCO', 'HINDALCO',
  'HINDUNILVR', 'ICICIBANK', 'ITC', 'INDUSINDBK', 'INFY',
  'JSWSTEEL', 'KOTAKBANK', 'LT', 'M&M', 'MARUTI',
  'NESTLEIND', 'NTPC', 'ONGC', 'POWERGRID', 'RELIANCE',
  'SBILIFE', 'SHRIRAMFIN', 'SBIN', 'SUNPHARMA', 'TCS',
  'TATACONSUM', 'TATAMOTORS', 'TATASTEEL', 'TECHM', 'TITAN',
  'TRENT', 'ULTRACEMCO', 'WIPRO', 'SIEMENS', 'DIVISLAB',
];

export interface UniversePreset {
  key  : string;
  label: string;
  symbols: string[];
}

export const UNIVERSE_PRESETS: UniversePreset[] = [
  { key: 'custom',   label: 'Custom',   symbols: [] },
  { key: 'nifty50',  label: 'Nifty 50', symbols: NIFTY_50 },
];
