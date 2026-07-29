import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  runBatchBacktest, fetchBatchStatus, fetchBatchList, fetchBatchSummary, fetchBatchResults,
  type BatchStrategy, type BatchResultRow,
} from "../utils/api";
import Card from "../components/ui/Card";
import Loader from "../components/ui/Loader";
import ErrorBox from "../components/ui/ErrorBox";
import { useTheme } from "../store/themeStore";

const SYMBOLS: string[] = ["NIFTY", "BANKNIFTY", "BTC", "ETH"];
const STRATEGIES: { id: BatchStrategy; label: string }[] = [
  { id: "straddle",      label: "Straddle" },
  { id: "strangle",      label: "Strangle" },
  { id: "iron_condor",   label: "Iron Condor" },
  { id: "delta_neutral", label: "Delta-Neutral (30\u0394)" },
  { id: "theta_harvest", label: "Theta-Harvest" },
];
const TIMEFRAMES = ["5m", "15m", "1h", "1d"];

function fmtMoney(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}
function fmtDate(epoch: number) {
  return new Date(epoch * 1000).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}
function strategyLabel(id: string) {
  return STRATEGIES.find(s => s.id === id)?.label ?? id;
}

/**
 * One trade's full detail: expiry, exact legs, SL/target amounts, why it
 * exited. Guards every field defensively - batch runs from before this
 * detail logging was added won't have legs/sl_amount/spot saved, so this
 * shows a fallback note instead of crashing on those older rows.
 */
