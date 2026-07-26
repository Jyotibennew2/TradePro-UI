/**
 * TradePro Simulator - Searchable Select
 * A small reusable combobox: click to open, type to filter, click an
 * option to select. Used for the Expiry jump, and for Instrument/Lots/
 * SL/Target pickers in the Position Book. Pure UI — no calculation logic.
 */
import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown } from "lucide-react";
import { useTheme } from "../../store/themeStore";

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  options: SelectOption[];
  value: string;
  onSelect: (value: string) => void;
  placeholder?: string;
  widthClass?: string;
  align?: "left" | "right";
}

export default function SearchableSelect({ options, value, onSelect, placeholder, widthClass, align = "left" }: Props) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const current = options.find(o => o.value === value);
  const filtered = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <div ref={boxRef} className={`relative ${widthClass ?? ""}`}>
      <button
        onClick={() => { setOpen(v => !v); setQuery(""); }}
        className="w-full flex items-center justify-between gap-1 px-2 py-1 rounded-lg text-sm font-bold"
        style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color: theme.text.primary }}
      >
        <span className="truncate">{current?.label ?? placeholder ?? "Select"}</span>
        <ChevronDown size={12} color={theme.text.faint} />
      </button>

      {open && (
        <div
          className="absolute z-40 mt-1 rounded-lg overflow-hidden shadow-xl"
          style={{
            background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}`,
            width: 180, [align === "right" ? "right" : "left"]: 0,
          }}
        >
          <div className="flex items-center gap-1 px-2 py-1.5" style={{ borderBottom: `1px solid ${theme.border.subtle}` }}>
            <Search size={12} color={theme.text.faint} />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search..."
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: theme.text.secondary }}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-2 py-2 text-sm text-center" style={{ color: theme.text.faint }}>No match</div>
            ) : (
              filtered.map(o => (
                <button
                  key={o.value}
                  onClick={() => { onSelect(o.value); setOpen(false); }}
                  className="block w-full px-2 py-1.5 text-left text-sm"
                  style={{
                    background: o.value === value ? theme.accent.cyan + "18" : "transparent",
                    color: o.value === value ? theme.accent.cyan : theme.text.secondary,
                    fontWeight: o.value === value ? 700 : 500,
                  }}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
