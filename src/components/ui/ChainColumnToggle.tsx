/**
 * TradePro - Chain Column Toggle
 * A small settings button that opens a checklist for showing/hiding
 * OI / IV / Delta / Gamma / Theta / Vega columns. Shared by every
 * option-chain table (Live, Real Archived, Reconstructed).
 */

import { useState, useRef, useEffect } from "react";
import { SlidersHorizontal, Check } from "lucide-react";
import { useChainColumnsStore, CHAIN_COLUMN_LABELS, type ChainColumns } from "../../store/chainColumnsStore";
import { useTheme } from "../../store/themeStore";

export default function ChainColumnToggle() {
  const theme = useTheme();
  const { columns, toggle, setAll } = useChainColumnsStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const keys = Object.keys(columns) as (keyof ChainColumns)[];
  const allOn = keys.every(k => columns[k]);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="p-2 rounded-lg flex items-center gap-1"
        style={{ background: theme.border.subtle, color: theme.accent.cyan }}
        title="Show/hide columns">
        <SlidersHorizontal size={16} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 rounded-lg overflow-hidden z-20"
          style={{ background: theme.bg.surface, border: `1px solid ${theme.border.strong}`, minWidth: 140 }}>
          <div className="px-3 py-2 text-sm font-bold" style={{ color: theme.text.muted, borderBottom: `1px solid ${theme.border.subtle}` }}>
            Columns
          </div>
          {keys.map(key => (
            <button key={key} onClick={() => toggle(key)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm"
              style={{ color: theme.text.secondary }}>
              <span>{CHAIN_COLUMN_LABELS[key]}</span>
              {columns[key] && <Check size={14} color={theme.accent.cyan} />}
            </button>
          ))}
          <button onClick={() => setAll(!allOn)}
            className="w-full text-center px-3 py-2 text-sm font-bold"
            style={{ color: theme.accent.cyan, borderTop: `1px solid ${theme.border.subtle}` }}>
            {allOn ? "Hide All" : "Show All"}
          </button>
        </div>
      )}
    </div>
  );
}
