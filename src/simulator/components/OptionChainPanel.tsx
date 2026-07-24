/**
 * TradePro Simulator - Option Chain panel (left workspace column, Section A)
 * Market selector + expiry dropdown + jump-to-date + the archived option
 * chain grid. Same chain rendering/columns/B-S-add-to-builder behavior as
 * before — just laid out compactly for the left column instead of inside a
 * collapsible "Historical" section.
 */
import { useTheme } from "../../store/themeStore";
import { useChainColumnsStore, CHAIN_COLUMN_LABELS } from "../../store/chainColumnsStore";
import ChainColumnToggle from "../../components/ui/ChainColumnToggle";
import Loader from "../../components/ui/Loader";
import ErrorBox from "../../components/ui/ErrorBox";
import { SYMBOLS, OPTIONAL_COLS, fmt, fmtDateLabel } from "../hooks/useHistoricalChain";
import type { HistoricalChain } from "../hooks/useHistoricalChain";

export default function OptionChainPanel({ chain }: { chain: HistoricalChain }) {
  const theme = useTheme();
  const { columns } = useChainColumnsStore();
  const activeOptional = OPTIONAL_COLS.filter(c => (columns as Record<string, boolean>)[c.key]);
  const gridTemplate = `${"0.8fr ".repeat(activeOptional.length)}1fr 60px 1fr ${"0.8fr ".repeat(activeOptional.length)}`.trim();

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}` }}>
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${theme.border.subtle}` }}>
        <span className="text-sm font-bold uppercase tracking-wide" style={{ color: theme.text.muted }}>Option Chain</span>
        <ChainColumnToggle />
      </div>

      <div className="p-3 space-y-2">
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${theme.border.subtle}` }}>
          {SYMBOLS.map(s => (
            <button
              key={s}
              onClick={() => chain.setSymbol(s)}
              className="flex-1 py-1.5 text-sm font-bold"
              style={{ background: chain.symbol === s ? theme.accent.cyan : theme.bg.surface, color: chain.symbol === s ? theme.bg.page : theme.text.muted }}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="text-sm" style={{ color: theme.text.faint, fontSize: 10 }}>
          Archive currently covers NIFTY &amp; BANKNIFTY only.
        </div>

        <select
          value={chain.expiry}
          onChange={e => chain.setExpiry(e.target.value)}
          className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
          style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color: theme.text.secondary }}
        >
          {chain.expiries.map(e => <option key={e} value={e}>{fmtDateLabel(e)}</option>)}
        </select>

        {chain.dates.length > 0 && (
          <select
            value={chain.dateIdx}
            onChange={e => chain.setDateIdx(Number(e.target.value))}
            className="w-full px-2 py-1.5 rounded-lg text-sm outline-none"
            style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color: theme.text.secondary }}
          >
            {chain.dates.map((d, i) => <option key={d} value={i}>{fmtDateLabel(d)}</option>)}
          </select>
        )}

        {chain.loading && <Loader text="Loading snapshot..." />}
        {chain.error && <ErrorBox message="Failed to load this snapshot" />}
        {chain.legMsg && (
          <div className="text-sm text-center py-1 rounded-lg" style={{ background: theme.accent.green + "15", color: theme.accent.green }}>
            {chain.legMsg}
          </div>
        )}

        {chain.chainData && (
          <>
            {activeOptional.length > 0 && (
              <div
                className="grid text-center px-1 font-semibold"
                style={{ gridTemplateColumns: gridTemplate, fontSize: 9, color: theme.text.faint }}
              >
                {activeOptional.map(c => <div key={c.key} style={{ color: theme.accent.green }}>{CHAIN_COLUMN_LABELS[c.key]}</div>)}
                <div style={{ color: theme.accent.green }}>CE</div>
                <div style={{ color: theme.accent.cyan }}>STRK</div>
                <div style={{ color: theme.accent.red }}>PE</div>
                {activeOptional.map(c => <div key={c.key} style={{ color: theme.accent.red }}>{CHAIN_COLUMN_LABELS[c.key]}</div>)}
              </div>
            )}
            <div className="max-h-[420px] overflow-y-auto space-y-0.5 pr-1">
              {chain.chainData.map((row, i) => (
                <div
                  key={i}
                  className="grid text-center rounded-md"
                  style={{
                    gridTemplateColumns: gridTemplate,
                    background: row.atm ? theme.accent.cyan + "12" : (i % 2 === 0 ? theme.bg.surface : theme.bg.surfaceAlt),
                    border: row.atm ? `1px solid ${theme.accent.cyan}40` : "1px solid transparent",
                    padding: "4px 1px", fontSize: 11,
                  }}
                >
                  {activeOptional.map(c => {
                    const v = (row as unknown as Record<string, number | undefined>)[`ce_${c.field}`];
                    return <div key={c.key} style={{ color: theme.text.faint }}>{v != null ? c.fmt(v) : "-"}</div>;
                  })}
                  <div>
                    <div style={{ color: theme.accent.green, fontWeight: row.atm ? 800 : 600 }}>₹{fmt(row.ce_ltp)}</div>
                    {row.ce_ltp != null && (
                      <div className="flex gap-1 justify-center mt-0.5">
                        <button onClick={() => chain.handleAddLeg(row, "CE", "BUY")} className="text-xs px-1.5 rounded font-bold" style={{ background: theme.accent.green + "20", color: theme.accent.green }}>B</button>
                        <button onClick={() => chain.handleAddLeg(row, "CE", "SELL")} className="text-xs px-1.5 rounded font-bold" style={{ background: theme.accent.red + "20", color: theme.accent.red }}>S</button>
                      </div>
                    )}
                  </div>
                  <div style={{ color: row.atm ? theme.accent.cyan : theme.text.secondary, fontWeight: 700, background: row.atm ? theme.accent.cyan + "15" : "none", borderRadius: 4 }}>{row.strike}</div>
                  <div>
                    <div style={{ color: theme.accent.red, fontWeight: row.atm ? 800 : 600 }}>₹{fmt(row.pe_ltp)}</div>
                    {row.pe_ltp != null && (
                      <div className="flex gap-1 justify-center mt-0.5">
                        <button onClick={() => chain.handleAddLeg(row, "PE", "BUY")} className="text-xs px-1.5 rounded font-bold" style={{ background: theme.accent.green + "20", color: theme.accent.green }}>B</button>
                        <button onClick={() => chain.handleAddLeg(row, "PE", "SELL")} className="text-xs px-1.5 rounded font-bold" style={{ background: theme.accent.red + "20", color: theme.accent.red }}>S</button>
                      </div>
                    )}
                  </div>
                  {activeOptional.map(c => {
                    const v = (row as unknown as Record<string, number | undefined>)[`pe_${c.field}`];
                    return <div key={c.key} style={{ color: theme.text.faint }}>{v != null ? c.fmt(v) : "-"}</div>;
                  })}
                </div>
              ))}
            </div>
          </>
        )}

        {!chain.hasData && (
          <div className="text-center py-6" style={{ color: theme.text.muted }}>
            <div className="text-sm">No archived data yet for {chain.symbol}</div>
          </div>
        )}
      </div>
    </div>
  );
}
