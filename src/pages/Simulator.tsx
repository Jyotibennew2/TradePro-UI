/**
 * TradePro - Options Simulator Page
 *
 * Refactored (structure only) from a single ~700-line file into:
 *   - simulator/hooks/useSimulatorCalculations  (payoff/greeks/margin/scenario/POP/adjustments/livePnL)
 *   - simulator/hooks/useSimulatorPersistence    (save/load/export/import)
 *   - simulator/hooks/useSimulatorLegActions     (templates/add-leg/drag-reorder/duplicate/expiry-change)
 *   - simulator/hooks/useTradeLog                (session activity log + paper trade)
 *   - pages/SimulatorParts/*                     (header, strategy builder panel, right panel, bottom bar)
 *
 * Every formula, dependency array, and JSX element below is the exact
 * same logic that was already in the single-file version — nothing was
 * changed, only moved. See each hook/part file for the corresponding
 * original section.
 *
 * ── Enhancement pass (Historical Context + Snapshot Tools) ────────────────
 * Added to the header strip (inside SimulatorHeader), next to the Strategy
 * name field: BookmarkControl (⭐ save/recall specific date+time+expiry
 * snapshots) and CompareToggle (side-by-side two-snapshot mode).
 * Added directly under the header, above the Replay Control Bar:
 * ResumeSessionBanner (one-time "resumed last session" toast).
 * Added directly under the Walk-Forward Bar, above the main workspace:
 * HistoricalContextBar (Date|Time|DTE|Market Status|VIX|IV|PCR|Spot|
 * Futures|Gap%|Bias score strip). None of the pre-existing layout,
 * calculation logic, or workflows were changed — this is additive UI only.
 *
 * ── Manual Exit / exit-history pass ─────────────────────────────────────
 * onExit passed to Position Book is now a small wrapper: it still calls
 * the store's removeLeg for a leg that's already CLOSED (a full manual
 * exit already recorded, user is choosing to remove it from the list),
 * but also clears that leg's persisted exit history via
 * exitHistoryStorage.clearForLeg — otherwise old ExitRecords would be
 * orphaned in localStorage under a legId nothing references anymore.
 * Partial/full exits themselves go through Position Book's own call to
 * the store's exitLeg action (unchanged here).
 */

import { useState, useRef, useEffect } from "react";
import { useAppStore } from "../store";
import { useTheme } from "../store/themeStore";
import { useSimulatorStore } from "../simulator/state/simulatorStore";
import { STRIKE_STEPS } from "../simulator/models/Option";
import { fmtDateLabel } from "../simulator/hooks/useHistoricalChain";
import { exitHistoryStorage } from "../simulator/services/exitHistoryStorage";

import { useHistoricalChain } from "../simulator/hooks/useHistoricalChain";
import ReplayControlBar from "../simulator/components/ReplayControlBar";
import WalkForwardBar from "../simulator/components/WalkForwardBar";
import OptionChainPanel from "../simulator/components/OptionChainPanel";
import PositionBook from "../simulator/components/PositionBook";
import HistoricalContextBar from "../simulator/components/HistoricalContextBar";
import { ResumeSessionBanner } from "../simulator/components/SnapshotTools";

import { useSimulatorCalculations } from "../simulator/hooks/useSimulatorCalculations";
import { useSimulatorPersistence } from "../simulator/hooks/useSimulatorPersistence";
import { useSimulatorLegActions } from "../simulator/hooks/useSimulatorLegActions";
import { useTradeLog } from "../simulator/hooks/useTradeLog";

