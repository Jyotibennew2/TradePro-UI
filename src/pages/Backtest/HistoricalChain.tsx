import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchHistoricalChain, fetchArchivedChain, fetchArchivedExpiries, type Timeframe } from "../../utils/api";
import { useSimulatorStore, makeOptionLeg } from "../../simulator/state/simulatorStore";
import Card from "../../components/ui/Card";
import ErrorBox from "../../components/ui/ErrorBox";
import ChainColumnToggle from "../../components/ui/ChainColumnToggle";
import { useTheme } from "../../store/themeStore";
import { useChainColumnsStore, CHAIN_COLUMN_LABELS, type ChainColumns } from "../../store/chainColumnsStore";
import { EXPIRY_PRESETS, fmt, fmtExpiryLabel, type AnyChainRow } from "./shared";

const REAL_ONLY_KEYS = new Set<keyof ChainColumns>(["oi", "oiChange", "volume", "bid", "ask"]);

const OPTIONAL_COLS: { key: keyof ChainColumns; field: string; fmt: (n: number) => string }[] = [
  { key: "oi",       field: "oi",        fmt: (n) => (n / 100000).toFixed(1) + "L" },
  { key: "oiChange", field: "oi_change", fmt: (n) => (n >= 0 ? "+" : "") + (n / 100000).toFixed(2) + "L" },
  { key: "volume",   field: "volume",    fmt: (n) => (n / 100000).toFixed(1) + "L" },
  { key: "bid",      field: "bid",       fmt: (n) => n.toFixed(2) },
  { key: "ask",      field: "ask",       fmt: (n) => n.toFixed(2) },
  { key: "iv",       field: "iv",        fmt: (n) => n.toFixed(1) + "%" },
  { key: "delta",    field: "delta",     fmt: (n) => n.toFixed(2) },
  { key: "gamma",    field: "gamma",     fmt: (n) => n.toFixed(4) },
  { key: "theta",    field: "theta",     fmt: (n) => n.toFixed(1) },
  { key: "vega",     field: "vega",      fmt: (n) => n.toFixed(1) },
];

function isIntradayGlobal(r: Timeframe) { return r !== "1d"; }

interface Props {
  symbol       : string;
  resolution   : Timeframe;
  histData     : any;
  candleIdx    : number;
  setCandleIdx : (n: number) => void;
  histChartData: any[];
}

