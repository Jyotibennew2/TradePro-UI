/**
 * TradePro Simulator - Position Book (floating panel, fully editable)
 *
 * New in this pass:
 *   - A checkbox per leg (checked by default). Unticking a leg excludes it
 *     from Strategy/Payoff/Greeks calculations elsewhere on the page (via
 *     the excludedIds set lifted up to Simulator.tsx) WITHOUT removing it
 *     from this Position Book — it just stops counting. This only changes
 *     which legs get passed into the existing calculatePayoff /
 *     calculatePortfolioMargin / bsGreeks calls — those functions
 *     themselves are untouched.
 *   - Instrument, Lots, SL and Target are now searchable dropdowns
 *     (SearchableSelect) instead of plain inputs, per the new spec.
 *   - Bottom summary now also shows Total Delta, Total Theta, and
 *     Strategy P&L (same MTM sum as before, relabeled).
 *
 * Everything below still uses the exact same update path as before
 * (onUpdate → updateLeg, onExit → removeLeg, onAddLeg → addCustomLeg) —
 * no calculation logic was added or changed.
 */
import { useState, useRef, useCallback } from "react";
import { ChevronDown, ChevronUp, X, GripHorizontal, Briefcase, Plus, Minus } from "lucide-react";
import { useTheme } from "../../store/themeStore";
import { bsGreeks } from "../pricing/BlackScholes";
import type { OptionLeg } from "../models/Option";
import SearchableSelect from "./SearchableSelect";

interface Props {
  legs: OptionLeg[];
  spot: number;
  T: number;
  riskFreeRate: number;
  onExit: (id: string) => void;
  onUpdate: (id: string, patch: Partial<OptionLeg>) => void;
  onAddLeg: (optType: "CE" | "PE", action: "BUY" | "SELL") => void;
  excludedIds: Set<string>;
  onToggleActive: (id: string) => void;
  instrumentOptions: { strike: number }[];
}

const MIN_H = 220;
const MAX_H = 620;
const DEFAULT_H = 420;
const QUICK_LOTS = Array.from({ length: 20 }, (_, i) => i + 1); // 1..20
const SL_TGT_POINTS = Array.from({ length: 51 }, (_, i) => i);   // 0..50
const SL_TGT_PCT = Array.from({ length: 51 }, (_, i) => i);      // 0..50

