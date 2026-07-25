/**
 * TradePro Simulator - Position Book (floating panel)
 * A dedicated, professional read-style view of open legs — separate from
 * the Strategy Builder's editable leg rows. Collapsible, resizable
 * (drag the top handle), sticky/floating in the bottom-right corner.
 *
 * LTP and Greeks are computed with the SAME bsGreeks formula already used
 * for portfolioGreeks in Simulator.tsx — just evaluated per leg instead of
 * aggregated. No calculation logic was added or changed.
 *
 * Notes on a few columns, since this app has no live execution/fills
 * engine behind it:
 *   - Realized PNL: always "—" — nothing is ever "closed" here, legs are
 *     just removed. Showing a fabricated number would be misleading.
 *   - SL / Target: session-only local inputs (not persisted, not wired to
 *     any backend) — purely for the trader's own reference while watching
 *     this panel.
 *   - Exit: removes the leg (same removeLeg the Strategy Builder already
 *     uses).
 *   - Status: always "OPEN" — there is no closed-position concept yet.
 */
import { useState, useRef, useCallback } from "react";
import { ChevronDown, ChevronUp, X, GripHorizontal, Briefcase } from "lucide-react";
import { useTheme } from "../../store/themeStore";
import { bsGreeks } from "../pricing/BlackScholes";
import type { OptionLeg } from "../models/Option";

interface Props {
  legs: OptionLeg[];
  spot: number;
  T: number;
  riskFreeRate: number;
  onExit: (id: string) => void;
}

const MIN_H = 160;
const MAX_H = 560;
const DEFAULT_H = 320;

