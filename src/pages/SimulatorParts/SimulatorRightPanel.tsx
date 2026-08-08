import { LineChart as LineChartIcon } from "lucide-react";
import type { Theme } from "../../styles/theme";
import type { OptionLeg } from "../../simulator/models/Option";
import type { PortfolioGreeks } from "../../simulator/models/Greeks";
import Card from "../../components/ui/Card";
import PayoffChart from "../../simulator/components/PayoffChart";
import AnalyticsCards from "../../simulator/components/AnalyticsCards";
import TabbedBottomPanel from "../../simulator/components/TabbedBottomPanel";

interface Props {
  theme: Theme;
  payoff: any;
  activeLegs: OptionLeg[];
  legs: OptionLeg[];
  effectiveSpot: number;
  showPerLeg: boolean;
  setShowPerLeg: (v: boolean | ((v: boolean) => boolean)) => void;
  margin: any;
  portfolioGreeks: PortfolioGreeks;
  pop: any;
  scenarioMatrix: any;
  adjustments: any[];
  worstLevel: "safe" | "watch" | "danger";
  handleRollStrike: (leg: OptionLeg) => void;
  removeLeg: (id: string) => void;
  tradeLog: { t: number; text: string }[];
  livePnL: number | null;
  isReplaying: boolean;
}

function fmt(n: number): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default function SimulatorRightPanel({
  theme, payoff, activeLegs, legs, effectiveSpot, showPerLeg, setShowPerLeg,
  margin, portfolioGreeks, pop, scenarioMatrix, adjustments, worstLevel,
  handleRollStrike, removeLeg, tradeLog, livePnL, isReplaying,
}: Props) {
  return (
    <div className="space-y-3">
      {/* Live Payoff Chart — refreshes automatically, no Calculate needed */}
      <Card title="Live Payoff" extra={
        <div className="flex items-center gap-2">
          {/* Real-time replay P&L — only shows once a Walk Forward snapshot
              is loaded and at least one leg has live archived data; updates
              automatically as the replay Date/Time changes or Auto Play
              advances, since it's driven by liveOverrides in the calc hook. */}
          {isReplaying && livePnL != null && (
            <span className="text-sm px-2 py-0.5 rounded font-bold flex items-center gap-1"
              title="Real-time P&L at current replay position"
              style={{
                background: (livePnL >= 0 ? theme.accent.green : theme.accent.red) + "15",
                color: livePnL >= 0 ? theme.accent.green : theme.accent.red,
              }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: livePnL >= 0 ? theme.accent.green : theme.accent.red }} />
              Live: {livePnL >= 0 ? "+" : ""}₹{fmt(livePnL)}
            </span>
          )}
          <LineChartIcon size={13} color={theme.text.muted} />
          <button onClick={() => setShowPerLeg(v => !v)}
            className="text-sm px-2 py-0.5 rounded"
            style={{ color: showPerLeg ? theme.accent.cyan : theme.text.muted, background: theme.border.subtle }}>
            Per Leg
          </button>
        </div>
      }>
        {payoff && activeLegs.length > 0 ? (
          <div style={{ height: 380 }}>
            <PayoffChart result={payoff} spot={effectiveSpot} showPerLeg={showPerLeg} />
          </div>
        ) : (
          <div className="text-center py-16" style={{ color: theme.text.muted }}>
            <div className="text-sm">
              {legs.length > 0 ? "All legs are unticked in Position Book — tick at least one to see the payoff" : "Add legs to see the live payoff chart"}
            </div>
          </div>
        )}
      </Card>

      {/* Compact analytics cards */}
      <Card title="Analytics">
        <AnalyticsCards payoff={payoff} margin={margin} greeks={portfolioGreeks} pop={pop} hasLegs={activeLegs.length > 0} />
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
        hasLegs={activeLegs.length > 0}
      />
    </div>
  );
}
