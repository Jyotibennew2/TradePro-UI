/**
 * TradePro Simulator - Option Chain panel (left workspace column, Section A)
 */
import { useTheme } from "../../store/themeStore";
import { useChainColumnsStore, CHAIN_COLUMN_LABELS } from "../../store/chainColumnsStore";
import ChainColumnToggle from "../../components/ui/ChainColumnToggle";
import Loader from "../../components/ui/Loader";
import ErrorBox from "../../components/ui/ErrorBox";
import { SYMBOLS, OPTIONAL_COLS, fmt, fmtDateLabel } from "../hooks/useHistoricalChain";
import type { HistoricalChain } from "../hooks/useHistoricalChain";
import SearchableSelect from "./SearchableSelect";
import DateTimeSelector from "./DateTimeSelector";

function dteFor(expiry: string, fromDate: string): number | null {
  if (!fromDate) return null;
  const ms = new Date(expiry + "T00:00:00").getTime() - new Date(fromDate + "T00:00:00").getTime();
  return Math.round(ms / 86400000);
}

function computeMaxPain(rows: { strike: number; ce_oi?: number | null; pe_oi?: number | null }[]): number | null {
  if (!rows || rows.length === 0) return null;
  let best: number | null = null;
  let bestPain = Infinity;
  for (const candidate of rows) {
    const S = candidate.strike;
    let pain = 0;
    for (const r of rows) {
      if (r.strike < S) pain += (S - r.strike) * (r.ce_oi ?? 0);
      if (r.strike > S) pain += (r.strike - S) * (r.pe_oi ?? 0);
    }
    if (pain < bestPain) { bestPain = pain; best = S; }
  }
  return best;
}