function TradeDetailRow({ r }: { r: BatchResultRow }) {
  const theme = useTheme();
  const legs = r.legs ?? [];
  const hasDetail = legs.length > 0;

  return (
    <div className="rounded-lg p-3" style={{ background: theme.bg.page, border: `1px solid ${theme.border.subtle}` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm" style={{ color: theme.text.muted }}>
          Expiry <b style={{ color: theme.text.secondary }}>{r.expiry_date}</b> · {r.timeframe} entry
        </div>
        <div className="text-sm font-bold" style={{ color: r.pnl >= 0 ? theme.accent.green : theme.accent.red }}>
          {fmtMoney(r.pnl)}
        </div>
      </div>

      {!hasDetail && (
        <div className="text-sm mb-2 italic" style={{ color: theme.text.muted }}>
          This trade ran before detailed logging (exact strikes/SL) was added — re-run a batch to see full detail.
        </div>
      )}

      {/* Exact legs traded */}
      {hasDetail && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {legs.map((leg, i) => (
            <span key={i} className="text-sm px-2 py-1 rounded"
              style={{
                background: leg.action === "SELL" ? theme.accent.red + "18" : theme.accent.green + "18",
                color     : leg.action === "SELL" ? theme.accent.red : theme.accent.green,
                border    : `1px solid ${(leg.action === "SELL" ? theme.accent.red : theme.accent.green)}40`,
              }}>
              {leg.action} {leg.strike} {leg.option_type} x{leg.lots}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm" style={{ color: theme.text.muted }}>
        <span>Entry: {fmtDate(r.entry_t)}{r.entry_spot != null ? ` @ spot ${r.entry_spot.toLocaleString("en-IN")}` : ""}</span>
        <span>Exit: {fmtDate(r.exit_t)}{r.exit_spot != null ? ` @ spot ${r.exit_spot.toLocaleString("en-IN")}` : ""}</span>
        <span>Premium collected: {(r.entry_premium ?? 0).toLocaleString("en-IN")}</span>
        <span>Exit reason: <b style={{ color: theme.text.secondary }}>{r.exit_reason}</b></span>
        {r.sl_amount != null && <span>Stop-loss set at: <span style={{ color: theme.accent.red }}>{r.sl_amount.toLocaleString("en-IN")}</span></span>}
        {r.tgt_amount != null && <span>Target set at: <span style={{ color: theme.accent.green }}>{r.tgt_amount.toLocaleString("en-IN")}</span></span>}
      </div>
    </div>
  );
}

export default function BatchBacktest() {
  const theme = useTheme();
  const qc = useQueryClient();

  // ─── Trigger form state ──────────────────────────────────────────────────
  const [symbols, setSymbols]       = useState<string[]>(["NIFTY"]);
  const [strategies, setStrategies] = useState<BatchStrategy[]>(STRATEGIES.map(s => s.id));
  const [timeframes, setTimeframes] = useState<string[]>(["1h", "1d"]);
  const [slPct, setSlPct]           = useState(50);
  const [tgtPct, setTgtPct]         = useState(50);
  const [maxEntries, setMaxEntries] = useState(20);

  const [activeJobId, setActiveJobId]         = useState<string | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup]     = useState<{ symbol: string; strategy: string } | null>(null);

  const toggle = <T,>(list: T[], setList: (v: T[]) => void, val: T) =>
    setList(list.includes(val) ? list.filter(v => v !== val) : [...list, val]);

  // ─── Trigger mutation ─────────────────────────────────────────────────────
  const trigger = useMutation({
    mutationFn: () => runBatchBacktest({
      symbols, strategies, timeframes, slPct, tgtPct, maxEntriesPerExpiry: maxEntries,
    }),
    onSuccess: (data) => setActiveJobId(data.job_id),
  });

  // ─── Poll active job status ───────────────────────────────────────────────
  const { data: jobStatus } = useQuery({
    queryKey       : ["batchStatus", activeJobId],
    queryFn         : () => fetchBatchStatus(activeJobId!),
    enabled         : !!activeJobId,
    refetchInterval : (query) => (query.state.data?.status === "running" ? 4000 : false),
  });

  if (jobStatus?.status === "done" && jobStatus.result && selectedBatchId !== jobStatus.result.batch_id) {
    // Auto-select the just-finished batch's results, and refresh the history list
    setSelectedBatchId(jobStatus.result.batch_id);
    setExpandedGroup(null);
    qc.invalidateQueries({ queryKey: ["batchList"] });
  }

  // ─── History list ─────────────────────────────────────────────────────────
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["batchList"],
    queryFn : () => fetchBatchList(20),
  });

  // ─── Selected batch's grouped results ─────────────────────────────────────
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ["batchSummary", selectedBatchId],
    queryFn : () => fetchBatchSummary(selectedBatchId!),
    enabled : !!selectedBatchId,
  });

  // ─── Individual trades for the expanded group (exact strikes/legs/SL) ─────
  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ["batchResults", selectedBatchId, expandedGroup?.symbol, expandedGroup?.strategy],
    queryFn : () => fetchBatchResults(selectedBatchId!, expandedGroup!.symbol, expandedGroup!.strategy, 50),
    enabled : !!selectedBatchId && !!expandedGroup,
  });

  const checkboxRow = <T extends string>(
    items: { id: T; label: string }[], selected: T[], onToggle: (v: T) => void
  ) => (
    <div className="flex flex-wrap gap-2">
      {items.map(({ id, label }) => (
        <button key={id} type="button" onClick={() => onToggle(id)}
          className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
          style={{
            background: selected.includes(id) ? theme.accent.cyan + "22" : theme.bg.surface,
            color     : selected.includes(id) ? theme.accent.cyan : theme.text.muted,
            border    : `1px solid ${selected.includes(id) ? theme.accent.cyan + "60" : theme.border.subtle}`,
          }}>
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      {/* Trigger new batch */}
      <Card title="New Batch Backtest">
        <div className="space-y-4">
          <div>
            <div className="text-sm mb-2" style={{ color: theme.text.muted }}>Symbols</div>
            {checkboxRow(SYMBOLS.map(s => ({ id: s, label: s })), symbols, (v) => toggle(symbols, setSymbols, v))}
          </div>
          <div>
            <div className="text-sm mb-2" style={{ color: theme.text.muted }}>Strategies</div>
            {checkboxRow(STRATEGIES, strategies, (v) => toggle(strategies, setStrategies, v))}
          </div>
          <div>
            <div className="text-sm mb-2" style={{ color: theme.text.muted }}>Entry Timeframes</div>
            {checkboxRow(TIMEFRAMES.map(t => ({ id: t, label: t })), timeframes, (v) => toggle(timeframes, setTimeframes, v))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-sm mb-1" style={{ color: theme.text.muted }}>SL %</div>
              <input type="number" value={slPct} onChange={e => setSlPct(Number(e.target.value))}
                className="w-full rounded-lg px-2 py-1.5 text-sm"
                style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color: theme.text.primary }} />
            </div>
            <div>
              <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Target %</div>
              <input type="number" value={tgtPct} onChange={e => setTgtPct(Number(e.target.value))}
                className="w-full rounded-lg px-2 py-1.5 text-sm"
                style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color: theme.text.primary }} />
            </div>
            <div>
              <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Max entries/expiry</div>
              <input type="number" value={maxEntries} onChange={e => setMaxEntries(Number(e.target.value))}
                className="w-full rounded-lg px-2 py-1.5 text-sm"
                style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color: theme.text.primary }} />
            </div>
          </div>

          <button type="button"
            disabled={symbols.length === 0 || strategies.length === 0 || trigger.isPending || jobStatus?.status === "running"}
            onClick={() => trigger.mutate()}
            className="w-full rounded-lg py-2.5 text-sm font-bold disabled:opacity-40"
            style={{ background: theme.accent.cyan, color: theme.bg.page }}>
            {jobStatus?.status === "running" ? "Running…" : "Run Batch Backtest"}
          </button>

          {jobStatus?.status === "running" && (
            <div className="text-sm text-center" style={{ color: theme.text.muted }}>
              Job {activeJobId} is running in background — results save as they go, safe to leave this page.
            </div>
          )}
          {jobStatus?.status === "error" && (
            <ErrorBox message={jobStatus.error ?? "Batch backtest failed"} />
          )}
          {jobStatus?.status === "done" && jobStatus.result && (
            <div className="text-sm text-center" style={{ color: theme.accent.green }}>
              Done — {jobStatus.result.saved} scenarios saved ({jobStatus.result.skipped} skipped, insufficient data)
            </div>
          )}
        </div>
      </Card>

      {/* History of past batches */}
      <Card title="Past Batches (saved — always here to revisit)">
        {historyLoading ? <Loader text="Loading history..." /> : (
          <div className="space-y-2">
            {(historyData?.batches ?? []).length === 0 && (
              <div className="text-sm text-center py-4" style={{ color: theme.text.muted }}>
                No batch runs yet — configure and run one above.
              </div>
            )}
            {(historyData?.batches ?? []).map((b) => (
              <button key={b.batch_id} type="button"
                onClick={() => { setSelectedBatchId(b.batch_id); setExpandedGroup(null); }}
                className="w-full text-left rounded-lg p-3 transition-all"
                style={{
                  background: selectedBatchId === b.batch_id ? theme.accent.cyan + "14" : theme.bg.surface,
                  border    : `1px solid ${selectedBatchId === b.batch_id ? theme.accent.cyan + "60" : theme.border.subtle}`,
                }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold" style={{ color: theme.text.secondary }}>{b.batch_id}</div>
                    <div className="text-sm mt-0.5" style={{ color: theme.text.muted }}>
                      {fmtDate(b.created_at)} • {b.n} scenarios • {Math.round((b.wins / b.n) * 100)}% win rate
                    </div>
                  </div>
                  <div className="text-sm font-bold"
                    style={{ color: b.total_pnl >= 0 ? theme.accent.green : theme.accent.red }}>
                    {fmtMoney(b.total_pnl)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Selected batch's ranked results */}
      {selectedBatchId && (
        <Card title={`Results — ${selectedBatchId}`}>
          {summaryLoading ? <Loader text="Loading results..." /> : (
            <div className="space-y-2">
              {(summaryData?.groups ?? []).length === 0 && (
                <div className="text-sm text-center py-4" style={{ color: theme.text.muted }}>
                  No results yet for this batch.
                </div>
              )}
              {(summaryData?.groups ?? []).map((g, i) => {
                const isExpanded = expandedGroup?.symbol === g.symbol && expandedGroup?.strategy === g.strategy;
                return (
                  <div key={`${g.symbol}-${g.strategy}`}>
                    <button type="button"
                      onClick={() => setExpandedGroup(isExpanded ? null : { symbol: g.symbol, strategy: g.strategy })}
                      className="w-full text-left rounded-lg p-3"
                      style={{
                        background: theme.bg.surface,
                        border    : `1px solid ${isExpanded ? theme.accent.cyan + "60" : (i === 0 ? theme.accent.green + "60" : theme.border.subtle)}`,
                      }}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm font-bold" style={{ color: theme.text.secondary }}>
                          {i === 0 && "🏆 "}{g.symbol} · {strategyLabel(g.strategy)}
                        </div>
                        <div className="text-sm font-bold"
                          style={{ color: g.total_pnl >= 0 ? theme.accent.green : theme.accent.red }}>
                          {fmtMoney(g.total_pnl)}
                        </div>
                      </div>
                      <div className="flex gap-4 text-sm" style={{ color: theme.text.muted }}>
                        <span>Win rate: <b style={{ color: theme.text.secondary }}>{g.win_rate}%</b></span>
                        <span>Trades: {g.n}</span>
                        <span>Avg: {fmtMoney(Math.round(g.avg_pnl))}</span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <div className="flex gap-4 text-sm" style={{ color: theme.text.muted }}>
                          <span>Best: <span style={{ color: theme.accent.green }}>{fmtMoney(g.best_pnl)}</span></span>
                          <span>Worst: <span style={{ color: theme.accent.red }}>{fmtMoney(g.worst_pnl)}</span></span>
                        </div>
                        <span className="text-sm" style={{ color: theme.accent.cyan }}>
                          {isExpanded ? "Hide trades ▲" : "Show trades ▼"}
                        </span>
                      </div>
                    </button>

                    {/* Individual trade detail: expiry, exact legs, SL/target, exit reason */}
                    {isExpanded && (
                      <div className="mt-2 space-y-2 pl-2">
                        {detailLoading ? <Loader text="Loading trades..." /> : (
                          (detailData?.results ?? []).map((r) => <TradeDetailRow key={r.id} r={r} />)
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
