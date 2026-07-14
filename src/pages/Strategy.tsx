import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchStrategy } from "../utils/api";
import { useAppStore } from "../store";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Loader from "../components/ui/Loader";
import ErrorBox from "../components/ui/ErrorBox";
import { useTheme } from "../store/themeStore";
import type { Theme } from "../styles/theme";

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

function StrategyCard({ s, theme }: { s: any; theme: Theme }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}` }}>
      {/* Header */}
      <button className="w-full flex items-center justify-between p-3"
        onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: theme.text.secondary }}>
            {s.strategy}
          </span>
          <Badge
            label={s.signal}
            variant={s.signal.toLowerCase() as "buy" | "sell"}
          />
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span style={{ color: theme.accent.cyan }}>₹{s.entry?.toFixed(1)}</span>
          <span style={{ color: theme.text.muted }}>RR: {s.risk_reward}x</span>
          <span style={{ color: theme.text.muted }}>{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {/* Description */}
      <div className="px-3 pb-2 text-sm" style={{ color: theme.text.muted }}>
        {s.description}
      </div>

      {/* Expanded */}
      {open && (
        <div className="border-t px-3 py-3 space-y-3"
          style={{ borderColor: theme.border.subtle }}>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            {[
              { label: "Entry",      value: `₹${s.entry?.toFixed(1)}`,     color: theme.accent.cyan },
              { label: "SL",         value: `₹${s.sl?.toFixed(1)}`,         color: theme.accent.red },
              { label: "Target",     value: `₹${s.target?.toFixed(1)}`,     color: theme.accent.green },
              { label: "Max Profit", value: s.max_profit == null ? "∞" : `₹${s.max_profit?.toFixed(1)}`, color: theme.accent.green },
              { label: "Max Loss",   value: s.max_loss == null   ? "∞" : `₹${s.max_loss?.toFixed(1)}`,   color: theme.accent.red },
              { label: "RR Ratio",   value: `${s.risk_reward}x`,           color: theme.accent.purple },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-lg p-2"
                style={{ background: theme.bg.surface }}>
                <div style={{ color: theme.text.muted }}>{label}</div>
                <div className="font-bold mt-0.5" style={{ color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Breakeven */}
          {s.breakeven?.length > 0 && (
            <div className="text-sm" style={{ color: theme.text.muted }}>
              Breakeven: {s.breakeven.map((b: number) =>
                <span key={b} className="ml-1 px-1 rounded"
                  style={{ background: theme.border.subtle, color: theme.text.secondary }}>
                  {b.toLocaleString("en-IN")}
                </span>
              )}
            </div>
          )}

          {/* Legs */}
          {s.legs?.length > 0 && (
            <div className="space-y-1">
              <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Legs:</div>
              {s.legs.map((leg: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm rounded px-2 py-1"
                  style={{ background: theme.bg.surface }}>
                  <span style={{ color: leg.action === "BUY" ? theme.accent.green : theme.accent.red }}>
                    {leg.action}
                  </span>
                  <span style={{ color: theme.text.secondary }}>{leg.strike} {leg.type}</span>
                  <span style={{ color: theme.accent.cyan }}>₹{leg.premium?.toFixed(1)}</span>
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
  const theme = useTheme();
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
              <div className="text-sm mb-1" style={{ color: theme.text.muted }}>{label}</div>
              <input
                type="number"
                value={value}
                onChange={e => setter(e.target.value)}
                placeholder={placeholder}
                className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
                style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color: theme.text.secondary }}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Strategy selector */}
      <div className="flex gap-1 flex-wrap">
        {STRATEGIES.map(s => (
          <button key={s.key} onClick={() => setName(s.key)}
            className="px-2 py-1 rounded-lg text-sm font-bold transition-all"
            style={{
              background: name === s.key ? theme.accent.cyan : theme.bg.surfaceAlt,
              color     : name === s.key ? theme.bg.page : theme.text.muted,
              border    : `1px solid ${theme.border.subtle}`,
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
          <StrategyCard key={`${s.strategy}-${i}`} s={s} theme={theme} />
        ))}
      </div>
    </div>
  );
}
