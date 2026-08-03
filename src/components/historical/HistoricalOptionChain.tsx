/**
 * TradePro - Historical Option Chain (standalone)
 * Used on the Backtest page. Powered by the shared useHistoricalChain hook.
 */
import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceDot, ReferenceLine,
} from "recharts";
import { Play, Pause, ChevronLeft, ChevronRight } from "lucide-react";
import { useTheme } from "../../store/themeStore";
import { useChainColumnsStore, CHAIN_COLUMN_LABELS } from "../../store/chainColumnsStore";
import ChainColumnToggle from "../ui/ChainColumnToggle";
import Loader from "../ui/Loader";
import ErrorBox from "../ui/ErrorBox";
import Card from "../ui/Card";
import {
  useHistoricalChain, SYMBOLS, TIMEFRAMES, SPEEDS, OPTIONAL_COLS, fmt, fmtTime, fmtDateLabel,
} from "../../simulator/hooks/useHistoricalChain";

export default function HistoricalOptionChain() {
  const theme = useTheme();
  const chain = useHistoricalChain();
  const { columns } = useChainColumnsStore();
  const activeOptional = OPTIONAL_COLS.filter(c => (columns as unknown as Record<string, boolean>)[c.key]);
  const gridTemplate = `${"0.8fr ".repeat(activeOptional.length)}1fr 60px 1fr ${"0.8fr ".repeat(activeOptional.length)}`.trim();
  const [speedOpen, setSpeedOpen] = useState(false);

  return (
    <Card title="Historical Option Chain">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${theme.border.subtle}` }}>
            {SYMBOLS.map(s => (
              <button key={s} onClick={() => chain.setSymbol(s)}
                className="px-3 py-1.5 text-sm font-bold"
                style={{ background: chain.symbol === s ? theme.accent.cyan : theme.bg.surface, color: chain.symbol === s ? theme.bg.page : theme.text.muted }}>
                {s}
              </button>
            ))}
          </div>

          <select value={chain.expiry} onChange={e => chain.setExpiry(e.target.value)}
            className="px-2 py-1.5 rounded-lg text-sm outline-none"
            style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color: theme.text.secondary }}>
            {chain.expiries.map(e => <option key={e} value={e}>{fmtDateLabel(e)}</option>)}
          </select>

          {chain.dates.length > 0 && (
            <select value={chain.dateIdx} onChange={e => chain.setDateIdx(Number(e.target.value))}
              className="px-2 py-1.5 rounded-lg text-sm outline-none"
              style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color: theme.text.secondary }}>
              {chain.dates.map((d, i) => <option key={d} value={i}>{fmtDateLabel(d)}</option>)}
            </select>
          )}

          <ChainColumnToggle />
        </div>

        {!chain.hasData && (
          <div className="text-center py-8" style={{ color: theme.text.muted }}>
            No archived data yet for {chain.symbol}
          </div>
        )}

        {chain.hasData && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {TIMEFRAMES.map(tf => (
                <button key={tf.key} onClick={() => chain.setResolution(tf.key)}
                  className="px-2.5 py-1 rounded-lg text-sm font-bold"
                  style={{
                    background: chain.resolution === tf.key ? theme.accent.cyan : theme.bg.surfaceAlt,
                    color: chain.resolution === tf.key ? theme.bg.page : theme.text.muted,
                  }}>
                  {tf.shortLabel}
                </button>
              ))}
              <button onClick={() => chain.step(-1)} className="p-1.5 rounded-lg" style={{ background: theme.bg.surfaceAlt, color: theme.text.secondary }}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => chain.setIsPlaying(p => !p)}
                className="px-3 py-1.5 rounded-lg text-sm font-black flex items-center gap-1.5"
                style={{
                  background: chain.isPlaying ? theme.accent.red + "20" : theme.accent.green + "20",
                  color: chain.isPlaying ? theme.accent.red : theme.accent.green,
                }}>
                {chain.isPlaying ? <Pause size={14} /> : <Play size={14} />}
                {chain.isPlaying ? "Pause" : "Play"}
              </button>
              <button onClick={() => chain.step(1)} className="p-1.5 rounded-lg" style={{ background: theme.bg.surfaceAlt, color: theme.text.secondary }}>
                <ChevronRight size={16} />
              </button>
              <div className="relative">
                <button onClick={() => setSpeedOpen(v => !v)}
                  className="px-2 py-1.5 rounded-lg text-sm font-bold"
                  style={{ background: theme.bg.surfaceAlt, color: theme.accent.orange }}>
                  {chain.speed}×
                </button>
                {speedOpen && (
                  <div className="absolute top-full mt-1 right-0 z-20 rounded-lg overflow-hidden"
                    style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}` }}>
                    {SPEEDS.map(sp => (
                      <button key={sp} onClick={() => { chain.setSpeed(sp); setSpeedOpen(false); }}
                        className="block w-full px-4 py-1.5 text-sm font-bold text-left"
                        style={{ color: chain.speed === sp ? theme.accent.orange : theme.text.secondary }}>
                        {sp}×
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-sm ml-auto" style={{ color: theme.text.muted }}>
                {chain.chainMeta ? fmtTime(chain.chainMeta.savedAt) : "—"} • Spot {chain.chainMeta?.spot ?? "—"}
              </div>
            </div>

            {chain.miniChart.length > 0 && (
              <div style={{ height: 70 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chain.miniChart}>
                    <Line type="monotone" dataKey="close" stroke={theme.accent.cyan} dot={false} strokeWidth={1.5} isAnimationActive={false} />
                    {chain.cursorPoint && <ReferenceDot x={chain.cursorPoint.t} y={chain.cursorPoint.close} r={4} fill={theme.accent.orange} stroke="none" />}
                  </LineChart>
                </ResponsiveContainer>
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
              <div className="max-h-[420px] overflow-y-auto space-y-0.5 pr-1">
                {activeOptional.length > 0 && (
                  <div className="grid text-center px-1 font-semibold" style={{ gridTemplateColumns: gridTemplate, fontSize: 9, color: theme.text.faint }}>
                    {activeOptional.map(c => <div key={c.key} style={{ color: theme.accent.green }}>{(CHAIN_COLUMN_LABELS as Record<string, string>)[c.key]}</div>)}
                    <div style={{ color: theme.accent.green }}>CE</div>
                    <div style={{ color: theme.accent.cyan }}>STRK</div>
                    <div style={{ color: theme.accent.red }}>PE</div>
                    {activeOptional.map(c => <div key={c.key} style={{ color: theme.accent.red }}>{(CHAIN_COLUMN_LABELS as Record<string, string>)[c.key]}</div>)}
                  </div>
                )}
                {chain.chainData.map((row, i) => (
                  <div key={i} className="grid text-center rounded-md"
                    style={{
                      gridTemplateColumns: gridTemplate,
                      background: row.atm ? theme.accent.cyan + "12" : (i % 2 === 0 ? theme.bg.surface : theme.bg.surfaceAlt),
                      border: row.atm ? `1px solid ${theme.accent.cyan}40` : "1px solid transparent",
                      padding: "4px 1px", fontSize: 11,
                    }}>
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
                    <div style={{ color: row.atm ? theme.accent.cyan : theme.text.secondary, fontWeight: 700 }}>{row.strike}</div>
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
            )}

            {/* Walk-Forward Backtest */}
            <div className="pt-3 mt-2" style={{ borderTop: `1px dashed ${theme.border.subtle}` }}>
              <div className="text-sm font-black mb-2" style={{ color: theme.accent.orange }}>Real Walk-Forward Backtest</div>
              <div className="flex flex-wrap items-center gap-2">
                <input type="number" value={chain.wfSlPct} onChange={e => chain.setWfSlPct(Number(e.target.value))}
                  placeholder="SL %" className="w-20 px-2 py-1.5 rounded-lg text-sm text-center outline-none"
                  style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}`, color: theme.accent.red }} />
                <input type="number" value={chain.wfTgtPct} onChange={e => chain.setWfTgtPct(Number(e.target.value))}
                  placeholder="Target %" className="w-20 px-2 py-1.5 rounded-lg text-sm text-center outline-none"
                  style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}`, color: theme.accent.green }} />
                <button onClick={chain.runWalkForward} disabled={chain.wfLoading}
                  className="px-3 py-1.5 rounded-lg text-sm font-black"
                  style={{ background: theme.accent.orange, color: theme.bg.page, opacity: chain.wfLoading ? 0.6 : 1 }}>
                  {chain.wfLoading ? "Running…" : "Run Walk-Forward Backtest"}
                </button>
              </div>
              {chain.wfError && <div className="text-sm mt-2" style={{ color: theme.accent.red }}>{chain.wfError}</div>}
              {chain.wfResult && (
                <div className="mt-3">
                  <div className="text-sm mb-2" style={{ color: theme.text.muted }}>
                    Entry: {fmtTime(chain.wfResult.entry.t)} @ spot {chain.wfResult.entry.spot}<br />
                    Exit: {fmtTime(chain.wfResult.exit.t)} @ spot {chain.wfResult.exit.spot} — <span style={{ color: theme.accent.orange }}>{chain.wfResult.exit.reason}</span><br />
                    Final P&L: <span style={{ color: chain.wfResult.final_pnl >= 0 ? theme.accent.green : theme.accent.red, fontWeight: 700 }}>
                      {chain.wfResult.final_pnl >= 0 ? "+" : ""}₹{Math.round(chain.wfResult.final_pnl).toLocaleString("en-IN")}
                    </span>
                  </div>
                  {chain.wfChartData.length > 1 && (
                    <div style={{ height: 140 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chain.wfChartData}>
                          <CartesianGrid stroke={theme.border.subtle} strokeDasharray="3 3" />
                          <XAxis dataKey="time" stroke={theme.text.faint} fontSize={9} />
                          <YAxis stroke={theme.text.faint} fontSize={9} />
                          <Tooltip contentStyle={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, fontSize: 11 }} />
                          <ReferenceLine y={0} stroke={theme.border.strong} />
                          <Line type="monotone" dataKey="pnl" stroke={theme.accent.orange} dot={false} strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
