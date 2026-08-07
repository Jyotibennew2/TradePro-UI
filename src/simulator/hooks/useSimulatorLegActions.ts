import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSimulatorStore, makeOptionLeg } from "../state/simulatorStore";
import { StrategyBuilder } from "../services/strategyBuilder";
import { bsGreeks } from "../pricing/BlackScholes";
import { STRATEGY_CATALOG } from "../models/Strategy";
import type { OptionLeg } from "../models/Option";
import { fetchArchivedChain } from "../../utils/api";

/**
 * Leg add/template/drag-reorder/duplicate/expiry-change logic, moved as-is
 * from Simulator.tsx. Same StrategyBuilder call, same drag-reorder
 * mechanics, same archived-chain lookup on expiry change.
 */
export function useSimulatorLegActions(params: {
  underlying   : "NIFTY" | "BANKNIFTY" | "MIDCPNIFTY";
  effectiveSpot: number;
  daysToExpiry : number;
  iv           : number;
  riskFreeRate : number;
  T            : number;
  r            : number;
  sigmaBase    : number;
  legs         : OptionLeg[];
  addLeg       : (leg: any) => void;
  updateLeg    : (id: string, patch: Partial<OptionLeg>) => void;
  clearLegs    : () => void;
  chain        : any;
  setStratName : (n: string) => void;
}) {
  const {
    underlying, effectiveSpot, daysToExpiry, iv, riskFreeRate, T, r, sigmaBase,
    legs, addLeg, updateLeg, clearLegs, chain, setStratName,
  } = params;

  const [template, setTemplate] = useState("CUSTOM");

  const handleTemplate = (key: string) => {
    setTemplate(key);
    const st = useSimulatorStore.getState();
    if (key === "CUSTOM") { st.clearLegs(); return; }
    try {
      const s = effectiveSpot > 0 ? effectiveSpot : 24300;
      const built = StrategyBuilder.build(key as any, underlying, s, daysToExpiry, iv, riskFreeRate, 1);
      if (built.length > 0) {
        st.setLegs(built);
        const name = STRATEGY_CATALOG[key as keyof typeof STRATEGY_CATALOG]?.name ?? key;
        setStratName(name);
      }
    } catch (e) {
      console.error("Template error:", e);
    }
  };

  // ─── Apply template requested from Screener page ─────────────────
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const requested = (location.state as any)?.template;
    if (requested) {
      handleTemplate(requested);
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Add custom leg ──────────────────────────────────────────────────────────────────────
  const addCustomLeg = (optType: "CE" | "PE", action: "BUY" | "SELL") => {
    const strike = Math.round(effectiveSpot / 50) * 50;
    addLeg(makeOptionLeg(
      underlying, strike, optType, action, 1,
      Math.max(bsGreeks({ spot: effectiveSpot, strike, timeToExpiry: T, riskFreeRate: r, volatility: sigmaBase, optionType: optType }).price, 0.05),
      iv, ""
    ));
  };

  // ─── Drag reorder ──────────────────────────────────────────────────────────────────────────
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const handleDrop = () => {
    if (dragFrom === null || dragOver === null || dragFrom === dragOver) return;
    const reordered = [...legs];
    const [moved] = reordered.splice(dragFrom, 1);
    reordered.splice(dragOver, 0, moved);
    clearLegs();
    reordered.forEach(l => addLeg(l));
    setDragFrom(null); setDragOver(null);
  };

  // ─── Duplicate leg ─────────────────────────────────────────────────────────────────────────
  const handleDuplicate = (leg: OptionLeg) => { addLeg({ ...leg }); };

  // ─── Change a leg's expiry date + load its real historical entry price ───
  const handleChangeLegExpiry = async (leg: OptionLeg, newExpiry: string) => {
    updateLeg(leg.id, { contract: { ...leg.contract, expiry: newExpiry } });
    const epoch = chain.times[chain.timeIdx];
    if (!chain.selectedDate || epoch == null) return;
    try {
      const res = await fetchArchivedChain(chain.symbol, chain.selectedDate, newExpiry, epoch);
      const row = res.data.expiryData.find(r => r.strike === leg.contract.strike);
      if (row) {
        const ltp = leg.contract.optionType === "CE" ? row.ce_ltp : row.pe_ltp;
        const ivF = leg.contract.optionType === "CE" ? row.ce_iv : row.pe_iv;
        if (ltp != null) updateLeg(leg.id, { entryPrice: ltp, iv: ivF ?? leg.iv, currentPrice: ltp });
      }
    } catch {
      // No archived data for this strike/expiry/time combo — leg keeps its
      // previous entry price rather than being left in a broken state.
    }
  };

  return {
    template, setTemplate, handleTemplate,
    addCustomLeg,
    dragFrom, setDragFrom, dragOver, setDragOver, handleDrop,
    handleDuplicate, handleChangeLegExpiry,
  };
}
