import type { Timeframe, HistoricalChainRow, ArchivedChainRow } from "../../utils/api";
import type { Theme } from "../../styles/theme";

export const STRATEGIES = [
  { key: "straddle",   label: "Short Straddle"  },
  { key: "strangle",   label: "Short Strangle"  },
  { key: "ironCondor", label: "Iron Condor"      },
  { key: "longCall",   label: "Long Call"        },
  { key: "longPut",    label: "Long Put"         },
];

export const SYMBOLS = ["NIFTY", "BANKNIFTY"];

export const TIMEFRAMES: { key: Timeframe; label: string; maxDays: number }[] = [
  { key: "5m",  label: "5 Min",  maxDays: 30  },
  { key: "15m", label: "15 Min", maxDays: 60  },
  { key: "30m", label: "30 Min", maxDays: 90  },
  { key: "1h",  label: "1 Hour", maxDays: 180 },
  { key: "2h",  label: "2 Hour", maxDays: 270 },
  { key: "1d",  label: "1 Day",  maxDays: 365 },
];

export const EXPIRY_PRESETS = [
  { label: "Weekly (7d)",   days: 7  },
  { label: "Monthly (30d)", days: 30 },
];

export type Mode = "single" | "compare" | "historical" | "batch";
export type AnyChainRow = HistoricalChainRow | ArchivedChainRow;

export function StatBox({ label, value, color, theme }: { label: string; value: string; color: string; theme: Theme }) {
  return (
    <div className="rounded-xl p-3 text-center"
      style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}` }}>
      <div className="text-sm mb-1" style={{ color: theme.text.muted }}>{label}</div>
      <div className="text-sm font-black" style={{ color }}>{value}</div>
    </div>
  );
}

export function DataSourceBadge({ source, theme }: { source?: "LIVE" | "MOCK"; theme: Theme }) {
  if (!source) return null;
  const isLive = source === "LIVE";
  return (
    <span className="text-sm px-2 py-0.5 rounded font-bold flex items-center gap-1"
      style={{
        background: isLive ? theme.accent.green + "20" : theme.accent.orange + "20",
        color     : isLive ? theme.accent.green : theme.accent.orange,
      }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: isLive ? theme.accent.green : theme.accent.orange }} />
      {isLive ? "LIVE historical data" : "MOCK historical data"}
    </span>
  );
}

export const fmt    = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
export const fmtPct = (n: number) => `${n.toFixed(1)}%`;
export const fmtExpiryLabel = (d: string) => {
  try { return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
};
