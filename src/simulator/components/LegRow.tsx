/**
 * TradePro Simulator - Leg Row Component
 * Single option leg display with edit, duplicate, delete.
 */

import type { OptionLeg } from "../models/Option";
import { LOT_SIZES }      from "../models/Option";
import { Copy, Trash2, GripVertical } from "lucide-react";

interface LegRowProps {
  leg       : OptionLeg;
  index     : number;
  onUpdate  : (id: string, patch: Partial<OptionLeg>) => void;
  onDuplicate: (leg: OptionLeg) => void;
  onDelete  : (id: string) => void;
  onDragStart: (index: number) => void;
  onDragOver : (index: number) => void;
  onDrop     : () => void;
}

export default function LegRow({
  leg, index, onUpdate, onDuplicate, onDelete,
  onDragStart, onDragOver, onDrop,
}: LegRowProps) {
  const { contract, action, lots, entryPrice, iv } = leg;
  const isBuy    = action === "BUY";
  const isCE     = contract.optionType === "CE";
  const lotSize  = LOT_SIZES[contract.symbol];
  const qty      = lots * lotSize;
  const value    = entryPrice * qty;

  const actionColor = isBuy ? "#00d97e" : "#f03060";
  const typeColor   = isCE  ? "#00c8f0" : "#9b5cf6";

  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={e => { e.preventDefault(); onDragOver(index); }}
      onDrop={onDrop}
      className="rounded-xl p-3 mb-2"
      style={{ background: "#090f1e", border: "1px solid #0f1e36" }}
    >
      {/* Row 1: drag + action + type + strike */}
      <div className="flex items-center gap-2 mb-2">
        <GripVertical size={14} color="#334455" className="cursor-grab" />

        {/* Action toggle */}
        <button
          onClick={() => onUpdate(leg.id, { action: isBuy ? "SELL" : "BUY" })}
          className="px-2 py-0.5 rounded text-xs font-black"
          style={{ background: actionColor + "22", color: actionColor, border: `1px solid ${actionColor}44` }}
        >
          {action}
        </button>

        {/* Option type toggle */}
        <button
          onClick={() => onUpdate(leg.id, {
            contract: { ...contract, optionType: isCE ? "PE" : "CE" }
          })}
          className="px-2 py-0.5 rounded text-xs font-black"
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
          className="w-20 px-2 py-0.5 rounded text-xs text-center outline-none"
          style={{ background: "#060c1a", border: "1px solid #0f1e36", color: "#c0d0e8" }}
        />

        {/* Expiry type */}
        <button
          onClick={() => onUpdate(leg.id, {
            contract: { ...contract, expiryType: contract.expiryType === "WEEKLY" ? "MONTHLY" : "WEEKLY" }
          })}
          className="px-2 py-0.5 rounded text-xs"
          style={{ background: "#0f1e36", color: "#445566" }}
        >
          {contract.expiryType === "WEEKLY" ? "W" : "M"}
        </button>

        {/* Actions */}
        <div className="flex gap-1 ml-auto">
          <button onClick={() => onDuplicate(leg)}
            className="p-1 rounded" style={{ color: "#445566" }}>
            <Copy size={12} />
          </button>
          <button onClick={() => onDelete(leg.id)}
            className="p-1 rounded" style={{ color: "#f03060" }}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Row 2: lots + premium + iv + value */}
      <div className="grid grid-cols-4 gap-2">
        {/* Lots */}
        <div>
          <div className="text-xs mb-0.5" style={{ color: "#334455" }}>Lots</div>
          <input
            type="number" min={1} value={lots}
            onChange={e => onUpdate(leg.id, { lots: Math.max(1, Number(e.target.value)) })}
            className="w-full px-2 py-0.5 rounded text-xs text-center outline-none"
            style={{ background: "#060c1a", border: "1px solid #0f1e36", color: "#c0d0e8" }}
          />
        </div>

        {/* Premium */}
        <div>
          <div className="text-xs mb-0.5" style={{ color: "#334455" }}>Premium</div>
          <input
            type="number" min={0.05} step={0.05} value={entryPrice}
            onChange={e => onUpdate(leg.id, { entryPrice: Number(e.target.value) })}
            className="w-full px-2 py-0.5 rounded text-xs text-center outline-none"
            style={{ background: "#060c1a", border: "1px solid #0f1e36", color: "#00c8f0" }}
          />
        </div>

        {/* IV */}
        <div>
          <div className="text-xs mb-0.5" style={{ color: "#334455" }}>IV %</div>
          <input
            type="number" min={1} max={200} step={0.5} value={iv}
            onChange={e => onUpdate(leg.id, { iv: Number(e.target.value) })}
            className="w-full px-2 py-0.5 rounded text-xs text-center outline-none"
            style={{ background: "#060c1a", border: "1px solid #0f1e36", color: "#9b5cf6" }}
          />
        </div>

        {/* Value */}
        <div>
          <div className="text-xs mb-0.5" style={{ color: "#334455" }}>Value</div>
          <div className="text-xs text-center py-0.5"
            style={{ color: isBuy ? "#f03060" : "#00d97e" }}>
            {isBuy ? "-" : "+"}₹{Math.round(value).toLocaleString("en-IN")}
          </div>
        </div>
      </div>

      {/* Row 3: qty info */}
      <div className="mt-1 text-xs" style={{ color: "#334455" }}>
        {lots} lot{lots > 1 ? "s" : ""} × {lotSize} = {qty} qty
        &nbsp;•&nbsp;
        {contract.symbol} {contract.strike} {contract.optionType}
      </div>
    </div>
  );
}