export default function PositionBook({ legs, spot, T, riskFreeRate, onExit }: Props) {
  const theme = useTheme();
  const [collapsed, setCollapsed] = useState(true);
  const [height, setHeight] = useState(DEFAULT_H);
  const [slTgt, setSlTgt] = useState<Record<string, { sl: string; target: string }>>({});
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  const updateSlTgt = (id: string, patch: Partial<{ sl: string; target: string }>) => {
    setSlTgt(m => ({ ...m, [id]: { sl: m[id]?.sl ?? "", target: m[id]?.target ?? "", ...patch } }));
  };

  const onDragStart = useCallback((e: React.PointerEvent) => {
    dragRef.current = { startY: e.clientY, startH: height };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [height]);

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const delta = dragRef.current.startY - e.clientY; // dragging up increases height
    setHeight(Math.min(MAX_H, Math.max(MIN_H, dragRef.current.startH + delta)));
  }, []);

  const onDragEnd = useCallback(() => { dragRef.current = null; }, []);

  const rows = legs.map(leg => {
    const g = bsGreeks({
      spot, strike: leg.contract.strike, timeToExpiry: T,
      riskFreeRate, volatility: leg.iv / 100, optionType: leg.contract.optionType,
    });
    const qty = leg.lots * leg.contract.lotSize;
    const sign = leg.action === "BUY" ? 1 : -1;
    const mtm = (g.price - leg.entryPrice) * qty * sign;
    return { leg, ltp: g.price, delta: g.delta, theta: g.theta, mtm, qty };
  });

  const totalMtm = rows.reduce((s, r) => s + r.mtm, 0);
  const totalQty = rows.reduce((s, r) => s + r.qty, 0);

  // ── Collapsed pill ───────────────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed bottom-24 right-3 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg"
        style={{
          background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}`,
          backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <Briefcase size={15} color={theme.accent.cyan} />
        <span className="text-sm font-bold" style={{ color: theme.text.secondary }}>
          Position Book ({legs.length})
        </span>
        {legs.length > 0 && (
          <span className="text-sm font-black" style={{ color: totalMtm >= 0 ? theme.accent.green : theme.accent.red }}>
            {totalMtm >= 0 ? "+" : ""}₹{Math.round(totalMtm).toLocaleString("en-IN")}
          </span>
        )}
        <ChevronUp size={14} color={theme.text.muted} />
      </button>
    );
  }

  // ── Expanded floating panel ───────────────────────────────────────────────
  return (
    <div
      className="fixed bottom-3 right-3 left-3 sm:left-auto z-30 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
      style={{
        height, maxHeight: "80vh", width: undefined,
        background: theme.bg.surfaceAlt + "e6",
        border: `1px solid ${theme.border.subtle}`,
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        transition: "height 120ms ease-out",
      }}
    >
      {/* Drag handle */}
      <div
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        className="flex items-center justify-center py-1 cursor-ns-resize touch-none"
        style={{ borderBottom: `1px solid ${theme.border.subtle}` }}
      >
        <GripHorizontal size={16} color={theme.text.faint} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${theme.border.subtle}` }}>
        <div className="flex items-center gap-2">
          <Briefcase size={15} color={theme.accent.cyan} />
          <span className="text-sm font-bold" style={{ color: theme.text.secondary }}>Position Book</span>
        </div>
        <button onClick={() => setCollapsed(true)} className="p-1 rounded" style={{ color: theme.text.muted }}>
          <ChevronDown size={16} />
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="text-center py-10 text-sm" style={{ color: theme.text.muted }}>
            No open positions — add legs in Strategy Builder.
          </div>
        ) : (
          <table className="w-full" style={{ fontSize: 11, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ position: "sticky", top: 0, background: theme.bg.surfaceAlt, zIndex: 1 }}>
                {["Instrument", "Expiry", "Action", "Qty", "Avg", "LTP", "MTM", "Realized", "Unrealized", "Greeks (Δ/Θ)", "SL", "Target", "Status", ""].map(h => (
                  <th key={h} className="px-2 py-1.5 text-left whitespace-nowrap" style={{ color: theme.text.faint, fontWeight: 700, borderBottom: `1px solid ${theme.border.subtle}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ leg, ltp, delta, theta, mtm, qty }) => {
                const s = slTgt[leg.id] ?? { sl: "", target: "" };
                return (
                  <tr key={leg.id} style={{ borderBottom: `1px solid ${theme.border.subtle}` }}>
                    <td className="px-2 py-1.5 whitespace-nowrap font-bold" style={{ color: theme.text.primary }}>
                      {leg.contract.symbol} {leg.contract.strike} {leg.contract.optionType}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap" style={{ color: theme.text.faint }}>{leg.contract.expiryType}</td>
                    <td className="px-2 py-1.5">
                      <span className="px-1.5 py-0.5 rounded font-bold" style={{
                        color: leg.action === "BUY" ? theme.accent.green : theme.accent.red,
                        background: (leg.action === "BUY" ? theme.accent.green : theme.accent.red) + "18",
                      }}>{leg.action}</span>
                    </td>
                    <td className="px-2 py-1.5" style={{ color: theme.text.secondary }}>{qty}</td>
                    <td className="px-2 py-1.5" style={{ color: theme.text.secondary }}>₹{leg.entryPrice.toFixed(2)}</td>
                    <td className="px-2 py-1.5 font-bold" style={{ color: theme.accent.cyan }}>₹{ltp.toFixed(2)}</td>
                    <td className="px-2 py-1.5 font-bold" style={{ color: mtm >= 0 ? theme.accent.green : theme.accent.red }}>
                      {mtm >= 0 ? "+" : ""}₹{Math.round(mtm).toLocaleString("en-IN")}
                    </td>
                    <td className="px-2 py-1.5" style={{ color: theme.text.faint }}>—</td>
                    <td className="px-2 py-1.5 font-bold" style={{ color: mtm >= 0 ? theme.accent.green : theme.accent.red }}>
                      {mtm >= 0 ? "+" : ""}₹{Math.round(mtm).toLocaleString("en-IN")}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap" style={{ color: theme.text.faint }}>
                      {delta.toFixed(2)} / {theta.toFixed(1)}
                    </td>
                    <td className="px-1 py-1">
                      <input value={s.sl} onChange={e => updateSlTgt(leg.id, { sl: e.target.value })} placeholder="-"
                        className="w-14 px-1 py-0.5 rounded text-center outline-none"
                        style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color: theme.accent.red }} />
                    </td>
                    <td className="px-1 py-1">
                      <input value={s.target} onChange={e => updateSlTgt(leg.id, { target: e.target.value })} placeholder="-"
                        className="w-14 px-1 py-0.5 rounded text-center outline-none"
                        style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color: theme.accent.green }} />
                    </td>
                    <td className="px-2 py-1.5">
                      <span className="px-1.5 py-0.5 rounded font-bold" style={{ color: theme.accent.cyan, background: theme.accent.cyan + "18" }}>OPEN</span>
                    </td>
                    <td className="px-2 py-1.5">
                      <button onClick={() => onExit(leg.id)} className="p-1 rounded" style={{ color: theme.accent.red, background: theme.accent.red + "15" }}>
                        <X size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Portfolio summary */}
      {rows.length > 0 && (
        <div className="flex items-center justify-around gap-2 px-3 py-2 flex-wrap" style={{ borderTop: `1px solid ${theme.border.subtle}`, background: theme.bg.surface }}>
          <div className="text-center">
            <div style={{ fontSize: 9, color: theme.text.faint }}>Legs</div>
            <div className="font-bold" style={{ fontSize: 12, color: theme.text.secondary }}>{rows.length}</div>
          </div>
          <div className="text-center">
            <div style={{ fontSize: 9, color: theme.text.faint }}>Total Qty</div>
            <div className="font-bold" style={{ fontSize: 12, color: theme.text.secondary }}>{totalQty}</div>
          </div>
          <div className="text-center">
            <div style={{ fontSize: 9, color: theme.text.faint }}>Realized</div>
            <div className="font-bold" style={{ fontSize: 12, color: theme.text.faint }}>—</div>
          </div>
          <div className="text-center">
            <div style={{ fontSize: 9, color: theme.text.faint }}>Total MTM / Unrealized</div>
            <div className="font-black" style={{ fontSize: 14, color: totalMtm >= 0 ? theme.accent.green : theme.accent.red }}>
              {totalMtm >= 0 ? "+" : ""}₹{Math.round(totalMtm).toLocaleString("en-IN")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
