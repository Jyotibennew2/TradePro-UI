/**
 * TradePro Simulator - Leg Row Component
 * Single option leg display with edit, duplicate, roll, delete.
 */
import type { OptionLeg } from "../models/Option";
import { LOT_SIZES }      from "../models/Option";
import { Copy, Trash2, GripVertical, ArrowUpDown } from "lucide-react";
import { useTheme } from "../../store/themeStore";

interface LegRowProps {
  leg       : OptionLeg;
  index     : number;
  onUpdate  : (id: string, patch: Partial<OptionLeg>) => void;
  onDuplicate: (leg: OptionLeg) => void;
  onDelete  : (id: string) => void;
  onDragStart: (index: number) => void;
  onDragOver : (index: number) => void;
  onDrop     : () => void;
  onRoll?    : (leg: OptionLeg) => void;
}

export default function LegRow({
  leg, index, onUpdate, onDuplicate, onDelete,
  onDragStart, onDragOver, onDrop, onRoll,
}: LegRowProps) {
  const theme = useTheme();
  const { contract, action, lots, entryPrice, iv } = leg;
  const isBuy    = action === "BUY";
  const isCE     = contract.optionType === "CE";
  const lotSize  = LOT_SIZES[contract.symbol];
  const qty      = lots * lotSize;
  const value    = entryPrice * qty;

  const actionColor = isBuy ? theme.accent.green : theme.accent.red;
  const typeColor   = isCE  ? theme.accent.cyan  : theme.accent.purple;

  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={e => { e.preventDefault(); onDragOver(index); }}
      onDrop={onDrop}
      className="rounded-xl p-3 mb-2"
      style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}` }}
    >
      {/* Row 1: drag + action + type + strike */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <GripVertical size={18} color={theme.text.faint} className="cursor-grab" />

        {/* Action toggle */}
        <button
          onClick={() => onUpdate(leg.id, { action: isBuy ? "SELL" : "BUY" })}
          className="px-3 py-1 rounded text-sm font-black"
          style={{ background: actionColor + "22", color: actionColor, border: `1px solid ${actionColor}44` }}
        >
          {action}
        </button>

        {/* Option type toggle */}
        <button
          onClick={() => onUpdate(leg.id, {
            contract: { ...contract, optionType: isCE ? "PE" : "CE" }
          })}
          className="px-3 py-1 rounded text-sm font-black"
          style={{ background: typeColor + "22", color: typeColor, border: `1px solid ${typeColor}44` }}
        >
          {contract.optionType}
        </button>

        {/* Strike */}
        <input
          type="number"
          value={contract.strike}
          onChange={e => onUpdate(leg.id, {
            contract: { ...contract, strike: Number(e.target.value) }
          })}
          className="w-24 px-2 py-1 rounded text-sm text-center outline-none font-bold"
          style={{ background: theme.bg.surface, border: `1px solid ${theme.border.strong}`, color: theme.text.primary }}
        />

        {/* Expiry type */}
        <button
          onClick={() => onUpdate(leg.id, {
            contract: { ...contract, expiryType: contract.expiryType === "WEEKLY" ? "MONTHLY" : "WEEKLY" }
          })}
          className="px-3 py-1 rounded text-sm font-bold"
          style={{ background: theme.border.subtle, color: theme.text.muted }}
        >
          {contract.expiryType === "WEEKLY" ? "W" : "M"}
        </button>

        {/* Actions */}
        <div className="flex gap-2 ml-auto">
          {onRoll && (
            <button onClick={() => onRoll(leg)}
              className="p-1.5 rounded" style={{ color: theme.accent.orange, background: theme.accent.orange + "15" }}>
              <ArrowUpDown size={18} />
            </button>
          )}
          <button onClick={() => onDuplicate(leg)}
            className="p-1.5 rounded" style={{ color: theme.text.muted, background: theme.border.subtle }}>
            <Copy size={18} />
          </button>
          <button onClick={() => onDelete(leg.id)}
            className="p-1.5 rounded" style={{ color: theme.accent.red, background: theme.accent.red + "15" }}>
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Row 2: lots + premium + iv + value */}
      <div className="grid grid-cols-4 gap-2">
        {/* Lots */}
        <div>
          <div className="text-sm mb-1 font-semibold" style={{ color: theme.text.muted }}>Lots</div>
          <input
            type="number" min={1} value={lots}
            onChange={e => onUpdate(leg.id, { lots: Math.max(1, Number(e.target.value)) })}
            className="w-full px-2 py-1 rounded text-sm text-center outline-none font-bold"
            style={{ background: theme.bg.surface, border: `1px solid ${theme.border.strong}`, color: theme.text.primary }}
          />
        </div>

        {/* Premium */}
        <div>
          <div className="text-sm mb-1 font-semibold" style={{ color: theme.text.muted }}>Premium</div>
          <input
            type="number" min={0.05} step={0.05} value={entryPrice}
            onChange={e => onUpdate(leg.id, { entryPrice: Number(e.target.value) })}
            className="w-full px-2 py-1 rounded text-sm text-center outline-none font-bold"
            style={{ background: theme.bg.surface, border: `1px solid ${theme.border.strong}`, color: theme.accent.cyan }}
          />
        </div>

        {/* IV */}
        <div>
          <div className="text-sm mb-1 font-semibold" style={{ color: theme.text.muted }}>IV %</div>
          <input
            type="number" min={1} max={200} step={0.5} value={iv}
            onChange={e => onUpdate(leg.id, { iv: Number(e.target.value) })}
            className="w-full px-2 py-1 rounded text-sm text-center outline-none font-bold"
            style={{ background: theme.bg.surface, border: `1px solid ${theme.border.strong}`, color: theme.accent.purple }}
          />
        </div>

        {/* Value */}
        <div>
          <div className="text-sm mb-1 font-semibold" style={{ color: theme.text.muted }}>Value</div>
          <div className="text-sm text-center py-1 font-bold rounded"
            style={{ color: isBuy ? theme.accent.red : theme.accent.green, background: theme.bg.surface, border: `1px solid ${theme.border.strong}` }}>
            {isBuy ? "-" : "+"}₹{Math.round(value).toLocaleString("en-IN")}
          </div>
        </div>
      </div>

      {/* Row 3: qty info */}
      <div className="mt-2 text-sm" style={{ color: theme.text.faint }}>
        {lots} lot{lots > 1 ? "s" : ""} × {lotSize} = {qty} qty
        &nbsp;•&nbsp;
        {contract.symbol} {contract.strike} {contract.optionType}
      </div>
    </div>
  );
}
