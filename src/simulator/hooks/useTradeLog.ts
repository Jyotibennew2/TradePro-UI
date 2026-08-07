import { useState, useRef, useEffect } from "react";
import { placePaperOrder } from "../../utils/api";
import type { OptionLeg } from "../models/Option";

/**
 * Session-only trade activity log (tracks legs added/removed) + paper
 * trade placement, moved as-is from Simulator.tsx.
 */
export function useTradeLog(legs: OptionLeg[], flashToast: (msg: string) => void) {
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

  return { tradeLog, handlePaperTrade };
}