export default function OptionChainPanel({ chain }: { chain: HistoricalChain }) {
  const theme = useTheme();
  const { columns } = useChainColumnsStore();
  const activeOptional = OPTIONAL_COLS.filter(c => (columns as unknown as Record<string, boolean>)[c.key]);
  const gridTemplate = `${"0.8fr ".repeat(activeOptional.length)}1fr 60px 1fr ${"0.8fr ".repeat(activeOptional.length)}`.trim();

  const atmRow = chain.chainData?.find(r => r.atm) ?? null;
  const atmIv = atmRow ? (((atmRow.ce_iv ?? 0) + (atmRow.pe_iv ?? 0)) / 2) : null;
  const straddlePrem = atmRow ? (atmRow.ce_ltp ?? 0) + (atmRow.pe_ltp ?? 0) : null;
  const totalCeOi = chain.chainData?.reduce((s, r) => s + (r.ce_oi ?? 0), 0) ?? 0;
  const totalPeOi = chain.chainData?.reduce((s, r) => s + (r.pe_oi ?? 0), 0) ?? 0;
  const pcr = chain.chainData && totalCeOi > 0 ? totalPeOi / totalCeOi : null;
  const maxPain = chain.chainData ? computeMaxPain(chain.chainData) : null;
  const maxOi = chain.chainData
    ? Math.max(1, ...chain.chainData.flatMap(r => [r.ce_oi ?? 0, r.pe_oi ?? 0]))
    : 1;
  const showOiBars = activeOptional.some(c => c.key === "oi");

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
        <div style={{ color: theme.text.faint, fontSize: 10 }}>
          Archive currently covers NIFTY &amp; BANKNIFTY only.
        </div>

        {chain.expiries.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex gap-1 overflow-x-auto pb-1 flex-1">
              {chain.expiries.map(e => {
                const dte = dteFor(e, chain.selectedDate);
                const active = chain.expiry === e;
                return (
                  <button
                    key={e}
                    onClick={() => chain.setExpiry(e)}
                    className="shrink-0 px-2 py-1 rounded-lg text-center"
                    style={{ background: active ? theme.accent.cyan : theme.bg.surface, border: `1px solid ${active ? theme.accent.cyan : theme.border.subtle}` }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 800, color: active ? theme.bg.page : theme.text.secondary }}>{fmtDateLabel(e)}</div>
                    {dte != null && <div style={{ fontSize: 8, color: active ? theme.bg.page : theme.text.faint }}>{dte} DTE</div>}
                  </button>
                );
              })}
            </div>
            <SearchableSelect
              widthClass="w-28 shrink-0"
              value={chain.expiry}
              onSelect={chain.setExpiry}
              placeholder="Jump..."
              options={chain.expiries.map(e => ({ value: e, label: fmtDateLabel(e) }))}
            />
          </div>
        )}

        <DateTimeSelector chain={chain} />

        {chain.chainData && (
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-lg text-center py-1" style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}` }}>
              <div style={{ fontSize: 8, color: theme.text.faint }}>ATM IV</div>
              <div className="font-bold" style={{ fontSize: 12, color: theme.accent.purple }}>{atmIv != null ? `${atmIv.toFixed(1)}%` : "—"}</div>
            </div>
            <div className="rounded-lg text-center py-1" style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}` }}>
              <div style={{ fontSize: 8, color: theme.text.faint }}>Straddle Prem</div>
              <div className="font-bold" style={{ fontSize: 12, color: theme.accent.cyan }}>{straddlePrem != null ? `₹${fmt(straddlePrem)}` : "—"}</div>
            </div>
            <div className="rounded-lg text-center py-1" style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}` }}>
              <div style={{ fontSize: 8, color: theme.text.faint }}>PCR (OI)</div>
              <div className="font-bold" style={{ fontSize: 12, color: theme.accent.orange }}>{pcr != null ? pcr.toFixed(2) : "—"}</div>
            </div>
            <div className="rounded-lg text-center py-1" style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}` }}>
              <div style={{ fontSize: 8, color: theme.text.faint }}>Max Pain</div>
              <div className="font-bold" style={{ fontSize: 12, color: theme.accent.green }}>{maxPain != null ? maxPain : "—"}</div>
            </div>
          </div>
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
                {activeOptional.map(c => <div key={c.key} style={{ color: theme.accent.green }}>{(CHAIN_COLUMN_LABELS as Record<string, string>)[c.key]}</div>)}
                <div style={{ color: theme.accent.green }}>CE</div>
                <div style={{ color: theme.accent.cyan }}>STRK</div>
                <div style={{ color: theme.accent.red }}>PE</div>
                {activeOptional.map(c => <div key={c.key} style={{ color: theme.accent.red }}>{(CHAIN_COLUMN_LABELS as Record<string, string>)[c.key]}</div>)}
              </div>
            )}
            <div className="max-h-[420px] overflow-y-auto space-y-0.5 pr-1">
              {chain.chainData.map((row, i) => (
                <div
                  key={i}
                  className="grid text-center rounded-md items-center"
                  style={{
                    gridTemplateColumns: gridTemplate,
                    background: row.atm ? theme.accent.cyan + "12" : (i % 2 === 0 ? theme.bg.surface : theme.bg.surfaceAlt),
                    border: row.atm ? `1px solid ${theme.accent.cyan}40` : "1px solid transparent",
                    padding: "4px 1px", fontSize: 11,
                  }}
                >
                  {activeOptional.map(c => {
                    const v = (row as unknown as Record<string, number | undefined>)[`ce_${c.field}`];
                    if (c.key === "oi" && showOiBars) {
                      const pct = v != null ? Math.min(100, (v / maxOi) * 100) : 0;
                      return (
                        <div key={c.key} className="relative" style={{ height: 16 }}>
                          <div style={{ position: "absolute", right: 0, top: 2, height: 12, width: `${pct}%`, background: theme.accent.green + "35", borderRadius: 3 }} />
                          <div style={{ position: "relative", fontSize: 8, color: theme.text.faint, textAlign: "right", paddingRight: 2, lineHeight: "16px" }}>
                            {v != null ? c.fmt(v) : "-"}
                          </div>
                        </div>
                      );
                    }
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
                    if (c.key === "oi" && showOiBars) {
                      const pct = v != null ? Math.min(100, (v / maxOi) * 100) : 0;
                      return (
                        <div key={c.key} className="relative" style={{ height: 16 }}>
                          <div style={{ position: "absolute", left: 0, top: 2, height: 12, width: `${pct}%`, background: theme.accent.red + "35", borderRadius: 3 }} />
                          <div style={{ position: "relative", fontSize: 8, color: theme.text.faint, textAlign: "left", paddingLeft: 2, lineHeight: "16px" }}>
                            {v != null ? c.fmt(v) : "-"}
                          </div>
                        </div>
                      );
                    }
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
