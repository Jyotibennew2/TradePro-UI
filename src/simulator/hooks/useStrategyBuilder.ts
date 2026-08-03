import { useSimulatorStore } from "../state/simulatorStore";
import { StrategyBuilder }   from "../services/strategyBuilder";
import type { StrategyType } from "../models/Strategy";

export function useStrategyBuilder() {
  const { underlying, spot, iv, daysToExpiry, riskFreeRate, setLegs, clearLegs } = useSimulatorStore();
  const effectiveSpot = spot || 24300;

  const buildStrategy = (key: string) => {
    if (key === "CUSTOM") { clearLegs(); return; }
    try {
      const legs = StrategyBuilder.build(key as StrategyType, underlying, effectiveSpot, daysToExpiry, iv, riskFreeRate, 1);
      if (legs.length > 0) setLegs(legs);
    } catch(e) {
      console.error("Strategy build failed:", e);
    }
  };

  return { buildStrategy };
}
