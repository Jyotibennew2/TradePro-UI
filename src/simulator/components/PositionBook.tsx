/**
 * TradePro Simulator - Position Book (floating panel, fully editable)
 *
 * ── Partial Exit pass ──────────────────────────────────────────────────
 * Each row now has a small "Exit Qty" lots input next to the existing full
 * Exit (✕) button. Entering a number and confirming exits only that many
 * lots at the leg's current LTP: entryPrice/avg price is untouched (exits
 * are FIFO-at-average, not a new cost basis), `lots` is reduced by the
 * exited amount, and the P&L from that slice is added to the leg's
 * cumulative `realizedPnl`. Exiting the full remaining quantity (or more)
 * behaves exactly like the pre-existing full Exit button — the leg is
 * removed. Nothing about Strike/Type/Action/Entry Price/Expiry editing,
 * live Greeks/MTM, or the Strategy/Payoff sync (Position Book checkbox)
 * changed — this is additive.
 *
 * ── Exit history pass ────────────────────────────────────────────────────
 * Manual exits (partial or full) now go through the store's `exitLeg`
 * action instead of directly removing the leg. Every exit action creates
 * an ExitRecord (persisted in exitHistoryStorage, keyed by legId) rendered
 * as a compact read-only EXIT row directly below its parent leg — showing
 * Entry, Exit timestamp, Exit Qty, Exit LTP, Exit reason, and that slice's
 * Realized P&L. A leg that's fully exited is never removed from the list;
 * it's marked CLOSED and stays visible with its full exit history. All
 * existing columns (Strike/Type/Action/Lots/Entry Price/Expiry/LTP/MTM/
 * Realized/Unrealized/Greeks/SL/Target) are unchanged — this only adds the
 * new Entry column, EXIT child rows, and the validation guards in
 * handlePartialExit/handleFullExit below. SL/Target values and Option
 * Chain LTP calculation are untouched, as scoped.
 */
import { useState, useRef, useCallback, useMemo } from "react";
import { ChevronDown, ChevronUp, X, GripHorizontal, Briefcase, Plus, Minus, LogOut, CornerDownRight } from "lucide-react";
import { useTheme } from "../../store/themeStore";
import { bsGreeks } from "../pricing/BlackScholes";
import { useSimulatorStore } from "../state/simulatorStore";
import { exitHistoryStorage } from "../services/exitHistoryStorage";
import type { OptionLeg } from "../models/Option";
import type { ExitRecord } from "../models/Exit";
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
  liveOverrides: Record<string, { ltp: number; iv: number }>;
  expiryOptions: string[];
  expiryLabel: (expiry: string) => string;
  onChangeLegExpiry: (leg: OptionLeg, newExpiry: string) => void;
}

const MIN_H = 220;
const MAX_H = 620;
const DEFAULT_H = 420;
const QUICK_LOTS    = Array.from({ length: 20 }, (_, i) => i + 1);
const SL_TGT_POINTS = Array.from({ length: 51 }, (_, i) => i);
const SL_TGT_PCT    = Array.from({ length: 51 }, (_, i) => i);

// DD-MMM-YY HH:mm, no seconds. Returns "-" for missing timestamps (legs
// created before entryTime existed, e.g. from an older saved/imported
// strategy) rather than throwing or showing "Invalid Date".
function fmtEntryTime(epochMs: number | undefined): string {
  if (!epochMs) return "-";
  const d = new Date(epochMs);
  const day = String(d.getDate()).padStart(2, "0");
  const mon = d.toLocaleString("en-IN", { month: "short" });
  const yr  = String(d.getFullYear()).slice(-2);
  const hh  = String(d.getHours()).padStart(2, "0");
  const mm  = String(d.getMinutes()).padStart(2, "0");
  return `${day}-${mon}-${yr} ${hh}:${mm}`;
}

