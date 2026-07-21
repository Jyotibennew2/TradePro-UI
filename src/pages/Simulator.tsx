/**
 * TradePro - Options Simulator Page
 * Single scrollable page — every section (Builder, Historical Chain, Payoff,
 * Greeks, Scenario, Margin, Adjust, Saved) is a collapsible block toggled by
 * the button row at top, instead of separate tabs. Multiple sections can be
 * open at once.
 */

import { useState, useCallback, useEffect, useRef }  from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppStore }            from "../store";
import { useTheme } from "../store/themeStore";
import { useSimulatorStore, makeOptionLeg } from "../simulator/state/simulatorStore";
import { StrategyBuilder }        from "../simulator/services/strategyBuilder";
import { strategyStorage }        from "../simulator/services/strategyStorage";
import { calculatePayoff }        from "../simulator/pricing/PayoffEngine";
import { calculatePortfolioMargin } from "../simulator/pricing/MarginEngine";
import { buildScenarioMatrix }    from "../simulator/pricing/PayoffEngine";
import { bsGreeks }               from "../simulator/pricing/BlackScholes";
import { spotRange, daysToYears } from "../simulator/pricing/BlackScholes";
import { STRATEGY_CATALOG }       from "../simulator/models/Strategy";
import type { PortfolioGreeks }   from "../simulator/models/Greeks";
import type { BuiltStrategy }     from "../simulator/models/Strategy";
import type { OptionLeg }         from "../simulator/models/Option";
import { LOT_SIZES, STRIKE_STEPS } from "../simulator/models/Option";

import StrategyTemplates  from "../simulator/components/StrategyTemplates";
import LegRow             from "../simulator/components/LegRow";
import PayoffChart        from "../simulator/components/PayoffChart";
import GreeksDisplay      from "../simulator/components/GreeksDisplay";
import ScenarioMatrixDisplay from "../simulator/components/ScenarioMatrix";
import MarginDisplay      from "../simulator/components/MarginDisplay";
import HistoricalOptionChain from "../components/historical/HistoricalOptionChain";
import Card               from "../components/ui/Card";

import {
  Plus, Save, Download, Upload, RefreshCw,
  BarChart2, Grid, Activity, Shield, AlertTriangle, ArrowUpDown, X,
  History, ChevronDown, ChevronUp,
} from "lucide-react";

type SectionId = "builder" | "historical" | "payoff" | "greeks" | "scenario" | "margin" | "adjust" | "saved";

