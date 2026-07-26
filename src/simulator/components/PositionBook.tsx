/**
 * TradePro Simulator - Position Book (floating panel, fully editable)
 * Same floating/collapsible/resizable panel as before, but every field is
 * now directly adjustable — instrument (strike + CE/PE), expiry (W/M),
 * action (BUY/SELL), lots (stepper + quick +2/+5/+10), and price — all via
 * the SAME onUpdate/onExit/onAddLeg handlers Strategy Builder already
 * uses (updateLeg / removeLeg / addCustomLeg in Simulator.tsx). No new
 * calculation logic — this only wires more of the existing update path
 * into this panel's UI.
 *
 * Notes on read-only fields (unchanged from before):
 *   - LTP / Greeks: live theoretical values from bsGreeks (same formula
 *     used for portfolioGreeks), recomputed as spot/legs change.
 *   - Realized PNL: always "—" — this app has no fill/close-tracking
 *     engine, legs are just added/edited/removed.
 *   - SL / Target: session-only local inputs, not persisted or wired to
 *     any backend.
 *   - Status: always "OPEN".
 */
import { useState, useRef, useCallback } from "react";
import { ChevronDown, ChevronUp, X, GripHorizontal, Briefcase, Plus, Minus } from "lucide-react";
import { useTheme } from "../../store/themeStore";
import { bsGreeks } from "../pricing/BlackScholes";
import type { OptionLeg } from "../models/Option";

interface Props {
  legs: OptionLeg[];
  spot: number;
  T: number;
  riskFreeRate: number;
  onExit: (id: string) => void;
  onUpdate: (id: string, patch: Partial<OptionLeg>) => void;
  onAddLeg: (optType: "CE" | "PE", action: "BUY" | "SELL") => void;
}

const MIN_H = 200;
const MAX_H = 600;
const DEFAULT_H = 380;
const QUICK_LOTS = [1, 2, 5, 10];