export default function HistoricalChain({ symbol, resolution, histData, candleIdx, setCandleIdx, histChartData }: Props) {
  const theme = useTheme();
  const navigate = useNavigate();
  const { columns } = useChainColumnsStore();
  const { addLeg } = useSimulatorStore();

  const [legMsg, setLegMsg] = useState("");
  const [chainIv, setChainIv]           = useState(15);
  const [chainDte, setChainDte]         = useState(7);
  const [chainData, setChainData]       = useState<any>(null);
  const [chainIsReal, setChainIsReal]   = useState(false);
  const [chainLoading, setChainLoading] = useState(false);
  const [chainError, setChainError]     = useState(false);

  const selectedCandle  = histData?.candles?.[candleIdx];
  const selectedDateStr = selectedCandle
    ? new Date(selectedCandle.t * 1000).toISOString().slice(0, 10)
    : "";

  const [dateExpiries, setDateExpiries]     = useState<string[]>([]);
  const [selectedExpiry, setSelectedExpiry] = useState("");

  useEffect(() => {
    if (!selectedDateStr) { setDateExpiries([]); setSelectedExpiry(""); return; }
    fetchArchivedExpiries(symbol, selectedDateStr)
      .then(r => { const exps = r.expiries ?? []; setDateExpiries(exps); setSelectedExpiry(exps[0] ?? ""); })
      .catch(() => { setDateExpiries([]); setSelectedExpiry(""); });
  }, [symbol, selectedDateStr]);

  const hasRealData = dateExpiries.length > 0;

  const loadHistoricalChain = async () => {
    const candle = histData?.candles?.[candleIdx];
    if (!candle) return;
    setChainLoading(true); setChainError(false); setChainData(null); setChainIsReal(false);
    try {
      const label = isIntradayGlobal(resolution)
        ? new Date(candle.t * 1000).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
        : new Date(candle.t * 1000).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      const res = await fetchHistoricalChain({ symbol, spot: candle.close, iv: chainIv, daysToExpiry: chainDte, strikecount: 15, label });
      setChainData(res);
    } catch { setChainError(true); }
    finally { setChainLoading(false); }
  };

  const loadRealArchivedChain = async () => {
    if (!selectedDateStr || !selectedExpiry) return;
    setChainLoading(true); setChainError(false); setChainData(null); setChainIsReal(true);
    try {
      const res = await fetchArchivedChain(symbol, selectedDateStr, selectedExpiry);
      setChainData(res);
    } catch { setChainError(true); }
    finally { setChainLoading(false); }
  };

  const handleAddLeg = (row: AnyChainRow, optType: "CE" | "PE", action: "BUY" | "SELL") => {
    const ltp = optType === "CE" ? row.ce_ltp : row.pe_ltp;
    if (ltp == null) return;
    const iv = ((row as any)[`${optType.toLowerCase()}_iv`] ?? chainIv) as number;
    addLeg(makeOptionLeg(symbol as "NIFTY" | "BANKNIFTY", row.strike, optType, action, 1, ltp, iv, ""));
    setLegMsg(`✓ Added ${action} ${row.strike} ${optType} to Simulator`);
    setTimeout(() => setLegMsg(""), 2500);
  };

  const activeOptional = OPTIONAL_COLS.filter(c => columns[c.key] && (!REAL_ONLY_KEYS.has(c.key) || chainIsReal));
  const gridTemplate   = `${"0.8fr ".repeat(activeOptional.length)}1fr 76px 1fr ${"0.8fr ".repeat(activeOptional.length)}`.trim();

  return (
    <Card title="Historical Option Chain" extra={<ChainColumnToggle />}>
      <div className="space-y-3">
        <div className="text-sm" style={{ color: theme.text.faint }}>
          For dates TradePro was running, you'll see real saved data. For older dates, a Black-Scholes reconstruction is used.
          Tap <b style={{ color: theme.accent.green }}>B</b>/<b style={{ color: theme.accent.red }}>S</b> to send a strike to the Simulator.
        </div>
        <div>
          <div className="text-sm mb-1" style={{ color: theme.text.muted }}>
            Pick a candle: <span style={{ color: theme.accent.cyan }}>{histChartData[candleIdx]?.date}</span> • Spot ₹{fmt(histData.candles[candleIdx]?.close ?? 0)}
            {hasRealData && (
              <span className="ml-2 px-1.5 py-0.5 rounded font-bold" style={{ background: theme.accent.green + "20", color: theme.accent.green }}>
                {dateExpiries.length} EXPIRY{dateExpiries.length > 1 ? "IES" : ""} AVAILABLE
              </span>
            )}
          </div>
          <input type="range" min={0} max={Math.max(histData.candles.length - 1, 0)} value={candleIdx}
            onChange={e => setCandleIdx(Number(e.target.value))} className="w-full" />
        </div>

        {hasRealData && (
          <div className="space-y-2">
            <div className="text-sm" style={{ color: theme.text.muted }}>Select expiry contract:</div>
            <div className="flex flex-wrap gap-1">
              {dateExpiries.map(exp => (
                <button key={exp} onClick={() => setSelectedExpiry(exp)}
                  className="px-3 py-1.5 rounded-lg text-sm font-bold"
                  style={{ background: selectedExpiry === exp ? theme.accent.green : theme.bg.surfaceAlt, color: selectedExpiry === exp ? theme.bg.page : theme.text.muted, border: `1px solid ${theme.border.subtle}` }}>
                  {fmtExpiryLabel(exp)}
                </button>
              ))}
            </div>
            <button onClick={loadRealArchivedChain} disabled={chainLoading || !selectedExpiry}
              className="w-full py-2 rounded-lg text-sm font-black"
              style={{ background: theme.accent.green, color: theme.bg.page, opacity: chainLoading ? 0.7 : 1 }}>
              {chainLoading ? "Loading..." : `✓ Load REAL saved chain — ${selectedExpiry ? fmtExpiryLabel(selectedExpiry) : "..."} expiry`}
            </button>
          </div>
        )}

        <div>
          <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Expiry for reconstruction</div>
          <div className="flex gap-1 mb-2">
            {EXPIRY_PRESETS.map(p => (
              <button key={p.label} onClick={() => setChainDte(p.days)}
                className="px-3 py-1 rounded-lg text-sm font-bold"
                style={{ background: chainDte === p.days ? theme.accent.orange : theme.bg.surfaceAlt, color: chainDte === p.days ? theme.bg.page : theme.text.muted, border: `1px solid ${theme.border.subtle}` }}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Assumed IV %</div>
              <input type="number" min={1} max={100} value={chainIv} onChange={e => setChainIv(Number(e.target.value))}
                className="w-full px-2 py-1.5 rounded-lg text-sm outline-none text-center"
                style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color: theme.accent.purple }} />
            </div>
            <div>
              <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Days to Expiry</div>
              <input type="number" min={1} max={90} value={chainDte} onChange={e => setChainDte(Number(e.target.value))}
                className="w-full px-2 py-1.5 rounded-lg text-sm outline-none text-center"
                style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color: theme.accent.orange }} />
            </div>
          </div>
        </div>

        <button onClick={loadHistoricalChain} disabled={chainLoading}
          className="w-full py-2 rounded-lg text-sm font-black"
          style={{ background: theme.accent.purple, color: theme.bg.page, opacity: chainLoading ? 0.7 : 1 }}>
          {chainLoading ? "Building chain..." : "▶ View Reconstructed Chain (Black-Scholes)"}
        </button>

        {chainError && <ErrorBox message="Failed to load option chain for this date" />}
        {legMsg && (
          <div className="text-sm text-center py-1.5 rounded-lg flex items-center justify-center gap-2"
            style={{ background: theme.accent.green + "15", color: theme.accent.green }}>
            {legMsg}
            <button onClick={() => navigate("/simulator")} className="underline font-bold">Open Simulator</button>
          </div>
        )}

        {chainData && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm px-1">
              <span style={{ color: theme.text.muted }}>
                {chainIsReal ? `${chainData.date} • expiry ${fmtExpiryLabel(chainData.expiry)}` : chainData.label}
              </span>
              <span className="px-2 py-0.5 rounded font-bold"
                style={{ background: chainIsReal ? theme.accent.green + "20" : theme.accent.orange + "20", color: chainIsReal ? theme.accent.green : theme.accent.orange }}>
                {chainIsReal ? "✓ REAL saved data" : "Reconstructed (Black-Scholes)"}
              </span>
            </div>
            {activeOptional.length > 0 && (
              <div className="grid text-center px-1 font-semibold sticky top-0"
                style={{ gridTemplateColumns: gridTemplate, fontSize: 10, color: theme.text.faint, background: theme.bg.surfaceAlt }}>
                {activeOptional.map(c => <div key={c.key} style={{ color: theme.accent.green }}>CE {CHAIN_COLUMN_LABELS[c.key]}</div>)}
                <div style={{ color: theme.accent.green }}>CE LTP</div>
                <div style={{ color: theme.accent.cyan }}>STRIKE</div>
                <div style={{ color: theme.accent.red }}>PE LTP</div>
                {activeOptional.map(c => <div key={c.key} style={{ color: theme.accent.red }}>PE {CHAIN_COLUMN_LABELS[c.key]}</div>)}
              </div>
            )}
            <div className="max-h-[420px] overflow-y-auto space-y-0.5 pr-1">
              {(chainData.data.expiryData as AnyChainRow[]).map((row, i) => (
                <div key={i} className="grid text-center rounded-md"
                  style={{ gridTemplateColumns: gridTemplate, background: row.atm ? theme.accent.cyan + "12" : i % 2 === 0 ? theme.bg.surface : theme.bg.surfaceAlt, border: row.atm ? `1px solid ${theme.accent.cyan}40` : "1px solid transparent", padding: "6px 2px", fontSize: 12 }}>
                  {activeOptional.map(c => { const v = (row as any)[`ce_${c.field}`]; return <div key={c.key} style={{ color: theme.text.faint }}>{v != null ? c.fmt(v) : "-"}</div>; })}
                  <div>
                    <div style={{ color: theme.accent.green, fontWeight: row.atm ? 800 : 600 }}>₹{fmt(row.ce_ltp)}</div>
                    {row.ce_ltp != null && (
                      <div className="flex gap-1 justify-center mt-0.5">
                        <button onClick={() => handleAddLeg(row, "CE", "BUY")} className="text-xs px-1.5 rounded font-bold" style={{ background: theme.accent.green + "20", color: theme.accent.green }}>B</button>
                        <button onClick={() => handleAddLeg(row, "CE", "SELL")} className="text-xs px-1.5 rounded font-bold" style={{ background: theme.accent.red + "20", color: theme.accent.red }}>S</button>
                      </div>
                    )}
                  </div>
                  <div style={{ color: row.atm ? theme.accent.cyan : theme.text.secondary, fontWeight: 700, background: row.atm ? theme.accent.cyan + "15" : "none", borderRadius: 4 }}>{row.strike}</div>
                  <div>
                    <div style={{ color: theme.accent.red, fontWeight: row.atm ? 800 : 600 }}>₹{fmt(row.pe_ltp)}</div>
                    {row.pe_ltp != null && (
                      <div className="flex gap-1 justify-center mt-0.5">
                        <button onClick={() => handleAddLeg(row, "PE", "BUY")} className="text-xs px-1.5 rounded font-bold" style={{ background: theme.accent.green + "20", color: theme.accent.green }}>B</button>
                        <button onClick={() => handleAddLeg(row, "PE", "SELL")} className="text-xs px-1.5 rounded font-bold" style={{ background: theme.accent.red + "20", color: theme.accent.red }}>S</button>
                      </div>
                    )}
                  </div>
                  {activeOptional.map(c => { const v = (row as any)[`pe_${c.field}`]; return <div key={c.key} style={{ color: theme.text.faint }}>{v != null ? c.fmt(v) : "-"}</div>; })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
