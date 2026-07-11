/**
 * TradePro - Options Simulator Page
 * Full strategy builder with payoff, Greeks, margin, scenario matrix.
 */

import { useState, useCallback }  from "react";
import { useAppStore }            from "../store";
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
import { LOT_SIZES }              from "../simulator/models/Option";

import StrategyTemplates  from "../simulator/components/StrategyTemplates";
import LegRow             from "../simulator/components/LegRow";
import PayoffChart        from "../simulator/components/PayoffChart";
import GreeksDisplay      from "../simulator/components/GreeksDisplay";
import ScenarioMatrixDisplay from "../simulator/components/ScenarioMatrix";
import MarginDisplay      from "../simulator/components/MarginDisplay";
import Card               from "../components/ui/Card";
import Loader             from "../components/ui/Loader";

import {
  Plus, Save, Download, Upload, RefreshCw,
  BarChart2, Grid, Activity, Shield,
} from "lucide-react";

type TabType = "builder" | "payoff" | "greeks" | "scenario" | "margin" | "saved";

export default function Simulator() {
  const { nifty, bankNifty }  = useAppStore();
  const store                 = useSimulatorStore();
  const {
    underlying, spot, iv, daysToExpiry, riskFreeRate,
    legs, setUnderlying, setSpot, setIV, setDaysToExpiry,
    addLeg, removeLeg, updateLeg, clearLegs,
    payoff, setPayoff, setIsCalculating,
  } = store;

  const [tab,          setTab]          = useState<TabType>("builder");
  const [template,     setTemplate]     = useState("CUSTOM");
  const [showPerLeg,   setShowPerLeg]   = useState(false);
  const [dragFrom,     setDragFrom]     = useState<number | null>(null);
  const [savedList,    setSavedList]    = useState<BuiltStrategy[]>(() => strategyStorage.getAll());
  const [saveMsg,      setSaveMsg]      = useState("");
  const [stratName,    setStratName]    = useState("My Strategy");

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
        daysToExpiry,
        riskFreeRate: r,
        useBS       : true,
      });
      setPayoff(result);
      setTab("payoff");
    } finally {
      setIsCalculating(false);
    }
  }, [legs, effectiveSpot, daysToExpiry, r]);

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

  // ─── Template select ──────────────────────────────────────────────────────
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
    setTab("builder");
  };

  // ─── Duplicate leg ────────────────────────────────────────────────────────
  const handleDuplicate = (leg: OptionLeg) => {
    addLeg({ ...leg });
  };

  const TABS: { id: TabType; label: string; icon: any }[] = [
    { id: "builder",  label: "Builder",  icon: Plus      },
    { id: "payoff",   label: "Payoff",   icon: BarChart2 },
    { id: "greeks",   label: "Greeks",   icon: Activity  },
    { id: "scenario", label: "Scenario", icon: Grid      },
    { id: "margin",   label: "Margin",   icon: Shield    },
    { id: "saved",    label: "Saved",    icon: Save      },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b overflow-x-auto"
        style={{ borderColor: "#0f1e36", background: "#060c1a" }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex items-center gap-1 px-3 py-2 text-xs font-bold shrink-0 transition-all"
            style={{
              color      : tab === id ? "#00c8f0" : "#445566",
              borderBottom: tab === id ? "2px solid #00c8f0" : "2px solid transparent",
            }}>
            <Icon size={11} />{label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">

        {/* ── BUILDER TAB ── */}
        {tab === "builder" && (
          <>
            {/* Market params */}
            <Card title="Market Parameters">
              <div className="grid grid-cols-2 gap-2">
                {/* Underlying */}
                <div className="col-span-2">
                  <div className="text-xs mb-1" style={{ color: "#334455" }}>Underlying</div>
                  <div className="flex rounded-lg overflow-hidden"
                    style={{ border: "1px solid #0f1e36" }}>
                    {(["NIFTY", "BANKNIFTY", "MIDCPNIFTY"] as const).map(u => (
                      <button key={u} onClick={() => { setUnderlying(u); clearLegs(); }}
                        className="flex-1 py-1.5 text-xs font-bold"
                        style={{
                          background: underlying === u ? "#00c8f0" : "#090f1e",
                          color     : underlying === u ? "#03050d" : "#445566",
                        }}>
                        {u === "MIDCPNIFTY" ? "MIDCP" : u}
                      </button>
                    ))}
                  </div>
                </div>

                {[
                  { label: "Spot Price", value: spot || effectiveSpot, setter: (v: string) => setSpot(Number(v)), color: "#00c8f0" },
                  { label: "IV %",       value: iv,                    setter: (v: string) => setIV(Number(v)),   color: "#9b5cf6" },
                  { label: "Days to Expiry", value: daysToExpiry,      setter: (v: string) => setDaysToExpiry(Number(v)), color: "#f0a030" },
                  { label: "Risk Free Rate %", value: riskFreeRate,   setter: (v: string) => store.setRiskFreeRate(Number(v)), color: "#445566" },
                ].map(({ label, value, setter, color }) => (
                  <div key={label}>
                    <div className="text-xs mb-1" style={{ color: "#334455" }}>{label}</div>
                    <input type="number" value={value}
                      onChange={e => setter(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg text-xs outline-none text-center"
                      style={{ background: "#060c1a", border: "1px solid #0f1e36", color }} />
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
                {([["CE","BUY","#00d97e"],["CE","SELL","#f03060"],["PE","BUY","#00c8f0"],["PE","SELL","#9b5cf6"]] as const).map(
                  ([type, action, color]) => (
                    <button key={`${action}-${type}`}
                      onClick={() => addCustomLeg(type, action)}
                      className="py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                      style={{ background: color + "15", color, border: `1px solid ${color}30` }}>
                      <Plus size={11} /> {action} {type}
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
                  className="w-full px-3 py-1.5 rounded-lg text-xs outline-none"
                  style={{ background: "#060c1a", border: "1px solid #0f1e36", color: "#c0d0e8" }} />
                {saveMsg && (
                  <div className="text-xs text-center" style={{ color: saveMsg.startsWith("✅") ? "#00d97e" : "#f03060" }}>
                    {saveMsg}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={handleSave}
                    className="py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                    style={{ background: "#00d97e20", color: "#00d97e", border: "1px solid #00d97e30" }}>
                    <Save size={11} /> Save
                  </button>
                  <button onClick={handleExport}
                    className="py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                    style={{ background: "#00c8f020", color: "#00c8f0", border: "1px solid #00c8f030" }}>
                    <Download size={11} /> Export
                  </button>
                  <label className="py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                    style={{ background: "#9b5cf620", color: "#9b5cf6", border: "1px solid #9b5cf630" }}>
                    <Upload size={11} /> Import
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
                    className="text-xs px-2 py-0.5 rounded"
                    style={{ color: "#f03060", background: "#f0306015" }}>
                    Clear All
                  </button>
                  <button onClick={calculate}
                    className="text-xs px-2 py-0.5 rounded flex items-center gap-1"
                    style={{ color: "#00c8f0", background: "#00c8f015" }}>
                    <RefreshCw size={10} /> Calculate
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
              <div className="text-center py-10" style={{ color: "#445566" }}>
                <div className="text-3xl mb-2">📊</div>
                <div className="text-sm">Select a template or add legs manually</div>
              </div>
            )}
          </>
        )}

        {/* ── PAYOFF TAB ── */}
        {tab === "payoff" && (
          <>
            {!payoff && legs.length > 0 && (
              <button onClick={calculate}
                className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                style={{ background: "#00c8f020", color: "#00c8f0", border: "1px solid #00c8f030" }}>
                <RefreshCw size={14} /> Calculate Payoff
              </button>
            )}
            {payoff && (
              <Card title="Payoff Diagram" extra={
                <button onClick={() => setShowPerLeg(v => !v)}
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ color: showPerLeg ? "#00c8f0" : "#445566", background: "#0f1e36" }}>
                  Per Leg
                </button>
              }>
                <PayoffChart result={payoff} spot={effectiveSpot} showPerLeg={showPerLeg} />
              </Card>
            )}
            {!payoff && !legs.length && (
              <div className="text-center py-10" style={{ color: "#445566" }}>
                <div className="text-3xl mb-2">📈</div>
                <div className="text-sm">Add legs and calculate payoff</div>
              </div>
            )}
          </>
        )}

        {/* ── GREEKS TAB ── */}
        {tab === "greeks" && (
          <>
            {legs.length > 0
              ? <Card title="Portfolio Greeks"><GreeksDisplay greeks={portfolioGreeks} /></Card>
              : <div className="text-center py-10" style={{ color: "#445566" }}>
                  <div className="text-3xl mb-2">🧮</div>
                  <div className="text-sm">Add legs to see Greeks</div>
                </div>
            }
          </>
        )}

        {/* ── SCENARIO TAB ── */}
        {tab === "scenario" && (
          <>
            {scenarioMatrix
              ? <Card title="Scenario Matrix (Spot × IV)">
                  <ScenarioMatrixDisplay matrix={scenarioMatrix} />
                </Card>
              : <div className="text-center py-10" style={{ color: "#445566" }}>
                  <div className="text-3xl mb-2">🗺️</div>
                  <div className="text-sm">Add legs to see scenario matrix</div>
                </div>
            }
          </>
        )}

        {/* ── MARGIN TAB ── */}
        {tab === "margin" && (
          <>
            {margin
              ? <Card title="Margin Analysis">
                  <MarginDisplay margin={margin} available={500000} />
                </Card>
              : <div className="text-center py-10" style={{ color: "#445566" }}>
                  <div className="text-3xl mb-2">🛡️</div>
                  <div className="text-sm">Add legs to see margin requirements</div>
                </div>
            }
          </>
        )}

        {/* ── SAVED TAB ── */}
        {tab === "saved" && (
          <>
            {savedList.length === 0
              ? <div className="text-center py-10" style={{ color: "#445566" }}>
                  <div className="text-3xl mb-2">💾</div>
                  <div className="text-sm">No saved strategies</div>
                </div>
              : <div className="space-y-2">
                  {savedList.map(s => (
                    <div key={s.id} className="rounded-xl p-3"
                      style={{ background: "#090f1e", border: "1px solid #0f1e36" }}>
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <div className="text-xs font-bold" style={{ color: "#c0d0e8" }}>{s.name}</div>
                          <div className="text-xs" style={{ color: "#445566" }}>
                            {s.underlying} • {s.legs.length} legs • ₹{s.spot.toLocaleString("en-IN")}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => handleLoad(s)}
                            className="text-xs px-2 py-0.5 rounded"
                            style={{ background: "#00c8f020", color: "#00c8f0" }}>
                            Load
                          </button>
                          <button onClick={() => strategyStorage.exportStrategy(s)}
                            className="text-xs px-2 py-0.5 rounded"
                            style={{ background: "#0f1e36", color: "#445566" }}>
                            <Download size={10} />
                          </button>
                          <button onClick={() => {
                            strategyStorage.deleteStrategy(s.id);
                            setSavedList(strategyStorage.getAll());
                          }}
                            className="text-xs px-2 py-0.5 rounded"
                            style={{ background: "#f0306015", color: "#f03060" }}>
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </>
        )}
      </div>
    </div>
  );
}
