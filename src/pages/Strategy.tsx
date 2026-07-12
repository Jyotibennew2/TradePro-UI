import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchStrategy } from "../utils/api";
import { useAppStore } from "../store";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Loader from "../components/ui/Loader";
import ErrorBox from "../components/ui/ErrorBox";

const STRATEGIES = [
  { key: "all",        label: "All"          },
  { key: "longcall",   label: "Long Call"    },
  { key: "longput",    label: "Long Put"     },
  { key: "straddle",   label: "Straddle"     },
  { key: "strangle",   label: "Strangle"     },
  { key: "ironcondor", label: "Iron Condor"  },
  { key: "ironfly",    label: "Iron Fly"     },
  { key: "bullcall",   label: "Bull Call"    },
  { key: "bearput",    label: "Bear Put"     },
];

function StrategyCard({ s }: { s: any }) {
  const [open, setOpen] = useState(false);
  const isProfit = s.signal === "SELL";

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: "#090f1e", border: "1px solid #0f1e36" }}>
      {/* Header */}
      <button className="w-full flex items-center justify-between p-3"
        onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold" style={{ color: "#c0d0e8" }}>
            {s.strategy}
          </span>
          <Badge
            label={s.signal}
            variant={s.signal.toLowerCase() as "buy" | "sell"}
          />
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span style={{ color: "#00c8f0" }}>₹{s.entry?.toFixed(1)}</span>
          <span style={{ color: "#445566" }}>RR: {s.risk_reward}x</span>
          <span style={{ color: "#445566" }}>{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {/* Description */}
      <div className="px-3 pb-2 text-xs" style={{ color: "#445566" }}>
        {s.description}
      </div>

      {/* Expanded */}
      {open && (
        <div className="border-t px-3 py-3 space-y-3"
          style={{ borderColor: "#0f1e36" }}>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            {[
              { label: "Entry",      value: `₹${s.entry?.toFixed(1)}`,     color: "#00c8f0" },
              { label: "SL",         value: `₹${s.sl?.toFixed(1)}`,         color: "#f03060" },
              { label: "Target",     value: `₹${s.target?.toFixed(1)}`,     color: "#00d97e" },
              { label: "Max Profit", value: s.max_profit == null ? "∞" : `₹${s.max_profit?.toFixed(1)}`, color: "#00d97e" },
              { label: "Max Loss",   value: s.max_loss == null   ? "∞" : `₹${s.max_loss?.toFixed(1)}`,   color: "#f03060" },
              { label: "RR Ratio",   value: `${s.risk_reward}x`,           color: "#9b5cf6" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-lg p-2"
                style={{ background: "#060c1a" }}>
                <div style={{ color: "#445566" }}>{label}</div>
                <div className="font-bold mt-0.5" style={{ color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Breakeven */}
          {s.breakeven?.length > 0 && (
            <div className="text-xs" style={{ color: "#445566" }}>
              Breakeven: {s.breakeven.map((b: number) =>
                <span key={b} className="ml-1 px-1 rounded"
                  style={{ background: "#0f1e36", color: "#c0d0e8" }}>
                  {b.toLocaleString("en-IN")}
                </span>
              )}
            </div>
          )}

          {/* Legs */}
          {s.legs?.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs mb-1" style={{ color: "#445566" }}>Legs:</div>
              {s.legs.map((leg: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs rounded px-2 py-1"
                  style={{ background: "#060c1a" }}>
                  <span style={{ color: leg.action === "BUY" ? "#00d97e" : "#f03060" }}>
                    {leg.action}
                  </span>
                  <span style={{ color: "#c0d0e8" }}>{leg.strike} {leg.type}</span>
                  <span style={{ color: "#00c8f0" }}>₹{leg.premium?.toFixed(1)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Strategy() {
  const { nifty } = useAppStore();
  const [name, setName]     = useState("all");
  const [spot, setSpot]     = useState(0);
  const [expiry, setExpiry] = useState(7);
  const [iv, setIv]         = useState(15);

  const effectiveSpot = spot || nifty || 24300;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["strategy", name, effectiveSpot, expiry, iv],
    queryFn : () => fetchStrategy(effectiveSpot, expiry, iv, name),
    refetchInterval: 30000,
    placeholderData: (previousData) => previousData,
  });

  const strategies = Array.isArray(data?.data) ? data.data : data?.data ? [data.data] : [];

  return (
    <div className="p-4 space-y-4">
      {/* Controls */}
      <Card title="Parameters">
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Spot Price", value: spot || effectiveSpot, setter: (v: string) => setSpot(Number(v)), placeholder: `${effectiveSpot}` },
            { label: "Days to Expiry", value: expiry, setter: (v: string) => setExpiry(Number(v)), placeholder: "7" },
            { label: "IV %", value: iv, setter: (v: string) => setIv(Number(v)), placeholder: "15" },
          ].map(({ label, value, setter, placeholder }) => (
            <div key={label}>
              <div className="text-xs mb-1" style={{ color: "#445566" }}>{label}</div>
              <input
                type="number"
                value={value}
                onChange={e => setter(e.target.value)}
                placeholder={placeholder}
                className="w-full px-2 py-1.5 rounded-lg text-xs outline-none"
                style={{ background: "#060c1a", border: "1px solid #0f1e36", color: "#c0d0e8" }}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Strategy selector */}
      <div className="flex gap-1 flex-wrap">
        {STRATEGIES.map(s => (
          <button key={s.key} onClick={() => setName(s.key)}
            className="px-2 py-1 rounded-lg text-xs font-bold transition-all"
            style={{
              background: name === s.key ? "#00c8f0" : "#090f1e",
              color     : name === s.key ? "#03050d" : "#445566",
              border    : "1px solid #0f1e36",
            }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {isLoading && <Loader text="Building strategies..." />}
      {isError   && <ErrorBox message="Strategy engine failed" />}

      <div className="space-y-2">
        {strategies.map((s: any, i: number) => (
          <StrategyCard key={`${s.strategy}-${i}`} s={s} />
        ))}
      </div>
    </div>
  );
}
