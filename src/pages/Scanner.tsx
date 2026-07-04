import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchScanner } from "../utils/api";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Loader from "../components/ui/Loader";
import ErrorBox from "../components/ui/ErrorBox";
import { RefreshCw } from "lucide-react";

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
  const [symbol, setSymbol] = useState("NIFTY");

  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey      : ["scanner", symbol],
    queryFn       : () => fetchScanner(symbol),
    refetchInterval: 15000,
  });

  const results = data?.data ?? [];
  const ltp     = data?.ltp  ?? 0;
  const updated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("en-IN") : "";

  const signalColor = (s: string) =>
    s === "BUY" ? "#00d97e" : s === "SELL" ? "#f03060" : "#445566";

  const buys  = results.filter(r => r.signal === "BUY").length;
  const sells = results.filter(r => r.signal === "SELL").length;
  const neutral = results.filter(r => r.signal === "NEUTRAL").length;

  return (
    <div className="p-4 space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-lg overflow-hidden"
          style={{ border: "1px solid #0f1e36" }}>
          {SYMBOLS.map(s => (
            <button key={s} onClick={() => setSymbol(s)}
              className="px-3 py-1.5 text-xs font-bold transition-all"
              style={{
                background: symbol === s ? "#00c8f0" : "#090f1e",
                color     : symbol === s ? "#03050d" : "#445566",
              }}>
              {s}
            </button>
          ))}
        </div>

        <span className="text-xs" style={{ color: "#445566" }}>
          LTP: <span style={{ color: "#00c8f0", fontWeight: 700 }}>
            {ltp > 0 ? ltp.toLocaleString("en-IN") : "---"}
          </span>
        </span>

        <button onClick={() => refetch()}
          className="p-1.5 rounded-lg ml-auto"
          style={{ background: "#0f1e36", color: "#00c8f0" }}>
          <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Summary */}
      {results.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "BUY",     count: buys,    color: "#00d97e" },
            { label: "SELL",    count: sells,   color: "#f03060" },
            { label: "NEUTRAL", count: neutral, color: "#445566" },
          ].map(({ label, count, color }) => (
            <div key={label} className="rounded-xl p-3 text-center"
              style={{ background: "#090f1e", border: "1px solid #0f1e36" }}>
              <div className="text-xl font-black" style={{ color }}>{count}</div>
              <div className="text-xs mt-1" style={{ color: "#445566" }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Updated time */}
      {updated && (
        <div className="text-right text-xs" style={{ color: "#334455" }}>
          Updated: {updated} • auto 15s
        </div>
      )}

      {/* Results */}
      {isLoading && <Loader text="Running scanners..." />}
      {isError   && <ErrorBox message="Scanner failed" />}

      <div className="space-y-2">
        {results.map((r, i) => (
          <div key={i} className="rounded-xl p-3"
            style={{ background: "#090f1e", border: "1px solid #0f1e36" }}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span>{SCANNER_ICONS[r.scanner] ?? "📡"}</span>
                <span className="text-xs font-bold" style={{ color: "#c0d0e8" }}>
                  {r.scanner}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Badge
                  label={r.signal}
                  variant={r.signal.toLowerCase() as "buy" | "sell" | "neutral"}
                />
                <Badge
                  label={r.strength}
                  variant={r.strength.toLowerCase() as "strong" | "moderate" | "weak"}
                />
              </div>
            </div>
            <div className="text-xs mt-1" style={{ color: "#445566" }}>
              {r.condition}
            </div>
          </div>
        ))}
      </div>

      {!isLoading && results.length === 0 && (
        <div className="text-center py-16" style={{ color: "#445566" }}>
          <div className="text-3xl mb-2">📡</div>
          <div className="text-sm">No scanner results</div>
        </div>
      )}
    </div>
  );
}
