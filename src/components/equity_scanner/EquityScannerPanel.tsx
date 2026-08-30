import React, { useState } from 'react';
import type { SignalType, Signal } from '../signal_engine/SignalCard';
import { SignalList } from '../signal_engine/SignalCard';
import { useTheme } from '../../store/themeStore';
import { UNIVERSE_PRESETS } from '../../utils/niftyUniverse';

interface ScanFilter {
  signal?: SignalType | '';
  minConfidence: number;
  minVolume: number;
  minPrice: number;
  maxPrice: number;
}

interface ScanResult {
  symbol: string;
  signal: Signal;
  avg_volume: number;
  last_price: number;
  mock?: boolean;
}

interface EquityScannerPanelProps {
  /**
   * Runs the scan. Receives the parsed universe (comma-separated symbols,
   * trimmed) plus the active filter — both are needed to actually run a scan.
   */
  onScan: (universe: string[], filter: ScanFilter) => Promise<ScanResult[]>;
  defaultUniverse?: string;
  /** Optional — when provided, each non-HOLD signal shows a "Paper Trade" button. */
  onPaperTrade?: (signal: Signal) => void;
}

export const EquityScannerPanel: React.FC<EquityScannerPanelProps> = ({
  onScan,
  defaultUniverse = 'RELIANCE,TCS,INFY,HDFCBANK,ICICIBANK,WIPRO,AXISBANK,SBIN,LT,ITC',
  onPaperTrade,
}) => {
  const theme = useTheme();
  const [preset, setPreset] = useState('custom');
  const [universe, setUniverse] = useState(defaultUniverse);
  const [filter, setFilter] = useState<ScanFilter>({
    signal: '',
    minConfidence: 0.6,
    minVolume: 100000,
    minPrice: 0,
    maxPrice: 999999,
  });
  const [results, setResults] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(0);

  const handlePresetChange = (key: string) => {
    setPreset(key);
    const p = UNIVERSE_PRESETS.find((x) => x.key === key);
    if (p && p.symbols.length > 0) {
      setUniverse(p.symbols.join(','));
    }
  };

  const handleScan = async () => {
    setLoading(true);
    setError(null);
    const symbolList = universe.split(',').map((s) => s.trim()).filter(Boolean);
    setScanCount(symbolList.length);
    try {
      const data = await onScan(symbolList, filter);
      setResults(data);
    } catch (e: any) {
      setError(e.message || 'Scan failed');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: theme.bg.surface,
    color     : theme.text.primary,
    border    : `1px solid ${theme.border.subtle}`,
  };

  const mockCount = results.filter((r) => r.mock).length;

  return (
    <div className="space-y-4">
      {/* Universe */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-bold tracking-wide uppercase"
            style={{ color: theme.text.muted }}>
            Universe (comma-separated symbols)
          </label>
          <select
            className="rounded-lg px-2 py-1 text-xs font-bold"
            style={inputStyle}
            value={preset}
            onChange={(e) => handlePresetChange(e.target.value)}
          >
            {UNIVERSE_PRESETS.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </div>
        <textarea
          className="w-full rounded-lg p-2 text-sm font-mono"
          style={inputStyle}
          rows={3}
          value={universe}
          onChange={(e) => { setUniverse(e.target.value); setPreset('custom'); }}
        />
        <p className="text-xs mt-1" style={{ color: theme.text.faint }}>
          {universe.split(',').map((s) => s.trim()).filter(Boolean).length} symbols in universe
          {preset === 'nifty50' && ' — Nifty 50 preset (edit freely, list may need periodic refresh)'}
        </p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold tracking-wide uppercase block mb-1"
            style={{ color: theme.text.muted }}>Signal</label>
          <select
            className="w-full rounded-lg p-2 text-sm"
            style={inputStyle}
            value={filter.signal}
            onChange={(e) => setFilter({ ...filter, signal: e.target.value as SignalType | '' })}
          >
            <option value="">All</option>
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
            <option value="HOLD">HOLD</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-bold tracking-wide uppercase block mb-1"
            style={{ color: theme.text.muted }}>Min Confidence</label>
          <input
            className="w-full rounded-lg p-2 text-sm"
            style={inputStyle}
            type="number" min={0} max={1} step={0.05}
            value={filter.minConfidence}
            onChange={(e) => setFilter({ ...filter, minConfidence: +e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-bold tracking-wide uppercase block mb-1"
            style={{ color: theme.text.muted }}>Min Volume</label>
          <input
            className="w-full rounded-lg p-2 text-sm"
            style={inputStyle}
            type="number" step={10000}
            value={filter.minVolume}
            onChange={(e) => setFilter({ ...filter, minVolume: +e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-bold tracking-wide uppercase block mb-1"
            style={{ color: theme.text.muted }}>Price Range (₹)</label>
          <div className="flex items-center gap-2">
            <input
              className="w-full rounded-lg p-2 text-sm"
              style={inputStyle}
              type="number" placeholder="Min"
              value={filter.minPrice}
              onChange={(e) => setFilter({ ...filter, minPrice: +e.target.value })}
            />
            <span style={{ color: theme.text.faint }}>–</span>
            <input
              className="w-full rounded-lg p-2 text-sm"
              style={inputStyle}
              type="number" placeholder="Max"
              value={filter.maxPrice}
              onChange={(e) => setFilter({ ...filter, maxPrice: +e.target.value })}
            />
          </div>
        </div>
      </div>

      <button
        onClick={handleScan}
        disabled={loading}
        className="w-full py-2.5 rounded-lg text-sm font-bold transition-opacity"
        style={{
          background: theme.accent.cyan,
          color     : theme.bg.page,
          opacity   : loading ? 0.6 : 1,
        }}
      >
        {loading ? `Scanning ${scanCount} symbols…` : '🔍 Run Scan'}
      </button>

      {error && (
        <div className="rounded-lg p-3 text-sm"
          style={{ background: theme.accent.red + '15', color: theme.accent.red, border: `1px solid ${theme.accent.red}40` }}>
          {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div>
          <p className="text-sm mb-1" style={{ color: theme.text.muted }}>
            {results.length} stocks matched your criteria
          </p>
          {mockCount > 0 && (
            <div className="rounded-lg p-2 mb-2 text-xs"
              style={{ background: theme.accent.orange + '15', color: theme.accent.orange, border: `1px solid ${theme.accent.orange}40` }}>
              ⚠️ {mockCount}/{results.length} symbol(s) used MOCK data (Fyers historical call failed or is unauthenticated for these) — signals for these are not reliable. Check backend terminal logs for "History error".
            </div>
          )}
          <SignalList signals={results.map((r) => r.signal)} onPaperTrade={onPaperTrade} />
        </div>
      )}
    </div>
  );
};

export default EquityScannerPanel;