export default function PositionBook({
  legs, spot, T, riskFreeRate, onExit, onUpdate, onAddLeg,
  excludedIds, onToggleActive, instrumentOptions,
}: Props) {
  const theme = useTheme();
  const [collapsed, setCollapsed] = useState(true);
  const [height, setHeight] = useState(DEFAULT_H);
  const [slTgt, setSlTgt] = useState<Record<string, { sl: string; target: string; mode: "pt" | "pct" }>>({});
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  const getSlTgt = (id: string) => slTgt[id] ?? { sl: "0", target: "0", mode: "pt" as const };
  const updateSlTgt = (id: string, patch: Partial<{ sl: string; target: string; mode: "pt" | "pct" }>) => {
    setSlTgt(m => ({ ...m, [id]: { ...getSlTgt(id), ...patch } }));
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
    return {
      leg, ltp: g.price, mtm, qty,
      deltaPos: sign * g.delta * qty,
      thetaPos: sign * g.theta * qty,
    };
  });

  const totalMtm = rows.reduce((s, r) => s + r.mtm, 0);
  const totalQty = rows.reduce((s, r) => s + r.qty, 0);
  const totalDelta = rows.reduce((s, r) => s + r.deltaPos, 0);
  const totalTheta = rows.reduce((s, r) => s + r.thetaPos, 0);

  const instrOptions = (optType: "CE" | "PE") =>
    instrumentOptions.map(o => ({ value: `${o.strike}|${optType}`, label: `${o.strike} ${optType}` }));

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
                {["", "Instrument", "Expiry", "Action", "Lots", "Avg Price", "LTP", "MTM", "Realized", "Unrealized", "Greeks (Δ/Θ)", "SL", "Target", "Status", ""].map(h => (
                  <th key={h} className="px-2 py-1.5 text-left whitespace-nowrap" style={{ color: theme.text.faint, fontWeight: 700, borderBottom: `1px solid ${theme.border.subtle}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ leg, ltp, mtm, deltaPos, thetaPos }) => {
                const st = getSlTgt(leg.id);
                const isBuy = leg.action === "BUY";
                const isCE = leg.contract.optionType === "CE";
                const active = !excludedIds.has(leg.id);
                const slOpts = (st.mode === "pt" ? SL_TGT_POINTS : SL_TGT_PCT).map(n => ({ value: String(n), label: st.mode === "pt" ? `${n} pt` : `${n}%` }));

                return (
                  <tr key={leg.id} style={{ borderBottom: `1px solid ${theme.border.subtle}`, opacity: active ? 1 : 0.45 }}>
                    {/* Include/exclude checkbox */}
                    <td className="px-1 py-1.5">
                      <button
                        onClick={() => onToggleActive(leg.id)}
                        title={active ? "Included in Strategy/Payoff — tap to exclude" : "Excluded from Strategy/Payoff — tap to include"}
                        className="w-5 h-5 rounded flex items-center justify-center font-black"
                        style={{
                          background: active ? theme.accent.green : theme.bg.surface,
                          border: `1px solid ${active ? theme.accent.green : theme.border.subtle}`,
                          color: active ? theme.bg.page : "transparent",
                        }}
                      >
                        ✓
                      </button>
                    </td>

                    {/* Instrument: searchable strike+type */}
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span className="font-bold" style={{ color: theme.text.faint, fontSize: 10 }}>{leg.contract.symbol}</span>
                        <SearchableSelect
                          widthClass="w-28"
                          value={`${leg.contract.strike}|${leg.contract.optionType}`}
                          onSelect={(v) => {
                            const [strikeStr, optType] = v.split("|");
                            onUpdate(leg.id, { contract: { ...leg.contract, strike: Number(strikeStr), optionType: optType as "CE" | "PE" } });
                          }}
                          options={[...instrOptions("CE"), ...instrOptions("PE")]}
                        />
                      </div>
                    </td>

                    <td className="px-2 py-1.5">
                      <button onClick={() => onUpdate(leg.id, { contract: { ...leg.contract, expiryType: leg.contract.expiryType === "WEEKLY" ? "MONTHLY" : "WEEKLY" } })}
                        className="px-2 py-0.5 rounded font-bold" style={{ background: theme.border.subtle, color: theme.text.secondary }}>
                        {leg.contract.expiryType === "WEEKLY" ? "Weekly" : "Monthly"}
                      </button>
                    </td>

                    <td className="px-2 py-1.5">
                      <button onClick={() => onUpdate(leg.id, { action: isBuy ? "SELL" : "BUY" })}
                        className="px-2 py-0.5 rounded font-black"
                        style={{ color: isBuy ? theme.accent.green : theme.accent.red, background: (isBuy ? theme.accent.green : theme.accent.red) + "18" }}>
                        {leg.action}
                      </button>
                    </td>

                    {/* Lots: stepper + searchable 1-20 */}
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => onUpdate(leg.id, { lots: Math.max(1, leg.lots - 1) })}
                          className="p-0.5 rounded" style={{ background: theme.border.subtle, color: theme.text.secondary }}>
                          <Minus size={11} />
                        </button>
                        <SearchableSelect
                          widthClass="w-14"
                          value={String(leg.lots)}
                          onSelect={(v) => onUpdate(leg.id, { lots: Number(v) })}
                          options={QUICK_LOTS.map(n => ({ value: String(n), label: String(n) }))}
                        />
                        <button onClick={() => onUpdate(leg.id, { lots: leg.lots + 1 })}
                          className="p-0.5 rounded" style={{ background: theme.border.subtle, color: theme.text.secondary }}>
                          <Plus size={11} />
                        </button>
                      </div>
                    </td>

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
                    <td className="px-2 py-1.5 whitespace-nowrap" style={{ color: theme.text.faint }}>
                      {deltaPos.toFixed(1)} / {thetaPos.toFixed(1)}
                    </td>

                    {/* SL: mode toggle + searchable value */}
                    <td className="px-1 py-1">
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateSlTgt(leg.id, { mode: st.mode === "pt" ? "pct" : "pt" })}
                          className="px-1 rounded font-bold" style={{ fontSize: 9, background: theme.border.subtle, color: theme.text.faint }}>
                          {st.mode === "pt" ? "pt" : "%"}
                        </button>
                        <SearchableSelect widthClass="w-16" value={st.sl} onSelect={(v) => updateSlTgt(leg.id, { sl: v })} options={slOpts} />
                      </div>
                    </td>
                    <td className="px-1 py-1">
                      <SearchableSelect widthClass="w-16" value={st.target} onSelect={(v) => updateSlTgt(leg.id, { target: v })} options={slOpts} />
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
            <div style={{ fontSize: 9, color: theme.text.faint }}>Total Delta</div>
            <div className="font-bold" style={{ fontSize: 12, color: theme.text.secondary }}>{totalDelta.toFixed(1)}</div>
          </div>
          <div className="text-center">
            <div style={{ fontSize: 9, color: theme.text.faint }}>Total Theta</div>
            <div className="font-bold" style={{ fontSize: 12, color: theme.text.secondary }}>{totalTheta.toFixed(1)}</div>
          </div>
          <div className="text-center">
            <div style={{ fontSize: 9, color: theme.text.faint }}>Strategy P&L</div>
            <div className="font-black" style={{ fontSize: 14, color: totalMtm >= 0 ? theme.accent.green : theme.accent.red }}>
              {totalMtm >= 0 ? "+" : ""}₹{Math.round(totalMtm).toLocaleString("en-IN")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
