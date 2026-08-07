import { useState } from "react";
import type { ChangeEvent } from "react";
import { strategyStorage } from "../services/strategyStorage";
import type { BuiltStrategy } from "../models/Strategy";
import type { OptionLeg } from "../models/Option";
import type { PortfolioGreeks } from "../models/Greeks";

/**
 * Save / Load / Export / Import for the Simulator, moved as-is from
 * Simulator.tsx. Same localStorage-backed strategyStorage service, same
 * BuiltStrategy shape built on save/export.
 */
export function useSimulatorPersistence(params: {
  template     : string;
  underlying   : "NIFTY" | "BANKNIFTY" | "MIDCPNIFTY";
  effectiveSpot: number;
  legs         : OptionLeg[];
  margin       : { netPremium: number } | null;
  payoff       : { combined: { maxProfit: number; maxLoss: number; breakevens: number[] } } | null;
  portfolioGreeks: PortfolioGreeks;
  clearLegs    : () => void;
  addLeg       : (leg: any) => void;
  stratName    : string;
  setStratName : (n: string) => void;
}) {
  const { template, underlying, effectiveSpot, legs, margin, payoff, portfolioGreeks, clearLegs, addLeg, stratName, setStratName } = params;

  const [savedList, setSavedList] = useState<BuiltStrategy[]>(() => strategyStorage.getAll());
  const [saveMsg, setSaveMsg] = useState("");
  const [loadOpen, setLoadOpen] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  // ─── Save ───────────────────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!legs.length) { setSaveMsg("Add legs first"); setTimeout(() => setSaveMsg(""), 2000); return; }
    const s: BuiltStrategy = {
      id: crypto.randomUUID(), type: template as any,
      name: stratName, underlying, spot: effectiveSpot,
      legs, netPremium: margin?.netPremium ?? 0,
      maxProfit: payoff?.combined.maxProfit ?? 0,
      maxLoss: payoff?.combined.maxLoss ?? 0,
      breakevens: payoff?.combined.breakevens ?? [],
      greeks: portfolioGreeks,
      status: "DRAFT",
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    strategyStorage.saveStrategy(s);
    setSavedList(strategyStorage.getAll());
    setLastSavedAt(Date.now());
    setSaveMsg("Saved!");
    setTimeout(() => setSaveMsg(""), 2000);
  };

  // ─── Export ──────────────────────────────────────────────────────────────────────────────
  const handleExport = () => {
    if (!legs.length) return;
    const s: BuiltStrategy = {
      id: crypto.randomUUID(), type: template as any,
      name: stratName, underlying, spot: effectiveSpot,
      legs, netPremium: margin?.netPremium ?? 0,
      maxProfit: 0, maxLoss: 0, breakevens: [],
      greeks: portfolioGreeks, status: "DRAFT",
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    strategyStorage.exportStrategy(s);
  };

  // ─── Import ──────────────────────────────────────────────────────────────────────────────
  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const s = await strategyStorage.importStrategy(file);
      clearLegs();
      s.legs.forEach(l => addLeg(l));
      setStratName(s.name);
      setSaveMsg("Imported!");
      setTimeout(() => setSaveMsg(""), 2000);
    } catch { setSaveMsg("Invalid file"); setTimeout(() => setSaveMsg(""), 2000); }
  };

  // ─── Load saved ─────────────────────────────────────────────────────────────────────────────
  const handleLoad = (s: BuiltStrategy) => {
    clearLegs();
    s.legs.forEach(l => addLeg(l));
    setStratName(s.name);
    setLoadOpen(false);
  };

  const deployLabel = lastSavedAt
    ? new Date(lastSavedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "Not Deployed";

  return {
    savedList, setSavedList, saveMsg,
    loadOpen, setLoadOpen, lastSavedAt, deployLabel,
    handleSave, handleExport, handleImport, handleLoad,
  };
}