export default function PositionBook({ legs, spot, T, riskFreeRate, onExit, onUpdate, onAddLeg }: Props) {
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
    const delta = dragRef.current.startY - e.clientY;
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

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed bottom-24 right-3 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg"
        style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}`, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
      >
        <Briefcase size={15} color={theme.accent.cyan} />
        <span className="text-sm font-bold" style={{ color: theme.text.secondary }}>Position Book ({legs.length})</span>
        {legs.length > 0 && (
          <span className="text-sm font-black" style={{ color: totalMtm >= 0 ? theme.accent.green : theme.accent.red }}>
            {totalMtm >= 0 ? "+" : ""}₹{Math.round(totalMtm).toLocaleString("en-IN")}
          </span>
        )}
        <ChevronUp size={14} color={theme.text.muted} />
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-3 right-3 left-3 sm:left-auto z-30 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
      style={{
        height, maxHeight: "85vh",
        background: theme.bg.surfaceAlt + "e6",
        border: `1px solid ${theme.border.subtle}`,
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        transition: "height 120ms ease-out",
      }}
    >
      <div onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd}
        className="flex items-center justify-center py-1 cursor-ns-resize touch-none"
        style={{ borderBottom: `1px solid ${theme.border.subtle}` }}>
        <GripHorizontal size={16} color={theme.text.faint} />
      </div>

      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${theme.border.subtle}` }}>
        <div className="flex items-center gap-2">
          <Briefcase size={15} color={theme.accent.cyan} />
          <span className="text-sm font-bold" style={{ color: theme.text.secondary }}>Position Book</span>
        </div>
        <button onClick={() => setCollapsed(true)} className="p-1 rounded" style={{ color: theme.text.muted }}>
          <ChevronDown size={16} />
        </button>
      </div>

      {/* Quick add-leg bar */}
      <div className="flex gap-1.5 px-3 py-2 overflow-x-auto" style={{ borderBottom: `1px solid ${theme.border.subtle}` }}>
        {([["CE", "BUY", theme.accent.green], ["CE", "SELL", theme.accent.red], ["PE", "BUY", theme.accent.cyan], ["PE", "SELL", theme.accent.purple]] as const).map(
          ([type, action, color]) => (
            <button key={`${action}-${type}`} onClick={() => onAddLeg(type, action)}
              className="shrink-0 px-2.5 py-1 rounded-lg text-sm font-bold flex items-center gap-1"
              style={{ background: color + "15", color, border: `1px solid ${color}30` }}>
              <Plus size={12} /> {action} {type}
            </button>
          )
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="text-center py-10 text-sm" style={{ color: theme.text.muted }}>
            No open positions — add a leg above.
          </div>
        ) : (
          <table className="w-full" style={{ fontSize: 11, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ position: "sticky", top: 0, background: theme.bg.surfaceAlt, zIndex: 1 }}>
                {["Instrument", "Expiry", "Action", "Lots", "Avg Price", "LTP", "MTM", "Realized", "Unrealized", "Greeks (Δ/Θ)", "SL", "Target", "Status", ""].map(h => (
                  <th key={h} className="px-2 py-1.5 text-left whitespace-nowrap" style={{ color: theme.text.faint, fontWeight: 700, borderBottom: `1px solid ${theme.border.subtle}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ leg, ltp, delta, theta, mtm }) => {
                const s = slTgt[leg.id] ?? { sl: "", target: "" };
                const isBuy = leg.action === "BUY";
                const isCE = leg.contract.optionType === "CE";
                return (
                  <tr key={leg.id} style={{ borderBottom: `1px solid ${theme.border.subtle}` }}>
                    {/* Instrument: strike input + CE/PE toggle */}
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span className="font-bold" style={{ color: theme.text.faint, fontSize: 10 }}>{leg.contract.symbol}</span>
                        <input type="number" value={leg.contract.strike}
                          onChange={e => onUpdate(leg.id, { contract: { ...leg.contract, strike: Number(e.target.value) } })}
                          className="w-16 px-1 py-0.5 rounded text-center outline-none font-bold"
                          style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color: theme.text.primary }} />
                        <button onClick={() => onUpdate(leg.id, { contract: { ...leg.contract, optionType: isCE ? "PE" : "CE" } })}
                          className="px-1.5 py-0.5 rounded font-black"
                          style={{ color: isCE ? theme.accent.cyan : theme.accent.purple, background: (isCE ? theme.accent.cyan : theme.accent.purple) + "18" }}>
                          {leg.contract.optionType}
                        </button>
                      </div>
                    </td>

                    {/* Expiry: W/M toggle */}
                    <td className="px-2 py-1.5">
                      <button onClick={() => onUpdate(leg.id, { contract: { ...leg.contract, expiryType: leg.contract.expiryType === "WEEKLY" ? "MONTHLY" : "WEEKLY" } })}
                        className="px-2 py-0.5 rounded font-bold" style={{ background: theme.border.subtle, color: theme.text.secondary }}>
                        {leg.contract.expiryType === "WEEKLY" ? "Weekly" : "Monthly"}
                      </button>
                    </td>

                    {/* Action: BUY/SELL toggle */}
                    <td className="px-2 py-1.5">
                      <button onClick={() => onUpdate(leg.id, { action: isBuy ? "SELL" : "BUY" })}
                        className="px-2 py-0.5 rounded font-black"
                        style={{ color: isBuy ? theme.accent.green : theme.accent.red, background: (isBuy ? theme.accent.green : theme.accent.red) + "18" }}>
                        {leg.action}
                      </button>
                    </td>

                    {/* Lots: stepper + quick buttons */}
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1 mb-1">
                        <button onClick={() => onUpdate(leg.id, { lots: Math.max(1, leg.lots - 1) })}
                          className="p-0.5 rounded" style={{ background: theme.border.subtle, color: theme.text.secondary }}>
                          <Minus size={11} />
                        </button>
                        <input type="number" min={1} value={leg.lots}
                          onChange={e => onUpdate(leg.id, { lots: Math.max(1, Number(e.target.value)) })}
                          className="w-10 px-1 py-0.5 rounded text-center outline-none font-bold"
                          style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color: theme.text.primary }} />
                        <button onClick={() => onUpdate(leg.id, { lots: leg.lots + 1 })}
                          className="p-0.5 rounded" style={{ background: theme.border.subtle, color: theme.text.secondary }}>
                          <Plus size={11} />
                        </button>
                      </div>
                      <div className="flex gap-0.5">
                        {QUICK_LOTS.map(n => (
                          <button key={n} onClick={() => onUpdate(leg.id, { lots: n })}
                            className="px-1 rounded"
                            style={{
                              fontSize: 9, color: leg.lots === n ? theme.bg.page : theme.text.faint,
                              background: leg.lots === n ? theme.accent.cyan : theme.border.subtle,
                            }}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </td>

                    {/* Avg Price: editable */}
                    <td className="px-2 py-1.5">
                      <input type="number" min={0.05} step={0.05} value={leg.entryPrice}
                        onChange={e => onUpdate(leg.id, { entryPrice: Number(e.target.value) })}
                        className="w-16 px-1 py-0.5 rounded text-center outline-none font-bold"
                        style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color: theme.accent.cyan }} />
                    </td>

                    <td className="px-2 py-1.5 font-bold" style={{ color: theme.accent.cyan }}>₹{ltp.toFixed(2)}</td>
                    <td className="px-2 py-1.5 font-bold" style={{ color: mtm >= 0 ? theme.accent.green : theme.accent.red }}>
                      {mtm >= 0 ? "+" : ""}₹{Math.round(mtm).toLocaleString("en-IN")}
                    </td>
                    <td className="px-2 py-1.5" style={{ color: theme.text.faint }}>—</td>
                    <td className="px-2 py-1.5 font-bold" style={{ color: mtm >= 0 ? theme.accent.green : theme.accent.red }}>
                      {mtm >= 0 ? "+" : ""}₹{Math.round(mtm).toLocaleString("en-IN")}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap" style={{ color: theme.text.faint }}>{delta.toFixed(2)} / {theta.toFixed(1)}</td>

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