import SimulatorHeader from "./SimulatorParts/SimulatorHeader";
import StrategyBuilderPanel from "./SimulatorParts/StrategyBuilderPanel";
import SimulatorRightPanel from "./SimulatorParts/SimulatorRightPanel";
import SimulatorBottomBar from "./SimulatorParts/SimulatorBottomBar";

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

  const [excludedLegIds, setExcludedLegIds] = useState<Set<string>>(new Set());
  const toggleLegActive = (id: string) => setExcludedLegIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const [showPerLeg, setShowPerLeg] = useState(false);
  const [toast, setToast] = useState("");
  const bornAt = useRef(new Date()).current;

  const manualSpot = spot || (underlying === "NIFTY" ? nifty : bankNifty) || 24300;

  // ─── Historical chain + walk-forward (shared across replay/WF bars + panel) ─
  const chain = useHistoricalChain();

  const flashToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  // ─── Calculations (payoff, greeks, margin, scenario, POP, adjustments, livePnL) ──
  const calc = useSimulatorCalculations({
    underlying, spot: manualSpot, iv, daysToExpiry, riskFreeRate, legs,
    manualSpot, excludedLegIds, chain, setPayoff, setIsCalculating,
  });
  const {
    activeLegs, syncedActiveLegs, effectiveSpot, T, r,
    portfolioGreeks, margin, scenarioMatrix, pop,
    adjustments, worstLevel, calculate,
  } = calc;

  const handleRollStrike = (leg: any) => calc.handleRollStrike(leg, updateLeg);

  // Removing a leg from Position Book's list: if it's already CLOSED (a
  // full manual exit already happened and was recorded), also clear its
  // persisted exit history so old ExitRecords don't linger in
  // localStorage under a legId nothing references anymore. For a leg
  // that's still OPEN (never exited), this is just the pre-existing
  // "discard this leg" behavior — no history exists to clear.
  const handleRemoveLeg = (id: string) => {
    exitHistoryStorage.clearForLeg(id);
    removeLeg(id);
  };

  // stratName is shared between leg-actions (a template sets it) and
  // persistence (save/load/export read+write it) — same as the original
  // single-file version, where both lived in the same component scope.
  const [stratName, setStratName] = useState("My Strategy");

  // ─── Leg actions (templates, add, drag-reorder, duplicate, expiry change) ──
  const legActions = useSimulatorLegActions({
    underlying, effectiveSpot, daysToExpiry, iv, riskFreeRate,
    T, r, sigmaBase: iv / 100, legs, addLeg, updateLeg, clearLegs, chain,
    setStratName,
  });

  // Backfill any leg whose contract.expiry is still blank (e.g. legs added
  // before an Option Chain expiry was ever selected) with the Option
  // Chain's currently-selected expiry, as soon as one becomes available —
  // so Position Book's Expiry column, and every downstream Greeks/P&L
  // calculation that reads leg.contract.expiry directly, never sees a
  // blank value once a chain expiry exists. Only touches legs that are
  // actually blank and match the chain's symbol; never overwrites a leg
  // whose expiry was deliberately set (manually or via handleChangeLegExpiry).
  useEffect(() => {
    if (!chain.expiry) return;
    legs.forEach(l => {
      if (!l.contract.expiry && l.contract.symbol === chain.symbol) {
        updateLeg(l.id, { contract: { ...l.contract, expiry: chain.expiry } });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain.expiry, chain.symbol, legs]);

  // ─── Persistence (save/load/export/import) ──────────────────────────────
  const persistence = useSimulatorPersistence({
    template: legActions.template, underlying, effectiveSpot, legs,
    margin, payoff, portfolioGreeks, clearLegs, addLeg,
    stratName, setStratName,
  });

  // ─── Trade log + paper trade ─────────────────────────────────────────────
  const { tradeLog, handlePaperTrade } = useTradeLog(legs, flashToast);

  // Strike list for Position Book's searchable Instrument dropdown
  const instrumentStrikes = (() => {
    const step = STRIKE_STEPS[underlying];
    const atm = Math.round(effectiveSpot / step) * step;
    return Array.from({ length: 41 }, (_, i) => ({ strike: atm + (i - 20) * step }));
  })();

  return (
    <div className="flex flex-col h-full" style={{ background: theme.bg.page }}>
      {/* ══════════ FIXED HEADER ══════════ */}
      <SimulatorHeader
        theme={theme}
        stratName={stratName} setStratName={setStratName}
        bornAt={bornAt} deployLabel={persistence.deployLabel}
        handleSave={persistence.handleSave}
        loadOpen={persistence.loadOpen} setLoadOpen={persistence.setLoadOpen}
        handleExport={persistence.handleExport} flashToast={flashToast}
        savedList={persistence.savedList} setSavedList={persistence.setSavedList}
        handleLoad={persistence.handleLoad} handleImport={persistence.handleImport}
        chain={chain}
      />

      {/* One-time "resumed last session" toast — separate from the
          existing toast/saveMsg strips below so it never gets clobbered
          by an unrelated Save/AI-Suggest message firing at the same time. */}
      <ResumeSessionBanner chain={chain} />

      {toast && (
        <div className="text-sm text-center py-1" style={{ background: theme.accent.cyan + "10", color: theme.accent.cyan }}>{toast}</div>
      )}
      {persistence.saveMsg && (
        <div className="text-sm text-center py-1" style={{ background: theme.accent.green + "10", color: theme.accent.green }}>{persistence.saveMsg}</div>
      )}

      {/* ══════════ REPLAY CONTROL BAR ══════════ */}
      <ReplayControlBar chain={chain} />

      {/* ══════════ WALK FORWARD BAR ══════════ */}
      <WalkForwardBar chain={chain} />

      {/* ══════════ HISTORICAL CONTEXT BAR ══════════
          Date | Time | DTE | Market Status | VIX | ATM IV | PCR | Spot |
          Futures | Gap% | Bias score — all derived from the same `chain`
          state already driving Replay/Walk-Forward/Option Chain above, so
          it always reflects exactly the snapshot currently being viewed. */}
      <HistoricalContextBar chain={chain} />

      {/* ══════════ MAIN WORKSPACE ══════════ */}
      <div className="flex-1 overflow-y-auto p-3 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-[35%_65%] gap-3 items-start">

          {/* ───────── LEFT PANEL (35%) ───────── */}
          <div className="space-y-3">
            {/* Section A: Option Chain */}
            <OptionChainPanel chain={chain} />

            {/* Section B: Strategy Builder */}
            <StrategyBuilderPanel
              theme={theme}
              underlying={underlying} setUnderlying={setUnderlying} clearLegs={clearLegs}
              spot={spot} effectiveSpot={effectiveSpot} setSpot={setSpot}
              iv={iv} setIV={setIV}
              daysToExpiry={daysToExpiry} setDaysToExpiry={setDaysToExpiry}
              riskFreeRate={riskFreeRate} setRiskFreeRate={store.setRiskFreeRate}
              template={legActions.template} handleTemplate={legActions.handleTemplate}
              addCustomLeg={legActions.addCustomLeg}
              legs={legs} updateLeg={updateLeg}
              handleDuplicate={legActions.handleDuplicate} removeLeg={handleRemoveLeg}
              setDragFrom={legActions.setDragFrom} setDragOver={legActions.setDragOver}
              handleDrop={legActions.handleDrop}
              handleRollStrike={handleRollStrike}
              calculate={calculate}
            />
          </div>

          {/* ───────── RIGHT PANEL (65%) ───────── */}
          <SimulatorRightPanel
            theme={theme} payoff={payoff} activeLegs={activeLegs} legs={legs}
            effectiveSpot={effectiveSpot} showPerLeg={showPerLeg} setShowPerLeg={setShowPerLeg}
            margin={margin} portfolioGreeks={portfolioGreeks} pop={pop}
            scenarioMatrix={scenarioMatrix} adjustments={adjustments} worstLevel={worstLevel}
            handleRollStrike={handleRollStrike} removeLeg={handleRemoveLeg} tradeLog={tradeLog}
            livePnL={calc.livePnL} isReplaying={chain.hasData && !!chain.chainMeta}
          />
        </div>
      </div>

      {/* ══════════ FIXED BOTTOM ACTION BAR ══════════ */}
      <SimulatorBottomBar
        theme={theme} calculate={calculate} handleSave={persistence.handleSave}
        setLoadOpen={persistence.setLoadOpen} handleExport={persistence.handleExport}
        flashToast={flashToast} runWalkForward={chain.runWalkForward}
        handlePaperTrade={handlePaperTrade}
      />

      {/* Floating Position Book */}
      <PositionBook
        legs={legs}
        excludedIds={excludedLegIds}
        onToggleActive={toggleLegActive}
        instrumentOptions={instrumentStrikes}
        liveOverrides={calc.liveOverrides}
        expiryOptions={chain.expiries}
        expiryLabel={fmtDateLabel}
        onChangeLegExpiry={legActions.handleChangeLegExpiry}
        spot={effectiveSpot}
        T={T}
        riskFreeRate={r}
        onExit={handleRemoveLeg}
        onUpdate={updateLeg}
        onAddLeg={legActions.addCustomLeg}
      />
    </div>
  );
}