export default function PositionBook({
  legs, spot, T, riskFreeRate, onExit, onUpdate, onAddLeg,
  excludedIds, onToggleActive, instrumentOptions,
  liveOverrides, expiryOptions, expiryLabel, onChangeLegExpiry,
}: Props) {
  const theme = useTheme();
  const exitLeg = useSimulatorStore(s => s.exitLeg);
  const [collapsed, setCollapsed] = useState(true);
  const [height, setHeight] = useState(DEFAULT_H);
  const [slTgt, setSlTgt] = useState<Record<string, { sl: string; target: string; mode: "pt" | "pct" }>>({});
  const [exitQty, setExitQty] = useState<Record<string, string>>({});
  const [exitErr, setExitErr] = useState<Record<string, string>>({});
  // exitHistoryStorage is a plain localStorage-backed module, not React
  // state — bumping this after every exitLeg() call forces a re-render so
  // the newly-added ExitRecord shows up immediately, without needing to
  // duplicate exit history inside component state.
  const [historyTick, setHistoryTick] = useState(0);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  const safeLiveOverrides    = liveOverrides    ?? {};
  const safeExpiryOptions    = expiryOptions    ?? [];
  const safeExcludedIds      = excludedIds      ?? new Set<string>();
  const safeInstrumentOptions = instrumentOptions ?? [];

  const validLegs = (legs ?? []).filter(
    (l): l is OptionLeg =>
      !!l && !!l.id && !!l.contract &&
      typeof l.contract.strike === "number" &&
      (l.contract.optionType === "CE" || l.contract.optionType === "PE") &&
      typeof l.entryPrice === "number" &&
      typeof l.lots === "number"
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const exitHistoryByLeg = useMemo(() => {
    const map: Record<string, ExitRecord[]> = {};
    for (const leg of validLegs) map[leg.id] = exitHistoryStorage.getForLeg(leg.id);
    return map;
  }, [validLegs, historyTick]);

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

  // A CLOSED leg has 0 remaining lots — its Greeks/MTM/LTP for the row
  // itself are zeroed out below (nothing left to mark-to-market), while
  // its Realized total and EXIT history rows remain fully visible.
  const rows = validLegs.map(leg => {
    const isClosed = leg.status === "CLOSED" || leg.lots <= 0;
    const ov   = safeLiveOverrides[leg.id];
    const g    = bsGreeks({
      spot, strike: leg.contract.strike, timeToExpiry: T,
      riskFreeRate, volatility: (ov?.iv ?? leg.iv ?? 15) / 100, optionType: leg.contract.optionType,
    });
    const ltp  = ov?.ltp ?? g.price;
    const qty  = leg.lots * (leg.contract.lotSize ?? 1);
    const sign = leg.action === "BUY" ? 1 : -1;
    const unrealizedMtm = isClosed ? 0 : (ltp - leg.entryPrice) * qty * sign;
    const realizedMtm   = leg.realizedPnl ?? 0;
    return {
      leg, ltp, unrealizedMtm, realizedMtm, mtm: unrealizedMtm + realizedMtm, qty, isLive: ov != null, isClosed,
      deltaPos: isClosed ? 0 : sign * g.delta * qty,
      thetaPos: isClosed ? 0 : sign * g.theta * qty,
    };
  });

  const totalMtm        = rows.reduce((s, r) => s + r.mtm,           0);
  const totalRealized   = rows.reduce((s, r) => s + r.realizedMtm,   0);
  const totalUnrealized = rows.reduce((s, r) => s + r.unrealizedMtm, 0);
  const totalQty   = rows.reduce((s, r) => s + r.qty,      0);
  const totalDelta = rows.reduce((s, r) => s + r.deltaPos, 0);
  const totalTheta = rows.reduce((s, r) => s + r.thetaPos, 0);

  const instrOptions = (optType: "CE" | "PE") =>
    safeInstrumentOptions.map(o => ({ value: `${o.strike}|${optType}`, label: `${o.strike} ${optType}` }));

  // Exit `qtyLots` lots from `leg` at its current live/estimated LTP via
  // the store's exitLeg action, which validates and records an ExitRecord.
  // Guards (duplicate/wrong-leg/negative/over-quantity/already-closed) are
  // enforced in exitLeg itself — this handler only surfaces the result.
  const runExit = (leg: OptionLeg, ltp: number, qtyLots: number) => {
    const err = exitLeg(leg.id, qtyLots, ltp);
    if (err) {
      setExitErr(m => ({ ...m, [leg.id]: err }));
      setTimeout(() => setExitErr(m => { const n = { ...m }; delete n[leg.id]; return n; }), 2500);
      return;
    }
    setExitQty(m => { const next = { ...m }; delete next[leg.id]; return next; });
    setHistoryTick(t => t + 1);
  };

  const handlePartialExit = (leg: OptionLeg, ltp: number) => {
    const raw = exitQty[leg.id];
    const qtyLots = Number(raw);
    if (!raw || !Number.isFinite(qtyLots) || qtyLots <= 0) {
      setExitErr(m => ({ ...m, [leg.id]: "INVALID_QTY" }));
      setTimeout(() => setExitErr(m => { const n = { ...m }; delete n[leg.id]; return n; }), 2500);
      return;
    }
    runExit(leg, ltp, qtyLots);
  };

  const handleFullExit = (leg: OptionLeg, ltp: number) => {
    runExit(leg, ltp, leg.lots);
  };

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed bottom-24 right-3 z-30 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg"
        style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}`, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
      >
        <Briefcase size={15} color={theme.accent.cyan} />
        <span className="text-sm font-bold" style={{ color: theme.text.secondary }}>Position Book ({validLegs.length})</span>
        {validLegs.length > 0 && (
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
        {([[ "CE", "BUY", theme.accent.green], ["CE", "SELL", theme.accent.red], ["PE", "BUY", theme.accent.cyan], ["PE", "SELL", theme.accent.purple]] as const).map(
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
          <div className="text-center py-10 text-sm" style={{ color: theme.text.muted }}>No open positions — add a leg above.</div>
        ) : (
          <table className="w-full" style={{ fontSize: 11, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ position: "sticky", top: 0, background: theme.bg.surfaceAlt, zIndex: 1 }}>
                {["", "Instrument", "Entry", "Expiry", "Action", "Lots", "Avg Price", "LTP", "MTM", "Realized", "Unrealized", "Greeks (Δ/Θ)", "SL", "Target", "Status", "Exit Qty", ""].map(h => (
                  <th key={h} className="px-2 py-1.5 text-left whitespace-nowrap"
                    style={{ color: theme.text.faint, fontWeight: 700, borderBottom: `1px solid ${theme.border.subtle}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ leg, ltp, mtm, unrealizedMtm, realizedMtm, deltaPos, thetaPos, isLive, isClosed }) => {
                const st    = getSlTgt(leg.id);
                const isBuy = leg.action === "BUY";
                const active = !safeExcludedIds.has(leg.id);
                const slOpts = (st.mode === "pt" ? SL_TGT_POINTS : SL_TGT_PCT).map(n => ({ value: String(n), label: st.mode === "pt" ? `${n} pt` : `${n}%` }));
                const exitVal = exitQty[leg.id] ?? "";
                const err = exitErr[leg.id];
                const legExits = exitHistoryByLeg[leg.id] ?? [];

                return (
                  <>
                    <tr key={leg.id} style={{ borderBottom: legExits.length ? "none" : `1px solid ${theme.border.subtle}`, opacity: active ? 1 : 0.45 }}>
                      <td className="px-1 py-1.5">
                        <button onClick={() => onToggleActive(leg.id)}
                          title={active ? "Included in Strategy/Payoff" : "Excluded from Strategy/Payoff"}
                          disabled={isClosed}
                          className="w-5 h-5 rounded flex items-center justify-center font-black"
                          style={{ background: active ? theme.accent.green : theme.bg.surface, border: `1px solid ${active ? theme.accent.green : theme.border.subtle}`, color: active ? theme.bg.page : "transparent", opacity: isClosed ? 0.5 : 1 }}>
                          ✓
                        </button>
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <span className="font-bold" style={{ color: theme.text.faint, fontSize: 10 }}>{leg.contract.symbol}</span>
                          <SearchableSelect
                            widthClass="w-28"
                            value={`${leg.contract.strike}|${leg.contract.optionType}`}
                            onSelect={(v) => {
                              if (isClosed) return;
                              const [strikeStr, optType] = v.split("|");
                              onUpdate(leg.id, { contract: { ...leg.contract, strike: Number(strikeStr), optionType: optType as "CE" | "PE" } });
                            }}
                            options={[...instrOptions("CE"), ...instrOptions("PE")]}
                          />
                        </div>
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap" style={{ color: theme.text.faint, fontSize: 10 }}>
                        {fmtEntryTime(leg.entryTime)}
                      </td>
                      <td className="px-2 py-1.5">
                        <SearchableSelect widthClass="w-24" value={leg.contract.expiry || ""} onSelect={(v) => { if (!isClosed) onChangeLegExpiry(leg, v); }} placeholder="Expiry"
                          options={safeExpiryOptions.map(e => ({ value: e, label: expiryLabel ? expiryLabel(e) : e }))} />
                      </td>
                      <td className="px-2 py-1.5">
                        <button onClick={() => onUpdate(leg.id, { action: isBuy ? "SELL" : "BUY" })} disabled={isClosed}
                          className="px-2 py-0.5 rounded font-black"
                          style={{ color: isBuy ? theme.accent.green : theme.accent.red, background: (isBuy ? theme.accent.green : theme.accent.red) + "18", opacity: isClosed ? 0.5 : 1 }}>
                          {leg.action}
                        </button>
                      </td>
                      <td className="px-2 py-1.5">
                        {isClosed ? (
                          <span style={{ color: theme.text.faint }}>0</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button onClick={() => onUpdate(leg.id, { lots: Math.max(1, leg.lots - 1) })} className="p-0.5 rounded" style={{ background: theme.border.subtle, color: theme.text.secondary }}><Minus size={11} /></button>
                            <SearchableSelect widthClass="w-14" value={String(leg.lots)} onSelect={(v) => onUpdate(leg.id, { lots: Number(v) })} options={QUICK_LOTS.map(n => ({ value: String(n), label: String(n) }))} />
                            <button onClick={() => onUpdate(leg.id, { lots: leg.lots + 1 })} className="p-0.5 rounded" style={{ background: theme.border.subtle, color: theme.text.secondary }}><Plus size={11} /></button>
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min={0.05} step={0.05} value={leg.entryPrice} disabled={isClosed}
                          onChange={e => onUpdate(leg.id, { entryPrice: Number(e.target.value) })}
                          className="w-16 px-1 py-0.5 rounded text-center outline-none font-bold"
                          style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color: theme.accent.cyan, opacity: isClosed ? 0.5 : 1 }} />
                      </td>
                      <td className="px-2 py-1.5 font-bold whitespace-nowrap" style={{ color: theme.accent.cyan }}>
                        {isClosed ? "-" : (
                          <>
                            ₹{ltp.toFixed(2)}
                            {isLive && <span className="ml-1 px-1 rounded" style={{ fontSize: 7, color: theme.accent.green, background: theme.accent.green + "18" }}>LIVE</span>}
                          </>
                        )}
                      </td>
                      <td className="px-2 py-1.5 font-bold" style={{ color: mtm >= 0 ? theme.accent.green : theme.accent.red }}>
                        {mtm >= 0 ? "+" : ""}₹{Math.round(mtm).toLocaleString("en-IN")}
                      </td>
                      <td className="px-2 py-1.5 font-bold" style={{ color: realizedMtm === 0 ? theme.text.faint : realizedMtm > 0 ? theme.accent.green : theme.accent.red }}>
                        {realizedMtm === 0 ? "—" : `${realizedMtm >= 0 ? "+" : ""}₹${Math.round(realizedMtm).toLocaleString("en-IN")}`}
                      </td>
                      <td className="px-2 py-1.5 font-bold" style={{ color: isClosed ? theme.text.faint : unrealizedMtm >= 0 ? theme.accent.green : theme.accent.red }}>
                        {isClosed ? "—" : `${unrealizedMtm >= 0 ? "+" : ""}₹${Math.round(unrealizedMtm).toLocaleString("en-IN")}`}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap" style={{ color: theme.text.faint }}>
                        {isClosed ? "— / —" : `${deltaPos.toFixed(1)} / ${thetaPos.toFixed(1)}`}
                      </td>
                      <td className="px-1 py-1">
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateSlTgt(leg.id, { mode: st.mode === "pt" ? "pct" : "pt" })} disabled={isClosed} className="px-1 rounded font-bold" style={{ fontSize: 9, background: theme.border.subtle, color: theme.text.faint }}>{st.mode === "pt" ? "pt" : "%"}</button>
                          <SearchableSelect widthClass="w-16" value={st.sl} onSelect={(v) => { if (!isClosed) updateSlTgt(leg.id, { sl: v }); }} options={slOpts} />
                        </div>
                      </td>
                      <td className="px-1 py-1">
                        <SearchableSelect widthClass="w-16" value={st.target} onSelect={(v) => { if (!isClosed) updateSlTgt(leg.id, { target: v }); }} options={slOpts} />
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="px-1.5 py-0.5 rounded font-bold"
                          style={{ color: isClosed ? theme.text.faint : theme.accent.cyan, background: (isClosed ? theme.text.faint : theme.accent.cyan) + "18" }}>
                          {isClosed ? "CLOSED" : "OPEN"}
                        </span>
                      </td>
                      <td className="px-1 py-1.5">
                        {isClosed ? (
                          <span style={{ color: theme.text.faint, fontSize: 9 }}>-</span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1">
                              <input
                                type="number" min={1} max={leg.lots} step={1}
                                value={exitVal}
                                placeholder={`/${leg.lots}`}
                                onChange={e => setExitQty(m => ({ ...m, [leg.id]: e.target.value }))}
                                title={`Lots to exit (out of ${leg.lots} open)`}
                                className="w-12 px-1 py-0.5 rounded text-center outline-none font-bold"
                                style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color: theme.text.secondary }}
                              />
                              <button
                                onClick={() => handlePartialExit(leg, ltp)}
                                disabled={!exitVal}
                                title="Exit these lots at current LTP"
                                className="p-1 rounded"
                                style={{ color: theme.accent.orange, background: theme.accent.orange + "15", opacity: exitVal ? 1 : 0.4 }}>
                                <LogOut size={12} />
                              </button>
                            </div>
                            {err && (
                              <span style={{ fontSize: 8, color: theme.accent.red }}>
                                {err === "INVALID_QTY" ? "Invalid qty" : err === "ALREADY_CLOSED" ? "Already closed" : "Not found"}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <button onClick={() => isClosed ? onExit(leg.id) : handleFullExit(leg, ltp)}
                          title={isClosed ? "Remove closed position from list" : "Exit full position"}
                          className="p-1 rounded" style={{ color: theme.accent.red, background: theme.accent.red + "15" }}>
                          <X size={13} />
                        </button>
                      </td>
                    </tr>
                    {legExits.map((ex, i) => (
                      <tr key={ex.id} style={{ borderBottom: i === legExits.length - 1 ? `1px solid ${theme.border.subtle}` : "none", background: theme.bg.surface + "80" }}>
                        <td className="px-1 py-1"></td>
                        <td className="px-2 py-1 whitespace-nowrap" colSpan={2}>
                          <div className="flex items-center gap-1" style={{ color: theme.text.faint, fontSize: 10 }}>
                            <CornerDownRight size={11} />
                            <span className="font-bold" style={{ color: theme.accent.orange }}>EXIT</span>
                            <span>{fmtEntryTime(ex.exitTime)}</span>
                          </div>
                        </td>
                        <td className="px-2 py-1" style={{ color: theme.text.faint, fontSize: 10 }} colSpan={2}>Qty {ex.exitQty}</td>
                        <td className="px-2 py-1" style={{ color: theme.text.faint, fontSize: 10 }}>—</td>
                        <td className="px-2 py-1 font-bold" style={{ color: theme.accent.cyan, fontSize: 10 }}>₹{ex.exitLtp.toFixed(2)}</td>
                        <td className="px-2 py-1" style={{ fontSize: 10 }}>—</td>
                        <td className="px-2 py-1 font-bold" style={{ color: ex.realizedPnl >= 0 ? theme.accent.green : theme.accent.red, fontSize: 10 }}>
                          {ex.realizedPnl >= 0 ? "+" : ""}₹{Math.round(ex.realizedPnl).toLocaleString("en-IN")}
                        </td>
                        <td className="px-2 py-1" colSpan={2} style={{ color: theme.text.faint, fontSize: 10 }}>{ex.exitReason}</td>
                        <td className="px-2 py-1" colSpan={4}></td>
                      </tr>
                    ))}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {rows.length > 0 && (
        <div className="flex items-center justify-around gap-2 px-3 py-2 flex-wrap" style={{ borderTop: `1px solid ${theme.border.subtle}`, background: theme.bg.surface }}>
          {[
            { label: "Legs",        value: String(rows.length),          color: theme.text.secondary },
            { label: "Total Qty",   value: String(totalQty),            color: theme.text.secondary },
            { label: "Total Delta", value: totalDelta.toFixed(1),        color: theme.text.secondary },
            { label: "Total Theta", value: totalTheta.toFixed(1),        color: theme.text.secondary },
            { label: "Realized",    value: `${totalRealized >= 0 ? "+" : ""}₹${Math.round(totalRealized).toLocaleString("en-IN")}`, color: totalRealized === 0 ? theme.text.secondary : totalRealized > 0 ? theme.accent.green : theme.accent.red },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <div style={{ fontSize: 9, color: theme.text.faint }}>{label}</div>
              <div className="font-bold" style={{ fontSize: 12, color }}>{value}</div>
            </div>
          ))}
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
