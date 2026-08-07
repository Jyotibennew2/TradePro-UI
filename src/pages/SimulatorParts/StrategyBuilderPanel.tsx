import { Plus, RefreshCw } from "lucide-react";
import type { Theme } from "../../styles/theme";
import type { OptionLeg } from "../../simulator/models/Option";
import Card from "../../components/ui/Card";
import StrategyTemplates from "../../simulator/components/StrategyTemplates";
import LegRow from "../../simulator/components/LegRow";

interface Props {
  theme: Theme;
  underlying: "NIFTY" | "BANKNIFTY" | "MIDCPNIFTY";
  setUnderlying: (u: "NIFTY" | "BANKNIFTY" | "MIDCPNIFTY") => void;
  clearLegs: () => void;
  spot: number;
  effectiveSpot: number;
  setSpot: (n: number) => void;
  iv: number;
  setIV: (n: number) => void;
  daysToExpiry: number;
  setDaysToExpiry: (n: number) => void;
  riskFreeRate: number;
  setRiskFreeRate: (n: number) => void;
  template: string;
  handleTemplate: (key: string) => void;
  addCustomLeg: (optType: "CE" | "PE", action: "BUY" | "SELL") => void;
  legs: OptionLeg[];
  updateLeg: (id: string, patch: Partial<OptionLeg>) => void;
  handleDuplicate: (leg: OptionLeg) => void;
  removeLeg: (id: string) => void;
  setDragFrom: (i: number | null) => void;
  setDragOver: (i: number | null) => void;
  handleDrop: () => void;
  handleRollStrike: (leg: OptionLeg) => void;
  calculate: () => void;
}

export default function StrategyBuilderPanel({
  theme, underlying, setUnderlying, clearLegs, spot, effectiveSpot, setSpot,
  iv, setIV, daysToExpiry, setDaysToExpiry, riskFreeRate, setRiskFreeRate,
  template, handleTemplate, addCustomLeg, legs, updateLeg, handleDuplicate,
  removeLeg, setDragFrom, setDragOver, handleDrop, handleRollStrike, calculate,
}: Props) {
  return (
    <Card title="Strategy Builder">
      <div className="space-y-3">
        <div>
          <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Underlying</div>
          <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${theme.border.subtle}` }}>
            {(["NIFTY", "BANKNIFTY", "MIDCPNIFTY"] as const).map(u => (
              <button key={u} onClick={() => { setUnderlying(u); clearLegs(); }}
                className="flex-1 py-1.5 text-sm font-bold"
                style={{ background: underlying === u ? theme.accent.cyan : theme.bg.surfaceAlt, color: underlying === u ? theme.bg.page : theme.text.muted }}>
                {u === "MIDCPNIFTY" ? "MIDCP" : u}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Spot Price", value: spot || effectiveSpot, setter: (v: string) => setSpot(Number(v)), color: theme.accent.cyan },
            { label: "IV %", value: iv, setter: (v: string) => setIV(Number(v)), color: theme.accent.purple },
            { label: "Days to Expiry", value: daysToExpiry, setter: (v: string) => setDaysToExpiry(Number(v)), color: theme.accent.orange },
            { label: "Risk Free Rate %", value: riskFreeRate, setter: (v: string) => setRiskFreeRate(Number(v)), color: theme.text.muted },
          ].map(({ label, value, setter, color }) => (
            <div key={label}>
              <div className="text-sm mb-1" style={{ color: theme.text.muted }}>{label}</div>
              <input type="number" value={value} onChange={e => setter(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg text-sm outline-none text-center"
                style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color }} />
            </div>
          ))}
        </div>

        <div>
          <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Templates</div>
          <StrategyTemplates onSelect={handleTemplate} selected={template} />
        </div>

        <div>
          <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Add Legs</div>
          <div className="grid grid-cols-2 gap-2">
            {([["CE", "BUY", theme.accent.green], ["CE", "SELL", theme.accent.red], ["PE", "BUY", theme.accent.cyan], ["PE", "SELL", theme.accent.purple]] as const).map(
              ([type, action, color]) => (
                <button key={`${action}-${type}`} onClick={() => addCustomLeg(type, action)}
                  className="py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1"
                  style={{ background: color + "15", color, border: `1px solid ${color}30` }}>
                  <Plus size={14} /> {action} {type}
                </button>
              )
            )}
          </div>
        </div>

        {legs.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-bold" style={{ color: theme.text.muted }}>Legs ({legs.length})</div>
              <div className="flex gap-2">
                <button onClick={clearLegs} className="text-sm px-2 py-0.5 rounded" style={{ color: theme.accent.red, background: theme.accent.red + "15" }}>Clear</button>
                <button onClick={calculate} className="text-sm px-2 py-0.5 rounded flex items-center gap-1" style={{ color: theme.accent.cyan, background: theme.accent.cyan + "15" }}>
                  <RefreshCw size={13} /> Recalc
                </button>
              </div>
            </div>
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
                onRoll={handleRollStrike}
              />
            ))}
          </div>
        )}

        {!legs.length && (
          <div className="text-center py-8" style={{ color: theme.text.muted }}>
            <div className="text-sm">Select a template or add legs manually</div>
          </div>
        )}
      </div>
    </Card>
  );
}
