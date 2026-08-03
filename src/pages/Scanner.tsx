import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchScanner } from "../utils/api";
import Badge from "../components/ui/Badge";
import Loader from "../components/ui/Loader";
import ErrorBox from "../components/ui/ErrorBox";
import { RefreshCw } from "lucide-react";
import { useTheme } from "../store/themeStore";

const SYMBOLS = ["NIFTY", "BANKNIFTY"];

const SCANNER_ICONS: Record<string, string> = {
  EMA          : "📈",
  RSI          : "📊",
  VWAP         : "💧",
  Breakout     : "🚀",
  VolumeBreakout: "📦",
  OHL          : "🕯️",
  Gap          : "⚡",
  InsideCandle : "🔲",
};

export default function Scanner() {
  const theme = useTheme();
  const [symbol, setSymbol] = useState("NIFTY");

  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey      : ["scanner", symbol],
    queryFn       : () => fetchScanner(symbol),
    refetchInterval: 15000,
  });

  const results = data?.data ?? [];
  const ltp     = data?.ltp  ?? 0;
  const updated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("en-IN") : "";

  const buys  = results.filter(r => r.signal === "BUY").length;
  const sells = results.filter(r => r.signal === "SELL").length;
  const neutral = results.filter(r => r.signal === "NEUTRAL").length;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-lg overflow-hidden"
          style={{ border: `1px solid ${theme.border.subtle}` }}>
          {SYMBOLS.map(s => (
            <button key={s} onClick={() => setSymbol(s)}
              className="px-3 py-1.5 text-sm font-bold transition-all"
              style={{
                background: symbol === s ? theme.accent.cyan : theme.bg.surfaceAlt,
                color     : symbol === s ? theme.bg.page : theme.text.muted,
              }}>
              {s}
            </button>
          ))}
        </div>
        <span className="text-sm" style={{ color: theme.text.muted }}>
          LTP: <span style={{ color: theme.accent.cyan, fontWeight: 700 }}>
            {ltp > 0 ? ltp.toLocaleString("en-IN") : "---"}
          </span>
        </span>
        <button onClick={() => refetch()}
          className="p-2 rounded-lg ml-auto"
          style={{ background: theme.border.subtle, color: theme.accent.cyan }}>
          <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
        </button>
      </div>

      {results.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "BUY",     count: buys,    color: theme.accent.green },
            { label: "SELL",    count: sells,   color: theme.accent.red },
            { label: "NEUTRAL", count: neutral, color: theme.text.muted },
          ].map(({ label, count, color }) => (
            <div key={label} className="rounded-xl p-3 text-center"
              style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}` }}>
              <div className="text-xl font-black" style={{ color }}>{count}</div>
              <div className="text-sm mt-1" style={{ color: theme.text.muted }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {updated && (
        <div className="text-right text-sm" style={{ color: theme.text.faint }}>
          Updated: {updated} • auto 15s
        </div>
      )}

      {isLoading && <Loader text="Running scanners..." />}
      {isError   && <ErrorBox message="Scanner failed" />}

      <div className="space-y-2">
        {results.map((r, i) => (
          <div key={i} className="rounded-xl p-3"
            style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}` }}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span>{SCANNER_ICONS[r.scanner] ?? "📡"}</span>
                <span className="text-sm font-bold" style={{ color: theme.text.secondary }}>
                  {r.scanner}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Badge label={r.signal}   variant={r.signal.toLowerCase()   as "buy" | "sell" | "neutral"} />
                <Badge label={r.strength} variant={r.strength.toLowerCase() as "strong" | "moderate" | "weak"} />
              </div>
            </div>
            <div className="text-sm mt-1" style={{ color: theme.text.muted }}>
              {r.condition}
            </div>
          </div>
        ))}
      </div>

      {!isLoading && results.length === 0 && (
        <div className="text-center py-16" style={{ color: theme.text.muted }}>
          <div className="text-3xl mb-2">📡</div>
          <div className="text-sm">No scanner results</div>
        </div>
      )}
    </div>
  );
}
