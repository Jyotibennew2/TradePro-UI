import React, { useState } from 'react';
import type { SignalType } from '../signal_engine/SignalCard';
import { SignalList } from '../signal_engine/SignalCard';
import type { Signal } from '../signal_engine/SignalCard';

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
}

interface EquityScannerPanelProps {
  onScan: (filter: Omit<ScanFilter, ''>) => Promise<ScanResult[]>;
  defaultUniverse?: string;
}

export const EquityScannerPanel: React.FC<EquityScannerPanelProps> = ({
  onScan,
  defaultUniverse = 'RELIANCE,TCS,INFY,HDFCBANK,ICICIBANK,WIPRO,AXISBANK,SBIN,LT,ITC',
}) => {
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

  const handleScan = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await onScan(filter);
      setResults(data);
    } catch (e: any) {
      setError(e.message || 'Scan failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="scanner-panel">
      <h2 className="scanner-title">Equity Scanner</h2>

      {/* Universe */}
      <label className="field-label">Universe (comma-separated symbols)</label>
      <textarea
        className="scanner-universe"
        rows={2}
        value={universe}
        onChange={(e) => setUniverse(e.target.value)}
      />

      {/* Filters */}
      <div className="scanner-filters">
        <div className="filter-group">
          <label>Signal</label>
          <select
            value={filter.signal}
            onChange={(e) => setFilter({ ...filter, signal: e.target.value as SignalType | '' })}
          >
            <option value="">All</option>
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
            <option value="HOLD">HOLD</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Min Confidence</label>
          <input
            type="number" min={0} max={1} step={0.05}
            value={filter.minConfidence}
            onChange={(e) => setFilter({ ...filter, minConfidence: +e.target.value })}
          />
        </div>
        <div className="filter-group">
          <label>Min Volume</label>
          <input
            type="number" step={10000}
            value={filter.minVolume}
            onChange={(e) => setFilter({ ...filter, minVolume: +e.target.value })}
          />
        </div>
        <div className="filter-group">
          <label>Price Range (₹)</label>
          <input
            type="number" placeholder="Min"
            value={filter.minPrice}
            onChange={(e) => setFilter({ ...filter, minPrice: +e.target.value })}
          />
          <span style={{ margin: '0 4px' }}>–</span>
          <input
            type="number" placeholder="Max"
            value={filter.maxPrice}
            onChange={(e) => setFilter({ ...filter, maxPrice: +e.target.value })}
          />
        </div>
      </div>

      <button className="btn-scan" onClick={handleScan} disabled={loading}>
        {loading ? 'Scanning…' : '🔍 Run Scan'}
      </button>

      {error && <div className="scanner-error">{error}</div>}

      {/* Results */}
      {results.length > 0 && (
        <div className="scanner-results">
          <p>{results.length} stocks matched your criteria</p>
          <SignalList signals={results.map((r) => r.signal)} />
        </div>
      )}
    </div>
  );
};

export default EquityScannerPanel;
