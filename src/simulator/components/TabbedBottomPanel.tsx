/**
 * TradePro Simulator - Tabbed Bottom Panel
 * Greeks / Scenario / Position Health / Adjustments / Trade Log.
 * Only one tab visible at a time. Reuses the existing GreeksDisplay and
 * ScenarioMatrixDisplay components and the existing adjustment-detection
 * logic computed in Simulator.tsx — this file only lays it out.
 */
import { useState } from "react";
import { ArrowUpDown, X } from "lucide-react";
import { useTheme } from "../../store/themeStore";
import GreeksDisplay from "./GreeksDisplay";
import ScenarioMatrixDisplay from "./ScenarioMatrix";
import type { OptionLeg } from "../models/Option";

type Tab = "greeks" | "scenario" | "health" | "adjust" | "log";

interface Adjustment { leg: OptionLeg; distPct: number; level: "safe" | "watch" | "danger"; }
interface LogEntry { t: number; text: string; }

interface Props {
  greeks        : any;
  scenarioMatrix: any;
  adjustments   : Adjustment[];
  worstLevel    : "safe" | "watch" | "danger";
  onRoll        : (leg: OptionLeg) => void;
  onClose       : (id: string) => void;
  tradeLog      : LogEntry[];
  hasLegs       : boolean;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "greeks",   label: "Greeks" },
  { id: "scenario", label: "Scenario" },
  { id: "health",   label: "Position Health" },
  { id: "adjust",   label: "Adjustments" },
  { id: "log",      label: "Trade Log" },
];

export default function TabbedBottomPanel({
  greeks, scenarioMatrix, adjustments, worstLevel, onRoll, onClose, tradeLog, hasLegs,
}: Props) {
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>("greeks");

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}` }}>
      <div className="flex overflow-x-auto" style={{ borderBottom: `1px solid ${theme.border.subtle}` }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-3 py-2 text-sm font-bold shrink-0 relative"
            style={{
              color: tab === t.id ? theme.accent.cyan : theme.text.muted,
              borderBottom: tab === t.id ? `2px solid ${theme.accent.cyan}` : "2px solid transparent",
            }}
          >
            {t.label}
            {t.id === "adjust" && worstLevel !== "safe" && (
              <span style={{
                position: "absolute", top: 4, right: 2, width: 6, height: 6, borderRadius: 99,
                background: worstLevel === "danger" ? theme.accent.red : theme.accent.orange,
              }} />
            )}
          </button>
        ))}
      </div>

      <div className="p-3">
        {!hasLegs && tab !== "log" ? (
          <div className="text-center py-6 text-sm" style={{ color: theme.text.muted }}>Add legs to see this panel</div>
        ) : (
          <>
            {tab === "greeks" && <GreeksDisplay greeks={greeks} />}

            {tab === "scenario" && (
              scenarioMatrix
                ? <ScenarioMatrixDisplay matrix={scenarioMatrix} />
                : <div className="text-center py-6 text-sm" style={{ color: theme.text.muted }}>No scenario data</div>
            )}

            {tab === "health" && (
              <div className="flex items-center gap-2 py-1">
                <span style={{
                  width: 10, height: 10, borderRadius: 99,
                  background: worstLevel === "danger" ? theme.accent.red : worstLevel === "watch" ? theme.accent.orange : theme.accent.green,
                }} />
                <span className="text-sm font-bold" style={{
                  color: worstLevel === "danger" ? theme.accent.red : worstLevel === "watch" ? theme.accent.orange : theme.accent.green,
                }}>
                  {worstLevel === "danger" ? "Action needed — a short strike is breached or nearly breached"
                    : worstLevel === "watch" ? "Watch closely — spot is approaching a short strike"
                    : "All short legs are safely OTM"}
                </span>
              </div>
            )}

            {tab === "adjust" && (
              adjustments.length === 0 ? (
                <div className="text-center py-6 text-sm" style={{ color: theme.text.muted }}>
                  No short legs to monitor — adjustment suggestions apply to SELL legs only
                </div>
              ) : (
                <div className="space-y-2">
                  {adjustments.map(({ leg, distPct, level }) => (
                    <div key={leg.id} className="rounded-lg p-2.5" style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}` }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-bold" style={{ color: theme.text.secondary }}>
                          {leg.action} {leg.contract.strike} {leg.contract.optionType}
                        </span>
                        <span className="text-sm px-2 py-0.5 rounded font-bold" style={{
                          background: level === "danger" ? theme.accent.red + "20" : level === "watch" ? theme.accent.orange + "20" : theme.accent.green + "20",
                          color: level === "danger" ? theme.accent.red : level === "watch" ? theme.accent.orange : theme.accent.green,
                        }}>
                          {level === "danger" ? "Danger" : level === "watch" ? "Watch" : "Safe"}
                        </span>
                      </div>
                      <div className="text-sm mb-2" style={{ color: theme.text.muted }}>
                        Spot is {distPct >= 0 ? `${distPct.toFixed(2)}% away from` : `${Math.abs(distPct).toFixed(2)}% past`} this strike.
                      </div>
                      {level !== "safe" && (
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => onRoll(leg)} className="py-1.5 rounded-lg text-sm font-bold flex items-center justify-center gap-1"
                            style={{ background: theme.accent.cyan + "20", color: theme.accent.cyan, border: `1px solid ${theme.accent.cyan}30` }}>
                            <ArrowUpDown size={13} /> Roll Strike
                          </button>
                          <button onClick={() => onClose(leg.id)} className="py-1.5 rounded-lg text-sm font-bold flex items-center justify-center gap-1"
                            style={{ background: theme.accent.red + "15", color: theme.accent.red, border: `1px solid ${theme.accent.red}30` }}>
                            <X size={13} /> Close Leg
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            {tab === "log" && (
              tradeLog.length === 0 ? (
                <div className="text-center py-6 text-sm" style={{ color: theme.text.muted }}>No activity yet this session</div>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {tradeLog.slice().reverse().map((e, i) => (
                    <div key={i} className="text-sm flex justify-between" style={{ color: theme.text.secondary }}>
                      <span>{e.text}</span>
                      <span style={{ color: theme.text.faint }}>
                        {new Date(e.t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                    </div>
                  ))}
                  <div className="text-sm pt-1" style={{ color: theme.text.faint, fontSize: 9 }}>
                    Session log only — not persisted or saved to the server.
                  </div>
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}
