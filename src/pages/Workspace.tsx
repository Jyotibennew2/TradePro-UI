/**
 * TradePro - Unified Workspace
 * Option Chain + Strategy Builder side by side, Payoff below, Greeks below that.
 * Quick-nav icon rail on the left jumps between sections.
 */

import { useState, useCallback, useRef } from "react";
import { useAppStore } from "../store";
import { useSimulatorStore, makeOptionLeg } from "../simulator/state/simulatorStore";
import { calculatePayoff } from "../simulator/pricing/PayoffEngine";
import { bsGreeks, spotRange, daysToYears } from "../simulator/pricing/BlackScholes";
import type { PortfolioGreeks } from "../simulator/models/Greeks";
import PayoffChart   from "../simulator/components/PayoffChart";
import GreeksDisplay  from "../simulator/components/GreeksDisplay";
import LegRow         from "../simulator/components/LegRow";
import Card           from "../components/ui/Card";
import OptionChain    from "./OptionChain";
import { Plus, LayoutGrid, BarChart2, Activity, RefreshCw } from "lucide-react";

export default function Workspace() {
  const { nifty, bankNifty } = useAppStore();
  const store = useSimulatorStore();
  const {
    underlying, spot, iv, daysToExpiry, riskFreeRate,
    legs, addLeg, removeLeg, updateLeg,
    payoff, setPayoff, setIsCalculating,
  } = store;

  const effectiveSpot = spot || (underlying === "NIFTY" ? nifty : bankNifty) || 24300;
  const T         = daysToYears(daysToExpiry);
  const r         = riskFreeRate / 100;
  const sigmaBase = iv / 100;

  const chainRef  = useRef<HTMLDivElement>(null);
  const payoffRef = useRef<HTMLDivElement>(null);
  const greeksRef = useRef<HTMLDivElement>(null);

  const scrollTo = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const calculate = useCallback(() => {
    if (!legs.length) return;
    setIsCalculating(true);
    try {
      const spots  = spotRange(effectiveSpot, 0.10, 80);
      const result = calculatePayoff({
        legs, spotRange: { min: spots[0], max: spots[spots.length - 1], steps: 80 },
        daysToExpiry: 0, riskFreeRate: r, useBS: true,
      });
      setPayoff(result);
    } finally {
      setIsCalculating(false);
    }
  }, [legs, effectiveSpot, r]);

  const portfolioGreeks: PortfolioGreeks = legs.reduce(
    (acc, leg) => {
      const g = bsGreeks({
        spot: effectiveSpot, strike: leg.contract.strike, timeToExpiry: T,
        riskFreeRate: r, volatility: leg.iv / 100, optionType: leg.contract.optionType,
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

  const addCustomLeg = (optType: "CE" | "PE", action: "BUY" | "SELL") => {
    const strike = Math.round(effectiveSpot / 50) * 50;
    addLeg(makeOptionLeg(
      underlying, strike, optType, action, 1,
      Math.max(bsGreeks({ spot: effectiveSpot, strike, timeToExpiry: T, riskFreeRate: r,
        volatility: sigmaBase, optionType: optType }).price, 0.05),
      iv, ""
    ));
  };

  return (
    <div className="flex h-full">

      {/* Quick-nav icon rail */}
      <div className="flex flex-col gap-3 py-4 px-2 border-r shrink-0"
        style={{ borderColor: "#0f1e36", background: "#060c1a" }}>
        <button onClick={() => scrollTo(chainRef)} title="Option Chain + Builder"
          className="p-2 rounded-lg" style={{ background: "#0f1e36", color: "#00c8f0" }}>
          <LayoutGrid size={16} />
        </button>
        <button onClick={() => scrollTo(payoffRef)} title="Payoff"
          className="p-2 rounded-lg" style={{ background: "#0f1e36", color: "#00c8f0" }}>
          <BarChart2 size={16} />
        </button>
        <button onClick={() => scrollTo(greeksRef)} title="Greeks"
          className="p-2 rounded-lg" style={{ background: "#0f1e36", color: "#00c8f0" }}>
          <Activity size={16} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Section 1: Option Chain + Strategy Builder ── */}
        <div ref={chainRef} className="p-3 border-b" style={{ borderColor: "#0f1e36" }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

            <div className="min-w-0">
              <Card title="Option Chain">
                <div style={{ height: 420 }}>
                  <OptionChain />
                </div>
              </Card>
            </div>

            <div className="min-w-0 space-y-3">
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

              {legs.length > 0 ? (
                <Card title={`Legs (${legs.length})`} extra={
                  <button onClick={calculate}
                    className="text-xs px-2 py-0.5 rounded flex items-center gap-1"
                    style={{ color: "#00c8f0", background: "#00c8f015" }}>
                    <RefreshCw size={10} /> Calculate
                  </button>
                }>
                  {legs.map((leg, i) => (
                    <LegRow key={leg.id} leg={leg} index={i}
                      onUpdate={updateLeg}
                      onDuplicate={l => addLeg({ ...l })}
                      onDelete={removeLeg}
                      onDragStart={() => {}}
                      onDragOver={() => {}}
                      onDrop={() => {}}
                    />
                  ))}
                </Card>
              ) : (
                <div className="text-center py-8" style={{ color: "#445566" }}>
                  <div className="text-2xl mb-1">📊</div>
                  <div className="text-xs">Chain se dekh kar ya buttons se legs add kariye</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Section 2: Payoff ── */}
        <div ref={payoffRef} className="p-3 border-b" style={{ borderColor: "#0f1e36" }}>
          {payoff ? (
            <Card title="Payoff Diagram">
              <PayoffChart result={payoff} spot={effectiveSpot} showPerLeg={false} />
            </Card>
          ) : (
            <div className="text-center py-10" style={{ color: "#445566" }}>
              <div className="text-3xl mb-2">📈</div>
              <div className="text-sm">Legs add karke "Calculate" dabaiye</div>
            </div>
          )}
        </div>

        {/* ── Section 3: Greeks ── */}
        <div ref={greeksRef} className="p-3">
          {legs.length > 0 ? (
            <Card title="Portfolio Greeks">
              <GreeksDisplay greeks={portfolioGreeks} />
            </Card>
          ) : (
            <div className="text-center py-10" style={{ color: "#445566" }}>
              <div className="text-3xl mb-2">🧮</div>
              <div className="text-sm">Legs add karke Greeks dekhein</div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
