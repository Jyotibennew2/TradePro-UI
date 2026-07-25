/**
 * TradePro - Options Simulator Page (Bloomberg/TradingView-style redesign)
 *
 * LAYOUT ONLY changed from the previous collapsible-sections version:
 *   Fixed header -> Replay Control Bar -> Walk-Forward Bar ->
 *   [ Left 35%: Option Chain + Strategy Builder | Right 65%: Payoff +
 *   Analytics + Tabbed panel ] -> Fixed bottom action bar -> floating
 *   Position Book.
 *
 * All calculation/business logic below (calculate, portfolioGreeks, margin,
 * scenarioMatrix, adjustments, worstLevel, handleRollStrike, handleTemplate,
 * addCustomLeg, drag-reorder, handleSave/Export/Import/Load/Duplicate) is
 * the exact same logic that was already here — none of it was changed.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppStore } from "../store";
import { useTheme } from "../store/themeStore";
import { useSimulatorStore, makeOptionLeg } from "../simulator/state/simulatorStore";
import { StrategyBuilder } from "../simulator/services/strategyBuilder";
import { strategyStorage } from "../simulator/services/strategyStorage";
import { calculatePayoff } from "../simulator/pricing/PayoffEngine";
import { calculatePortfolioMargin } from "../simulator/pricing/MarginEngine";
import { buildScenarioMatrix } from "../simulator/pricing/PayoffEngine";
import { bsGreeks } from "../simulator/pricing/BlackScholes";
import { spotRange, daysToYears } from "../simulator/pricing/BlackScholes";
import { STRATEGY_CATALOG } from "../simulator/models/Strategy";
import type { PortfolioGreeks } from "../simulator/models/Greeks";
import type { BuiltStrategy } from "../simulator/models/Strategy";
import type { OptionLeg } from "../simulator/models/Option";
import { STRIKE_STEPS } from "../simulator/models/Option";
import { placePaperOrder } from "../utils/api";
import { probabilityOfProfit } from "../simulator/pricing/ProbabilityEngine";

import StrategyTemplates from "../simulator/components/StrategyTemplates";
import LegRow from "../simulator/components/LegRow";
import PayoffChart from "../simulator/components/PayoffChart";
import Card from "../components/ui/Card";

import { useHistoricalChain } from "../simulator/hooks/useHistoricalChain";
import ReplayControlBar from "../simulator/components/ReplayControlBar";
import WalkForwardBar from "../simulator/components/WalkForwardBar";
import OptionChainPanel from "../simulator/components/OptionChainPanel";
import AnalyticsCards from "../simulator/components/AnalyticsCards";
import TabbedBottomPanel from "../simulator/components/TabbedBottomPanel";
import PositionBook from "../simulator/components/PositionBook";

import {
  Plus, Save, Download, Upload, RefreshCw, FolderOpen,
  Sparkles, Settings, Zap, LineChart as LineChartIcon,
} from "lucide-react";

export default function Simulator() {
  const theme = useTheme();
  const { nifty, bankNifty } = useAppStore();
  const store = useSimulatorStore();
  const {
    underlying, spot, iv, daysToExpiry, riskFreeRate,
    legs, setUnderlying, setSpot, setIV, setDaysToExpiry,
    addLeg, removeLeg, updateLeg, clearLegs,
    payoff, setPayoff, setIsCalculating,
  } = store;

  const [template, setTemplate] = useState("CUSTOM");
  const [showPerLeg, setShowPerLeg] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [savedList, setSavedList] = useState<BuiltStrategy[]>(() => strategyStorage.getAll());
  const [saveMsg, setSaveMsg] = useState("");
  const [stratName, setStratName] = useState("My Strategy");
  const [loadOpen, setLoadOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const bornAt = useRef(new Date()).current;

  const effectiveSpot = spot || (underlying === "NIFTY" ? nifty : bankNifty) || 24300;
  const T = daysToYears(daysToExpiry);
  const r = riskFreeRate / 100;
  const sigmaBase = iv / 100;

  const flashToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  // ─── Calculate ────────────────────────────────────────────────────────────────────────────────
  const calculate = useCallback(() => {
    if (!legs.length) return;
    setIsCalculating(true);
    try {
      const spots = spotRange(effectiveSpot, 0.10, 80);
      const result = calculatePayoff({
        legs,
        spotRange: { min: spots[0], max: spots[spots.length - 1], steps: 80 },
        daysToExpiry: 0,
        riskFreeRate: r,
        useBS: true,
      });
      setPayoff(result);
    } finally {
      setIsCalculating(false);
    }
  }, [legs, effectiveSpot, daysToExpiry, r]);

  // Auto-calculate payoff when legs change — user never has to press Calculate
  useEffect(() => {
    if (legs.length > 0) calculate();
  }, [legs, calculate]);

  // ─── Portfolio Greeks ──────────────────────────────────────────────────────────────
  const portfolioGreeks: PortfolioGreeks = legs.reduce(
    (acc, leg) => {
      const g = bsGreeks({
        spot: effectiveSpot,
        strike: leg.contract.strike,
        timeToExpiry: T,
        riskFreeRate: r,
        volatility: leg.iv / 100,
        optionType: leg.contract.optionType,
      });
      const m = leg.action === "BUY" ? 1 : -1;
      const qty = leg.lots * leg.contract.lotSize;
      return {
        netDelta: acc.netDelta + m * g.delta * qty,
        netGamma: acc.netGamma + m * g.gamma * qty,
        netTheta: acc.netTheta + m * g.theta * qty,
        netVega: acc.netVega + m * g.vega * qty,
        netRho: acc.netRho + m * g.rho * qty,
        totalValue: acc.totalValue + m * g.price * qty,
      };
    },
    { netDelta: 0, netGamma: 0, netTheta: 0, netVega: 0, netRho: 0, totalValue: 0 }
  );

  // ─── Margin ─────────────────────────────────────────────────────────────────────────────
  const margin = legs.length ? calculatePortfolioMargin(legs, effectiveSpot) : null;

  // ─── Scenario matrix ────────────────────────────────────────────────────────────────
  const scenarioMatrix = legs.length ? buildScenarioMatrix(legs, effectiveSpot, iv, daysToExpiry, r) : null;

  // ─── Probability of Profit ──────────────────────────────────────────────────────────
  const pop = legs.length ? probabilityOfProfit(legs, effectiveSpot, iv, daysToExpiry, r) : null;

  // ─── Adjustments ─────────────────────────────────────────────────────────────────────────────
  type ThreatLevel = "safe" | "watch" | "danger";
  const BUFFER_WATCH = 0.03;
  const BUFFER_DANGER = 0.01;

  const adjustments = legs
    .filter(l => l.action === "SELL")
    .map(l => {
      const dist = l.contract.optionType === "CE"
        ? (l.contract.strike - effectiveSpot) / effectiveSpot
        : (effectiveSpot - l.contract.strike) / effectiveSpot;
      let level: ThreatLevel = "safe";
      if (dist <= BUFFER_DANGER) level = "danger";
      else if (dist <= BUFFER_WATCH) level = "watch";
      return { leg: l, distPct: dist * 100, level };
    })
    .sort((a, b) => a.distPct - b.distPct);

  const worstLevel: ThreatLevel =
    adjustments.some(a => a.level === "danger") ? "danger" :
    adjustments.some(a => a.level === "watch") ? "watch" : "safe";

  const handleRollStrike = (leg: OptionLeg) => {
    const step = STRIKE_STEPS[underlying];
    const direction = leg.contract.optionType === "CE" ? 1 : -1;
    const newStrike = leg.contract.strike + direction * step * 2;
    const newPremium = Math.max(
      bsGreeks({
        spot: effectiveSpot, strike: newStrike, timeToExpiry: T,
        riskFreeRate: r, volatility: leg.iv / 100, optionType: leg.contract.optionType,
      }).price,
      0.05
    );
    updateLeg(leg.id, {
      contract: { ...leg.contract, strike: newStrike },
      entryPrice: newPremium,
      currentPrice: newPremium,
    });
  };

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
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

  // ─── Duplicate leg ─────────────────────────────────────────────────────────────────────────
  const handleDuplicate = (leg: OptionLeg) => { addLeg({ ...leg }); };

  // ─── Trade Log (session-only activity feed, not persisted) ───────────
  const [tradeLog, setTradeLog] = useState<{ t: number; text: string }[]>([]);
  const prevLegsRef = useRef<OptionLeg[]>([]);
  useEffect(() => {
    const prev = prevLegsRef.current;
    const prevIds = new Set(prev.map(l => l.id));
    const currIds = new Set(legs.map(l => l.id));
    const added = legs.filter(l => !prevIds.has(l.id));
    const removedLegs = prev.filter(l => !currIds.has(l.id));
    const entries: { t: number; text: string }[] = [];
    added.forEach(l => entries.push({ t: Date.now(), text: `Added ${l.action} ${l.contract.strike} ${l.contract.optionType}` }));
    removedLegs.forEach(l => entries.push({ t: Date.now(), text: `Removed ${l.action} ${l.contract.strike} ${l.contract.optionType}` }));
    if (entries.length) setTradeLog(log => [...log, ...entries]);
    prevLegsRef.current = legs;
  }, [legs]);

  // ─── Paper Trade (places each leg via the existing paper-trade API) ─────
  const handlePaperTrade = async () => {
    if (!legs.length) { flashToast("Add legs first"); return; }
    flashToast("Placing paper orders…");
    let ok = 0, fail = 0;
    for (const leg of legs) {
      try {
        await placePaperOrder({
          symbol: leg.contract.symbol,
          option_type: leg.contract.optionType,
          strike: leg.contract.strike,
          expiry: leg.contract.expiry || "",
          action: leg.action,
          qty: leg.lots * leg.contract.lotSize,
          entry_price: leg.entryPrice,
          sl: 0,
          target: 0,
        });
        ok++;
      } catch { fail++; }
    }
    flashToast(`Paper trade: ${ok} placed${fail ? `, ${fail} failed` : ""}`);
  };

  // ─── Historical chain + walk-forward (shared across replay/WF bars + panel) ─
  const chain = useHistoricalChain();

  const deployLabel = lastSavedAt
    ? new Date(lastSavedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "Not Deployed";

  return (
    <div className="flex flex-col h-full" style={{ background: theme.bg.page }}>
      {/* ══════════ FIXED HEADER ══════════ */}
      <div className="flex items-center justify-between gap-3 px-3 py-2 flex-wrap"
        style={{ background: theme.bg.surface, borderBottom: `1px solid ${theme.border.subtle}` }}>
        <div className="flex items-center gap-2 shrink-0">
          <Zap size={18} color={theme.accent.cyan} />
          <span className="font-black text-sm" style={{ color: theme.accent.cyan }}>TradePro</span>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <input
            value={stratName}
            onChange={e => setStratName(e.target.value)}
            className="px-2 py-1 rounded-lg text-sm font-bold text-center outline-none"
            style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}`, color: theme.text.primary, width: 160 }}
          />
          <div className="text-sm" style={{ color: theme.text.muted }}>
            <div>Strategy: {bornAt.toLocaleDateString("en-IN")} {bornAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
          </div>
          <div className="text-sm" style={{ color: theme.text.muted }}>
            <div>Deploy: {deployLabel}</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 relative">
          <button onClick={handleSave} title="Save"
            className="p-1.5 rounded-lg" style={{ background: theme.accent.green + "20", color: theme.accent.green }}>
            <Save size={15} />
          </button>
          <button onClick={() => setLoadOpen(v => !v)} title="Load"
            className="p-1.5 rounded-lg" style={{ background: theme.accent.cyan + "20", color: theme.accent.cyan }}>
            <FolderOpen size={15} />
          </button>
          <button onClick={handleExport} title="Export"
            className="p-1.5 rounded-lg" style={{ background: theme.accent.purple + "20", color: theme.accent.purple }}>
            <Download size={15} />
          </button>
          <button onClick={() => flashToast("AI Suggest — coming soon")} title="AI"
            className="p-1.5 rounded-lg" style={{ background: theme.accent.orange + "20", color: theme.accent.orange }}>
            <Sparkles size={15} />
          </button>
          <button onClick={() => flashToast("Settings — coming soon")} title="Settings"
            className="p-1.5 rounded-lg" style={{ background: theme.border.subtle, color: theme.text.muted }}>
            <Settings size={15} />
          </button>

          {loadOpen && (
            <div className="absolute top-full mt-1 right-0 z-30 rounded-xl overflow-hidden w-72"
              style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}` }}>
              <div className="px-3 py-2 text-sm font-bold" style={{ color: theme.text.muted, borderBottom: `1px solid ${theme.border.subtle}` }}>
                Saved Strategies
              </div>
              <div className="max-h-64 overflow-y-auto">
                {savedList.length === 0 ? (
                  <div className="text-center py-6 text-sm" style={{ color: theme.text.muted }}>No saved strategies</div>
                ) : savedList.map(s => (
                  <div key={s.id} className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${theme.border.subtle}` }}>
                    <div>
                      <div className="text-sm font-bold" style={{ color: theme.text.secondary }}>{s.name}</div>
                      <div className="text-sm" style={{ color: theme.text.faint }}>{s.underlying} • {s.legs.length} legs</div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => handleLoad(s)} className="text-sm px-2 py-0.5 rounded" style={{ background: theme.accent.cyan + "20", color: theme.accent.cyan }}>Load</button>
                      <button onClick={() => { strategyStorage.deleteStrategy(s.id); setSavedList(strategyStorage.getAll()); }}
                        className="text-sm px-2 py-0.5 rounded" style={{ background: theme.accent.red + "15", color: theme.accent.red }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
              <label className="block px-3 py-2 text-sm font-bold cursor-pointer text-center"
                style={{ color: theme.accent.purple, borderTop: `1px solid ${theme.border.subtle}` }}>
                <Upload size={13} className="inline mr-1" /> Import from file
                <input type="file" accept=".json" className="hidden" onChange={handleImport} />
              </label>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="text-sm text-center py-1" style={{ background: theme.accent.cyan + "10", color: theme.accent.cyan }}>{toast}</div>
      )}
      {saveMsg && (
        <div className="text-sm text-center py-1" style={{ background: theme.accent.green + "10", color: theme.accent.green }}>{saveMsg}</div>
      )}

      {/* ══════════ REPLAY CONTROL BAR ══════════ */}
      <ReplayControlBar chain={chain} />

      {/* ══════════ WALK FORWARD BAR ══════════ */}
      <WalkForwardBar chain={chain} />

      {/* ══════════ MAIN WORKSPACE ══════════ */}
      <div className="flex-1 overflow-y-auto p-3 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-[35%_65%] gap-3 items-start">

          {/* ───────── LEFT PANEL (35%) ───────── */}
          <div className="space-y-3">
            {/* Section A: Option Chain */}
            <OptionChainPanel chain={chain} />

            {/* Section B: Strategy Builder */}
            <Card title="Strategy Builder">
              <div className="space-y-3">
                <div>
                  <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Underlying</div>
                  <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${theme.border.subtle}` }}>
                    {(["NIFTY", "BANKNIFTY", "MIDCPNIFTY"] as const).map(u => (
                      <button key={u} onClick={() => { setUnderlying(u); clearLegs(); }}
                        className="flex-1 py-1.5 text-sm font-bold"
                        style={{ background: underlying === u ? theme.accent.cyan : theme.bg.surfaceAlt, color: underlying === u ? theme.bg.page : theme.text.muted }}>
                        {u === "MIDCPNIFTY" ? "MIDCP" : u}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Spot Price", value: spot || effectiveSpot, setter: (v: string) => setSpot(Number(v)), color: theme.accent.cyan },
                    { label: "IV %", value: iv, setter: (v: string) => setIV(Number(v)), color: theme.accent.purple },
                    { label: "Days to Expiry", value: daysToExpiry, setter: (v: string) => setDaysToExpiry(Number(v)), color: theme.accent.orange },
                    { label: "Risk Free Rate %", value: riskFreeRate, setter: (v: string) => store.setRiskFreeRate(Number(v)), color: theme.text.muted },
                  ].map(({ label, value, setter, color }) => (
                    <div key={label}>
                      <div className="text-sm mb-1" style={{ color: theme.text.muted }}>{label}</div>
                      <input type="number" value={value} onChange={e => setter(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg text-sm outline-none text-center"
                        style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color }} />
                    </div>
                  ))}
                </div>

                <div>
                  <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Templates</div>
                  <StrategyTemplates onSelect={handleTemplate} selected={template} />
                </div>

                <div>
                  <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Add Legs</div>
                  <div className="grid grid-cols-2 gap-2">
                    {([["CE", "BUY", theme.accent.green], ["CE", "SELL", theme.accent.red], ["PE", "BUY", theme.accent.cyan], ["PE", "SELL", theme.accent.purple]] as const).map(
                      ([type, action, color]) => (
                        <button key={`${action}-${type}`} onClick={() => addCustomLeg(type, action)}
                          className="py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1"
                          style={{ background: color + "15", color, border: `1px solid ${color}30` }}>
                          <Plus size={14} /> {action} {type}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {legs.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-bold" style={{ color: theme.text.muted }}>Legs ({legs.length})</div>
                      <div className="flex gap-2">
                        <button onClick={clearLegs} className="text-sm px-2 py-0.5 rounded" style={{ color: theme.accent.red, background: theme.accent.red + "15" }}>Clear</button>
                        <button onClick={calculate} className="text-sm px-2 py-0.5 rounded flex items-center gap-1" style={{ color: theme.accent.cyan, background: theme.accent.cyan + "15" }}>
                          <RefreshCw size={13} /> Recalc
                        </button>
                      </div>
                    </div>
                    {legs.map((leg, i) => (
                      <LegRow
                        key={leg.id}
                        leg={leg} index={i}
                        onUpdate={updateLeg}
                        onDuplicate={handleDuplicate}
                        onDelete={removeLeg}
                        onDragStart={setDragFrom}
                        onDragOver={setDragOver}
                        onDrop={handleDrop}
                        onRoll={handleRollStrike}
                      />
                    ))}
                  </div>
                )}

                {!legs.length && (
                  <div className="text-center py-8" style={{ color: theme.text.muted }}>
                    <div className="text-sm">Select a template or add legs manually</div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* ───────── RIGHT PANEL (65%) ───────── */}
          <div className="space-y-3">
            {/* Live Payoff Chart — refreshes automatically, no Calculate needed */}
            <Card title="Live Payoff" extra={
              <div className="flex items-center gap-2">
                <LineChartIcon size={13} color={theme.text.muted} />
                <button onClick={() => setShowPerLeg(v => !v)}
                  className="text-sm px-2 py-0.5 rounded"
                  style={{ color: showPerLeg ? theme.accent.cyan : theme.text.muted, background: theme.border.subtle }}>
                  Per Leg
                </button>
              </div>
            }>
              {payoff && legs.length > 0 ? (
                <div style={{ height: 380 }}>
                  <PayoffChart result={payoff} spot={effectiveSpot} showPerLeg={showPerLeg} />
                </div>
              ) : (
                <div className="text-center py-16" style={{ color: theme.text.muted }}>
                  <div className="text-sm">Add legs to see the live payoff chart</div>
                </div>
              )}
            </Card>

            {/* Compact analytics cards */}
            <Card title="Analytics">
              <AnalyticsCards payoff={payoff} margin={margin} greeks={portfolioGreeks} pop={pop} hasLegs={legs.length > 0} />
            </Card>

            {/* Tabbed bottom section */}
            <TabbedBottomPanel
              greeks={portfolioGreeks}
              scenarioMatrix={scenarioMatrix}
              adjustments={adjustments}
              worstLevel={worstLevel}
              onRoll={handleRollStrike}
              onClose={removeLeg}
              tradeLog={tradeLog}
              hasLegs={legs.length > 0}
            />
          </div>
        </div>
      </div>

      {/* ══════════ FIXED BOTTOM ACTION BAR ══════════ */}
      <div className="fixed bottom-0 left-0 right-0 flex items-center justify-around gap-1 px-2 py-2 z-20 overflow-x-auto"
        style={{ background: theme.bg.surface, borderTop: `1px solid ${theme.border.subtle}` }}>
        <button onClick={calculate} className="flex flex-col items-center gap-0.5 px-2 shrink-0" style={{ color: theme.accent.cyan }}>
          <RefreshCw size={16} /><span style={{ fontSize: 9 }}>Calculate</span>
        </button>
        <button onClick={handleSave} className="flex flex-col items-center gap-0.5 px-2 shrink-0" style={{ color: theme.accent.green }}>
          <Save size={16} /><span style={{ fontSize: 9 }}>Save</span>
        </button>
        <button onClick={() => setLoadOpen(v => !v)} className="flex flex-col items-center gap-0.5 px-2 shrink-0" style={{ color: theme.accent.cyan }}>
          <FolderOpen size={16} /><span style={{ fontSize: 9 }}>Load</span>
        </button>
        <button onClick={handleExport} className="flex flex-col items-center gap-0.5 px-2 shrink-0" style={{ color: theme.accent.purple }}>
          <Download size={16} /><span style={{ fontSize: 9 }}>Export</span>
        </button>
        <button onClick={() => flashToast("AI Suggest — coming soon")} className="flex flex-col items-center gap-0.5 px-2 shrink-0" style={{ color: theme.accent.orange }}>
          <Sparkles size={16} /><span style={{ fontSize: 9 }}>AI Suggest</span>
        </button>
        <button onClick={chain.runWalkForward} className="flex flex-col items-center gap-0.5 px-2 shrink-0" style={{ color: theme.accent.orange }}>
          <Zap size={16} /><span style={{ fontSize: 9 }}>Run Backtest</span>
        </button>
        <button onClick={handlePaperTrade} className="flex flex-col items-center gap-0.5 px-2 shrink-0" style={{ color: theme.accent.green }}>
          <LineChartIcon size={16} /><span style={{ fontSize: 9 }}>Paper Trade</span>
        </button>
      </div>

      {/* Floating Position Book */}
      <PositionBook legs={legs} spot={effectiveSpot} T={T} riskFreeRate={r} onExit={removeLeg} />
    </div>
  );
}