export default function Simulator() {
  const theme = useTheme();
  const { nifty, bankNifty }  = useAppStore();
  const store                 = useSimulatorStore();
  const {
    underlying, spot, iv, daysToExpiry, riskFreeRate,
    legs, setUnderlying, setSpot, setIV, setDaysToExpiry,
    addLeg, removeLeg, updateLeg, clearLegs,
    payoff, setPayoff, setIsCalculating,
  } = store;

  const [openSections, setOpenSections] = useState<Set<SectionId>>(new Set(["builder"]));
  const [template,     setTemplate]     = useState("CUSTOM");
  const [showPerLeg,   setShowPerLeg]   = useState(false);
  const [dragFrom,     setDragFrom]     = useState<number | null>(null);
  const [savedList,    setSavedList]    = useState<BuiltStrategy[]>(() => strategyStorage.getAll());
  const [saveMsg,      setSaveMsg]      = useState("");
  const [stratName,    setStratName]    = useState("My Strategy");

  const sectionRefs = useRef<Record<SectionId, HTMLDivElement | null>>({} as any);

  const toggleSection = (id: SectionId) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      const wasOpen = next.has(id);
      if (wasOpen) next.delete(id); else next.add(id);
      if (!wasOpen) {
        setTimeout(() => sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      }
      return next;
    });
  };

  const effectiveSpot = spot || (underlying === "NIFTY" ? nifty : bankNifty) || 24300;
  const T             = daysToYears(daysToExpiry);
  const r             = riskFreeRate / 100;
  const sigmaBase     = iv / 100;

  // ─── Calculate ───────────────────────────────────────────────────────────
  const calculate = useCallback(() => {
    if (!legs.length) return;
    setIsCalculating(true);
    try {
      const spots  = spotRange(effectiveSpot, 0.10, 80);
      const result = calculatePayoff({
        legs,
        spotRange   : { min: spots[0], max: spots[spots.length - 1], steps: 80 },
        daysToExpiry: 0,
        riskFreeRate: r,
        useBS       : true,
      });
      setPayoff(result);
    } finally {
      setIsCalculating(false);
    }
  }, [legs, effectiveSpot, daysToExpiry, r]);

  // Auto-calculate payoff when legs change
  useEffect(() => {
    if (legs.length > 0) {
      calculate();
    }
  }, [legs, calculate]);

  // ─── Portfolio Greeks ─────────────────────────────────────────────────────
  const portfolioGreeks: PortfolioGreeks = legs.reduce(
    (acc, leg) => {
      const g = bsGreeks({
        spot        : effectiveSpot,
        strike      : leg.contract.strike,
        timeToExpiry: T,
        riskFreeRate: r,
        volatility  : leg.iv / 100,
        optionType  : leg.contract.optionType,
      });
      const m   = leg.action === "BUY" ? 1 : -1;
      const qty = leg.lots * leg.contract.lotSize;
      return {
        netDelta  : acc.netDelta   + m * g.delta * qty,
        netGamma  : acc.netGamma   + m * g.gamma * qty,
        netTheta  : acc.netTheta   + m * g.theta * qty,
        netVega   : acc.netVega    + m * g.vega  * qty,
        netRho    : acc.netRho     + m * g.rho   * qty,
        totalValue: acc.totalValue + m * g.price * qty,
      };
    },
    { netDelta: 0, netGamma: 0, netTheta: 0, netVega: 0, netRho: 0, totalValue: 0 }
  );

  // ─── Margin ───────────────────────────────────────────────────────────────
  const margin = legs.length
    ? calculatePortfolioMargin(legs, effectiveSpot)
    : null;

  // ─── Scenario matrix ──────────────────────────────────────────────────────
  const scenarioMatrix = legs.length
    ? buildScenarioMatrix(legs, effectiveSpot, iv, daysToExpiry, r)
    : null;

  // ─── Adjustments ──────────────────────────────────────────────────────────
  type ThreatLevel = "safe" | "watch" | "danger";
  const BUFFER_WATCH  = 0.03;
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
    adjustments.some(a => a.level === "watch")  ? "watch"  : "safe";

  const handleRollStrike = (leg: OptionLeg) => {
    const step      = STRIKE_STEPS[underlying];
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
      contract    : { ...leg.contract, strike: newStrike },
      entryPrice  : newPremium,
      currentPrice: newPremium,
    });
  };

  const handleTemplate = (key: string) => {
    setTemplate(key);
    const st = useSimulatorStore.getState();
    if (key === "CUSTOM") { st.clearLegs(); return; }
    try {
      const s = effectiveSpot > 0 ? effectiveSpot : 24300;
      const built = StrategyBuilder.build(
        key as any, underlying, s,
        daysToExpiry, iv, riskFreeRate, 1
      );
      if (built.length > 0) {
        st.setLegs(built);
        const name = STRATEGY_CATALOG[key as keyof typeof STRATEGY_CATALOG]?.name ?? key;
        setStratName(name);
      }
    } catch(e) {
      console.error("Template error:", e);
    }
  };

  // ─── Apply template requested from Screener page ────────────────────────
  const location = useLocation();
  const navigate  = useNavigate();
  useEffect(() => {
    const requested = (location.state as any)?.template;
    if (requested) {
      handleTemplate(requested);
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Add custom leg ───────────────────────────────────────────────────────
  const addCustomLeg = (optType: "CE" | "PE", action: "BUY" | "SELL") => {
    const strike = Math.round(effectiveSpot / 50) * 50;
    addLeg(makeOptionLeg(
      underlying, strike, optType, action, 1,
      Math.max(bsGreeks({ spot: effectiveSpot, strike, timeToExpiry: T, riskFreeRate: r,
        volatility: sigmaBase, optionType: optType }).price, 0.05),
      iv, ""
    ));
  };

  // ─── Drag reorder ─────────────────────────────────────────────────────────
  const [dragOver, setDragOver] = useState<number | null>(null);
  const handleDrop = () => {
    if (dragFrom === null || dragOver === null || dragFrom === dragOver) return;
    const reordered = [...legs];
    const [moved]   = reordered.splice(dragFrom, 1);
    reordered.splice(dragOver, 0, moved);
    clearLegs();
    reordered.forEach(l => addLeg(l));
    setDragFrom(null); setDragOver(null);
  };

  // ─── Save ─────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!legs.length) { setSaveMsg("Add legs first"); return; }
    const s: BuiltStrategy = {
      id: crypto.randomUUID(), type: template as any,
      name: stratName, underlying, spot: effectiveSpot,
      legs, netPremium: margin?.netPremium ?? 0,
      maxProfit: payoff?.combined.maxProfit ?? 0,
      maxLoss  : payoff?.combined.maxLoss   ?? 0,
      breakevens: payoff?.combined.breakevens ?? [],
      greeks: portfolioGreeks,
      status: "DRAFT",
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    strategyStorage.saveStrategy(s);
    setSavedList(strategyStorage.getAll());
    setSaveMsg("✅ Saved!");
    setTimeout(() => setSaveMsg(""), 2000);
  };

  // ─── Export ───────────────────────────────────────────────────────────────
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

  // ─── Import ───────────────────────────────────────────────────────────────
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const s = await strategyStorage.importStrategy(file);
      clearLegs();
      s.legs.forEach(l => addLeg(l));
      setStratName(s.name);
      setSaveMsg("✅ Imported!");
      setTimeout(() => setSaveMsg(""), 2000);
    } catch { setSaveMsg("❌ Invalid file"); }
  };

  // ─── Load saved ───────────────────────────────────────────────────────────
  const handleLoad = (s: BuiltStrategy) => {
    clearLegs();
    s.legs.forEach(l => addLeg(l));
    setStratName(s.name);
    setOpenSections(prev => new Set(prev).add("builder"));
  };

  // ─── Duplicate leg ────────────────────────────────────────────────────────
  const handleDuplicate = (leg: OptionLeg) => {
    addLeg({ ...leg });
  };

  const SECTIONS: { id: SectionId; label: string; icon: any }[] = [
    { id: "builder",     label: "Builder",     icon: Plus          },
    { id: "historical",  label: "Hist. Chain", icon: History       },
    { id: "payoff",      label: "Payoff",      icon: BarChart2     },
    { id: "greeks",      label: "Greeks",      icon: Activity      },
    { id: "scenario",    label: "Scenario",    icon: Grid          },
    { id: "margin",      label: "Margin",      icon: Shield        },
    { id: "adjust",      label: "Adjust",      icon: AlertTriangle },
    { id: "saved",       label: "Saved",       icon: Save          },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Section toggle buttons — click to open/close, multiple can be open */}
      <div className="flex border-b overflow-x-auto sticky top-0 z-10"
        style={{ borderColor: theme.border.subtle, background: theme.bg.surface }}>
        {SECTIONS.map(({ id, label, icon: Icon }) => {
          const isOpen = openSections.has(id);
          return (
            <button key={id} onClick={() => toggleSection(id)}
              className="flex items-center gap-1 px-3 py-2 text-sm font-bold shrink-0 transition-all relative"
              style={{
                color      : isOpen ? theme.accent.cyan : theme.text.muted,
                borderBottom: isOpen ? `2px solid ${theme.accent.cyan}` : "2px solid transparent",
              }}>
              <Icon size={14} />{label}
              {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {id === "adjust" && worstLevel !== "safe" && (
                <span style={{
                  position: "absolute", top: 4, right: 2, width: 6, height: 6, borderRadius: 99,
                  background: worstLevel === "danger" ? theme.accent.red : theme.accent.orange,
                }} />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">

        {/* ── BUILDER ── */}
        {openSections.has("builder") && (
          <div ref={el => { sectionRefs.current.builder = el; }} className="space-y-3">
            {/* Market params */}
            <Card title="Market Parameters">
              <div className="grid grid-cols-2 gap-2">
                {/* Underlying */}
                <div className="col-span-2">
                  <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Underlying</div>
                  <div className="flex rounded-lg overflow-hidden"
                    style={{ border: `1px solid ${theme.border.subtle}` }}>
                    {(["NIFTY", "BANKNIFTY", "MIDCPNIFTY"] as const).map(u => (
                      <button key={u} onClick={() => { setUnderlying(u); clearLegs(); }}
                        className="flex-1 py-1.5 text-sm font-bold"
                        style={{
                          background: underlying === u ? theme.accent.cyan : theme.bg.surfaceAlt,
                          color     : underlying === u ? theme.bg.page : theme.text.muted,
                        }}>
                        {u === "MIDCPNIFTY" ? "MIDCP" : u}
                      </button>
                    ))}
                  </div>
                </div>

                {[
                  { label: "Spot Price", value: spot || effectiveSpot, setter: (v: string) => setSpot(Number(v)), color: theme.accent.cyan },
                  { label: "IV %",       value: iv,                    setter: (v: string) => setIV(Number(v)),   color: theme.accent.purple },
                  { label: "Days to Expiry", value: daysToExpiry,      setter: (v: string) => setDaysToExpiry(Number(v)), color: theme.accent.orange },
                  { label: "Risk Free Rate %", value: riskFreeRate,   setter: (v: string) => store.setRiskFreeRate(Number(v)), color: theme.text.muted },
                ].map(({ label, value, setter, color }) => (
                  <div key={label}>
                    <div className="text-sm mb-1" style={{ color: theme.text.muted }}>{label}</div>
                    <input type="number" value={value}
                      onChange={e => setter(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg text-sm outline-none text-center"
                      style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color }} />
                  </div>
                ))}
              </div>
            </Card>

            {/* Templates */}
            <Card title="Strategy Templates">
              <StrategyTemplates onSelect={handleTemplate} selected={template} />
            </Card>

            {/* Add legs */}
            <Card title="Add Legs">
              <div className="grid grid-cols-2 gap-2">
                {([["CE","BUY",theme.accent.green],["CE","SELL",theme.accent.red],["PE","BUY",theme.accent.cyan],["PE","SELL",theme.accent.purple]] as const).map(
                  ([type, action, color]) => (
                    <button key={`${action}-${type}`}
                      onClick={() => addCustomLeg(type, action)}
                      className="py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1"
                      style={{ background: color + "15", color, border: `1px solid ${color}30` }}>
                      <Plus size={14} /> {action} {type}
                    </button>
                  )
                )}
              </div>
            </Card>

            {/* Strategy name + actions */}
            <Card title="Strategy">
              <div className="space-y-2">
                <input type="text" value={stratName}
                  onChange={e => setStratName(e.target.value)}
                  placeholder="Strategy name..."
                  className="w-full px-3 py-1.5 rounded-lg text-sm outline-none"
                  style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color: theme.text.secondary }} />
                {saveMsg && (
                  <div className="text-sm text-center" style={{ color: saveMsg.startsWith("✅") ? theme.accent.green : theme.accent.red }}>
                    {saveMsg}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={handleSave}
                    className="py-1.5 rounded-lg text-sm font-bold flex items-center justify-center gap-1"
                    style={{ background: theme.accent.green + "20", color: theme.accent.green, border: `1px solid ${theme.accent.green}30` }}>
                    <Save size={14} /> Save
                  </button>
                  <button onClick={handleExport}
                    className="py-1.5 rounded-lg text-sm font-bold flex items-center justify-center gap-1"
                    style={{ background: theme.accent.cyan + "20", color: theme.accent.cyan, border: `1px solid ${theme.accent.cyan}30` }}>
                    <Download size={14} /> Export
                  </button>
                  <label className="py-1.5 rounded-lg text-sm font-bold flex items-center justify-center gap-1 cursor-pointer"
                    style={{ background: theme.accent.purple + "20", color: theme.accent.purple, border: `1px solid ${theme.accent.purple}30` }}>
                    <Upload size={14} /> Import
                    <input type="file" accept=".json" className="hidden" onChange={handleImport} />
                  </label>
                </div>
              </div>
            </Card>

            {/* Legs */}
            {legs.length > 0 && (
              <Card title={`Legs (${legs.length})`} extra={
                <div className="flex gap-2">
                  <button onClick={clearLegs}
                    className="text-sm px-2 py-0.5 rounded"
                    style={{ color: theme.accent.red, background: theme.accent.red + "15" }}>
                    Clear All
                  </button>
                  <button onClick={calculate}
                    className="text-sm px-2 py-0.5 rounded flex items-center gap-1"
                    style={{ color: theme.accent.cyan, background: theme.accent.cyan + "15" }}>
                    <RefreshCw size={13} /> Calculate
                  </button>
                </div>
              }>
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
                  />
                ))}
              </Card>
            )}

            {!legs.length && (
              <div className="text-center py-10" style={{ color: theme.text.muted }}>
                <div className="text-3xl mb-2">📊</div>
                <div className="text-sm">Select a template or add legs manually</div>
              </div>
            )}
          </div>
        )}

        {/* ── HISTORICAL OPTION CHAIN ── */}
        {openSections.has("historical") && (
          <div ref={el => { sectionRefs.current.historical = el; }}>
            <HistoricalOptionChain />
          </div>
        )}

        {/* ── PAYOFF ── */}
        {openSections.has("payoff") && (
          <div ref={el => { sectionRefs.current.payoff = el; }} className="space-y-3">
            {!payoff && legs.length > 0 && (
              <button onClick={calculate}
                className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                style={{ background: theme.accent.cyan + "20", color: theme.accent.cyan, border: `1px solid ${theme.accent.cyan}30` }}>
                <RefreshCw size={14} /> Calculate Payoff
              </button>
            )}
            {payoff && (
              <Card title="Payoff Diagram" extra={
                <button onClick={() => setShowPerLeg(v => !v)}
                  className="text-sm px-2 py-0.5 rounded"
                  style={{ color: showPerLeg ? theme.accent.cyan : theme.text.muted, background: theme.border.subtle }}>
                  Per Leg
                </button>
              }>
                <PayoffChart result={payoff} spot={effectiveSpot} showPerLeg={showPerLeg} />
              </Card>
            )}
            {!payoff && !legs.length && (
              <div className="text-center py-10" style={{ color: theme.text.muted }}>
                <div className="text-3xl mb-2">📈</div>
                <div className="text-sm">Add legs and calculate payoff</div>
              </div>
            )}
          </div>
        )}

        {/* ── GREEKS ── */}
        {openSections.has("greeks") && (
          <div ref={el => { sectionRefs.current.greeks = el; }}>
            {legs.length > 0
              ? <Card title="Portfolio Greeks"><GreeksDisplay greeks={portfolioGreeks} /></Card>
              : <div className="text-center py-10" style={{ color: theme.text.muted }}>
                  <div className="text-3xl mb-2">🧮</div>
                  <div className="text-sm">Add legs to see Greeks</div>
                </div>
            }
          </div>
        )}

        {/* ── SCENARIO ── */}
        {openSections.has("scenario") && (
          <div ref={el => { sectionRefs.current.scenario = el; }}>
            {scenarioMatrix
              ? <Card title="Scenario Matrix (Spot × IV)">
                  <ScenarioMatrixDisplay matrix={scenarioMatrix} />
                </Card>
              : <div className="text-center py-10" style={{ color: theme.text.muted }}>
                  <div className="text-3xl mb-2">🗺️</div>
                  <div className="text-sm">Add legs to see scenario matrix</div>
                </div>
            }
          </div>
        )}

        {/* ── MARGIN ── */}
        {openSections.has("margin") && (
          <div ref={el => { sectionRefs.current.margin = el; }}>
            {margin
              ? <Card title="Margin Analysis">
                  <MarginDisplay margin={margin} available={500000} />
                </Card>
              : <div className="text-center py-10" style={{ color: theme.text.muted }}>
                  <div className="text-3xl mb-2">🛡️</div>
                  <div className="text-sm">Add legs to see margin requirements</div>
                </div>
            }
          </div>
        )}

        {/* ── ADJUST ── */}
        {openSections.has("adjust") && (
          <div ref={el => { sectionRefs.current.adjust = el; }} className="space-y-3">
            {legs.length === 0 ? (
              <div className="text-center py-10" style={{ color: theme.text.muted }}>
                <div className="text-3xl mb-2">🛠️</div>
                <div className="text-sm">Add legs to see adjustment suggestions</div>
              </div>
            ) : adjustments.length === 0 ? (
              <div className="text-center py-10" style={{ color: theme.text.muted }}>
                <div className="text-3xl mb-2">🛡️</div>
                <div className="text-sm">No short legs to monitor</div>
                <div className="text-sm mt-1" style={{ color: theme.text.faint }}>
                  Adjustment suggestions apply to SELL legs only
                </div>
              </div>
            ) : (
              <>
                <Card title="Position Health">
                  <div className="flex items-center gap-2 py-1">
                    <span style={{
                      width: 10, height: 10, borderRadius: 99,
                      background: worstLevel === "danger" ? theme.accent.red : worstLevel === "watch" ? theme.accent.orange : theme.accent.green,
                    }} />
                    <span className="text-sm font-bold" style={{
                      color: worstLevel === "danger" ? theme.accent.red : worstLevel === "watch" ? theme.accent.orange : theme.accent.green,
                    }}>
                      {worstLevel === "danger" ? "Action needed — strike breached or near breach"
                        : worstLevel === "watch" ? "Watch closely — spot approaching a short strike"
                        : "All short legs are safely OTM"}
                    </span>
                  </div>
                </Card>

                {adjustments.map(({ leg, distPct, level }) => (
                  <Card key={leg.id}
                    title={`${leg.action} ${leg.contract.strike} ${leg.contract.optionType}`}
                    extra={
                      <span className="text-sm px-2 py-0.5 rounded font-bold" style={{
                        background: level === "danger" ? theme.accent.red + "20" : level === "watch" ? theme.accent.orange + "20" : theme.accent.green + "20",
                        color     : level === "danger" ? theme.accent.red   : level === "watch" ? theme.accent.orange   : theme.accent.green,
                      }}>
                        {level === "danger" ? "🔴 Danger" : level === "watch" ? "🟠 Watch" : "🟢 Safe"}
                      </span>
                    }>
                    <div className="text-sm mb-3" style={{ color: theme.text.muted }}>
                      Spot is {distPct >= 0 ? `${distPct.toFixed(2)}% away from` : `${Math.abs(distPct).toFixed(2)}% past`} this strike.
                    </div>
                    {level !== "safe" && (
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleRollStrike(leg)}
                          className="py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1"
                          style={{ background: theme.accent.cyan + "20", color: theme.accent.cyan, border: `1px solid ${theme.accent.cyan}30` }}>
                          <ArrowUpDown size={14} /> Roll Strike (One-Click)
                        </button>
                        <button onClick={() => removeLeg(leg.id)}
                          className="py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1"
                          style={{ background: theme.accent.red + "15", color: theme.accent.red, border: `1px solid ${theme.accent.red}30` }}>
                          <X size={14} /> Close Leg
                        </button>
                      </div>
                    )}
                  </Card>
                ))}
              </>
            )}
          </div>
        )}

        {/* ── SAVED ── */}
        {openSections.has("saved") && (
          <div ref={el => { sectionRefs.current.saved = el; }}>
            {savedList.length === 0
              ? <div className="text-center py-10" style={{ color: theme.text.muted }}>
                  <div className="text-3xl mb-2">💾</div>
                  <div className="text-sm">No saved strategies</div>
                </div>
              : <div className="space-y-2">
                  {savedList.map(s => (
                    <div key={s.id} className="rounded-xl p-3"
                      style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}` }}>
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <div className="text-sm font-bold" style={{ color: theme.text.secondary }}>{s.name}</div>
                          <div className="text-sm" style={{ color: theme.text.muted }}>
                            {s.underlying} • {s.legs.length} legs • ₹{s.spot.toLocaleString("en-IN")}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => handleLoad(s)}
                            className="text-sm px-2 py-0.5 rounded"
                            style={{ background: theme.accent.cyan + "20", color: theme.accent.cyan }}>
                            Load
                          </button>
                          <button onClick={() => strategyStorage.exportStrategy(s)}
                            className="text-sm px-2 py-0.5 rounded"
                            style={{ background: theme.border.subtle, color: theme.text.muted }}>
                            <Download size={13} />
                          </button>
                          <button onClick={() => {
                            strategyStorage.deleteStrategy(s.id);
                            setSavedList(strategyStorage.getAll());
                          }}
                            className="text-sm px-2 py-0.5 rounded"
                            style={{ background: theme.accent.red + "15", color: theme.accent.red }}>
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>
        )}
      </div>
    </div>
  );
}
