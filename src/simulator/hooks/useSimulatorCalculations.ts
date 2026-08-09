import { useState, useCallback, useEffect, useMemo } from "react";
import { calculatePayoff } from "../pricing/PayoffEngine";
import { calculatePortfolioMargin } from "../pricing/MarginEngine";
import { buildScenarioMatrix } from "../pricing/PayoffEngine";
import { bsGreeks } from "../pricing/BlackScholes";
import { spotRange, daysToYears } from "../pricing/BlackScholes";
import { probabilityOfProfit } from "../pricing/ProbabilityEngine";
import { STRIKE_STEPS } from "../models/Option";
import type { PortfolioGreeks } from "../models/Greeks";
import type { OptionLeg } from "../models/Option";

/**
 * All derived-calculation state that was previously inline in Simulator.tsx:
 * live spot/IV sync with the historical chain replay, payoff, portfolio
 * greeks, margin, scenario matrix, POP, and the SL-danger "adjustments"
 * list. Every formula, dependency array, and memoization below is copied
 * exactly as it was — this hook only moves the code, it does not change
 * when anything recalculates.
 */
export function useSimulatorCalculations(params: {
  underlying   : "NIFTY" | "BANKNIFTY" | "MIDCPNIFTY";
  spot         : number;
  iv           : number;
  daysToExpiry : number;
  riskFreeRate : number;
  legs         : OptionLeg[];
  manualSpot   : number;
  excludedLegIds: Set<string>;
  chain        : any;
  setPayoff        : (p: any) => void;
  setIsCalculating : (v: boolean) => void;
}) {
  const {
    underlying, spot, iv, daysToExpiry, riskFreeRate, legs,
    manualSpot, excludedLegIds, chain, setPayoff, setIsCalculating,
  } = params;

  // Legs with their Position Book checkbox ticked — only these feed the
  // Strategy/Payoff/Greeks calculations below. An unticked leg stays
  // visible everywhere else, it just stops counting here. Memoized so this
  // array only gets a new identity when legs or the ticked-state actually
  // change — without this, calculate()'s effect below would re-fire every
  // render and loop forever.
  const activeLegs = useMemo(
    () => legs.filter(l => !excludedLegIds.has(l.id)),
    [legs, excludedLegIds]
  );

  // Live spot: while the Historical Option Chain has a snapshot loaded for
  // this same underlying, every replay step drives the spot used in all
  // calculations below instead of the manual Spot Price field — this is
  // the "synchronize with replay" behavior. If the chain is on a different
  // symbol, or nothing is loaded yet, the manual/live-market spot is used
  // exactly as before.
  const liveSpot = (chain.chainMeta && chain.symbol === underlying) ? chain.chainMeta.spot : null;
  const effectiveSpot = liveSpot ?? manualSpot;

  // Live per-leg LTP + IV from the real archived snapshot at the current
  // replay position — for legs whose own expiry matches the expiry
  // currently browsed in the Historical Option Chain (that's the only
  // expiry whose data is loaded client-side at any moment), OR for legs
  // that don't have an expiry set at all yet — those are treated as
  // belonging to the currently-selected chain expiry by default, so a
  // freshly-added leg (or a leg added before any option chain was loaded)
  // still gets real prices/Greeks from the moment a chain is loaded,
  // instead of silently sitting on a Black-Scholes estimate forever.
  const liveOverrides = useMemo(() => {
    const map: Record<string, { ltp: number; iv: number }> = {};
    if (chain.chainData && chain.expiry) {
      for (const l of legs) {
        if (l.contract.symbol !== chain.symbol) continue;
        if (l.contract.expiry && l.contract.expiry !== chain.expiry) continue;
        const row = chain.chainData.find((r: any) => r.strike === l.contract.strike);
        if (!row) continue;
        const ltp = l.contract.optionType === "CE" ? row.ce_ltp : row.pe_ltp;
        const ivF = l.contract.optionType === "CE" ? row.ce_iv : row.pe_iv;
        if (ltp != null) map[l.id] = { ltp, iv: ivF ?? l.iv };
      }
    }
    return map;
  }, [legs, chain.chainData, chain.expiry, chain.symbol]);

  // The leg set actually fed into Payoff/Margin/Greeks/Scenario/POP/
  // Adjustments below, and into Position Book's display: activeLegs
  // (ticked in Position Book) with IV replaced by the live archived IV
  // where available, AND with a blank contract.expiry filled in from the
  // Option Chain panel's currently-selected expiry — a leg's expiry
  // should never render blank once a chain is loaded. entryPrice (cost
  // basis) is never touched — only the live mark inputs and the expiry
  // label are synced.
  const syncedActiveLegs = useMemo(
    () => activeLegs.map(l => {
      const ov = liveOverrides[l.id];
      const needsExpiry = !l.contract.expiry && chain.expiry && l.contract.symbol === chain.symbol;
      if (!ov && !needsExpiry) return l;
      return {
        ...l,
        ...(ov ? { iv: ov.iv } : {}),
        contract: needsExpiry ? { ...l.contract, expiry: chain.expiry } : l.contract,
      };
    }),
    [activeLegs, liveOverrides, chain.expiry, chain.symbol]
  );

  const T = daysToYears(daysToExpiry);
  const r = riskFreeRate / 100;
  const sigmaBase = iv / 100;

  // ─── Live replay P&L ──────────────────────────────────────────────────────
  // Real-time mark-to-market P&L, same calculation Position Book already
  // uses for its "Strategy P&L" total: for each active leg, mark-to-market
  // price is the live archived LTP when available (liveOverrides), else a
  // Black-Scholes estimate at the current effectiveSpot — so this stays in
  // sync with Walk Forward/Auto Play even before a specific chain snapshot
  // has been loaded, exactly like Position Book's total does. Depends on
  // effectiveSpot (which itself follows chain.chainMeta.spot during replay)
  // so it recalculates on every simulated Date/Time step.
  const livePnL = useMemo(() => {
    if (!syncedActiveLegs.length) return null;
    return syncedActiveLegs.reduce((total, l) => {
      const ov = liveOverrides[l.id];
      const ltp = ov?.ltp ?? bsGreeks({
        spot: effectiveSpot, strike: l.contract.strike, timeToExpiry: T,
        riskFreeRate: r, volatility: (ov?.iv ?? l.iv) / 100, optionType: l.contract.optionType,
      }).price;
      const sign = l.action === "BUY" ? 1 : -1;
      const qty = l.lots * l.contract.lotSize;
      // Include any already-realized P&L from partial exits taken on this
      // leg (Position Book's Exit Qty control), so the header badge always
      // matches Position Book's "Strategy P&L" total exactly.
      const unrealized = sign * (ltp - l.entryPrice) * qty;
      return total + unrealized + (l.realizedPnl ?? 0);
    }, 0);
  }, [syncedActiveLegs, liveOverrides, effectiveSpot, T, r]);

  // ─── Calculate ────────────────────────────────────────────────────────────────────────────────
  const calculate = useCallback(() => {
    if (!syncedActiveLegs.length) { setPayoff(null); return; }
    setIsCalculating(true);
    try {
      const spots = spotRange(effectiveSpot, 0.10, 80);
      const result = calculatePayoff({
        legs: syncedActiveLegs,
        spotRange: { min: spots[0], max: spots[spots.length - 1], steps: 80 },
        daysToExpiry: 0,
        riskFreeRate: r,
        useBS: true,
      });
      setPayoff(result);
    } finally {
      setIsCalculating(false);
    }
  }, [syncedActiveLegs, effectiveSpot, daysToExpiry, r]);

  // Auto-calculate payoff when legs (or their ticked/live-synced state) change
  useEffect(() => {
    calculate();
  }, [syncedActiveLegs, calculate]);

  // ─── Portfolio Greeks ──────────────────────────────────────────────────────────────
  const portfolioGreeks: PortfolioGreeks = syncedActiveLegs.reduce(
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
  const margin = syncedActiveLegs.length ? calculatePortfolioMargin(syncedActiveLegs, effectiveSpot) : null;

  // ─── Scenario matrix ────────────────────────────────────────────────────────────────
  const scenarioMatrix = syncedActiveLegs.length ? buildScenarioMatrix(syncedActiveLegs, effectiveSpot, iv, daysToExpiry, r) : null;

  // ─── Probability of Profit ──────────────────────────────────────────────────────────
  const pop = syncedActiveLegs.length ? probabilityOfProfit(syncedActiveLegs, effectiveSpot, iv, daysToExpiry, r) : null;

  // ─── Adjustments ─────────────────────────────────────────────────────────────────────────────
  type ThreatLevel = "safe" | "watch" | "danger";
  const BUFFER_WATCH = 0.03;
  const BUFFER_DANGER = 0.01;

  const adjustments = syncedActiveLegs
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

  const handleRollStrike = (leg: OptionLeg, updateLeg: (id: string, patch: Partial<OptionLeg>) => void) => {
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

  return {
    activeLegs, liveOverrides, syncedActiveLegs, effectiveSpot,
    T, r, sigmaBase, calculate, livePnL,
    portfolioGreeks, margin, scenarioMatrix, pop,
    adjustments, worstLevel, handleRollStrike,
  };
}
