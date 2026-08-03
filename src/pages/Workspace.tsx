/**
 * TradePro - Unified Workspace
 * Option Chain + Strategy Builder side by side, Payoff below, Greeks below that.
 * Quick-nav icon rail on the left jumps between sections.
 */

import { useCallback, useEffect, useRef } from "react";
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
import { useTheme } from "../store/themeStore";

export default function Workspace() {
  const theme = useTheme();
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

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
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

  useEffect(() => {
    if (legs.length > 0) {
      calculate();
    } else {
      setPayoff(null);
    }
  }, [legs, calculate]);

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
        style={{ borderColor: theme.border.subtle, background: theme.bg.surface }}>
        <button onClick={() => scrollTo(chainRef)} title="Option Chain + Builder"
          className="p-2.5 rounded-lg" style={{ background: theme.border.subtle, color: theme.accent.cyan }}>
          <LayoutGrid size={20} />
        </button>
        <button onClick={() => scrollTo(payoffRef)} title="Payoff"
          className="p-2.5 rounded-lg" style={{ background: theme.border.subtle, color: theme.accent.cyan }}>
          <BarChart2 size={20} />
        </button>
        <button onClick={() => scrollTo(greeksRef)} title="Greeks"
          className="p-2.5 rounded-lg" style={{ background: theme.border.subtle, color: theme.accent.cyan }}>
          <Activity size={20} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Section 1: Option Chain + Strategy Builder ── */}
        <div ref={chainRef} className="p-3 border-b" style={{ borderColor: theme.border.subtle }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

            <div className="min-w-0">
              <Card title="Option Chain">
                <div style={{ height: 420 }}>
                  <OptionChain onSelect={(strike, optType, action, ltp) => {
                    addLeg(makeOptionLeg(underlying, strike, optType, action, 1, ltp, iv, ""));
                  }} />
                </div>
              </Card>
            </div>

            <div className="min-w-0 space-y-3">
              <Card title="Add Legs">
                <div className="grid grid-cols-2 gap-2">
                  {(["CE","BUY",theme.accent.green],["CE","SELL",theme.accent.red],["PE","BUY",theme.accent.cyan],["PE","SELL",theme.accent.purple]] as const).map(
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

              {legs.length > 0 ? (
                <Card title={`Legs (${legs.length})`} extra={
                  <button onClick={calculate}
                    className="text-sm px-2 py-0.5 rounded flex items-center gap-1"
                    style={{ color: theme.accent.cyan, background: theme.accent.cyan + "15" }}>
                    <RefreshCw size={13} /> Recalculate
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
                <div className="text-center py-8" style={{ color: theme.text.muted }}>
                  <div className="text-2xl mb-1">📊</div>
                  <div className="text-sm">Chain se dekh kar ya buttons se legs add kariye</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Section 2: Payoff ── */}
        <div ref={payoffRef} className="p-3 border-b" style={{ borderColor: theme.border.subtle }}>
          {payoff ? (
            <Card title="Payoff Diagram">
              <PayoffChart result={payoff} spot={effectiveSpot} showPerLeg={false} />
            </Card>
          ) : (
            <div className="text-center py-10" style={{ color: theme.text.muted }}>
              <div className="text-3xl mb-2">📈</div>
              <div className="text-sm">Legs add kariye, graph apne aap ban jayega</div>
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
            <div className="text-center py-10" style={{ color: theme.text.muted }}>
              <div className="text-3xl mb-2">🧮</div>
              <div className="text-sm">Legs add karke Greeks dekhein</div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
