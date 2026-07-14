import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchChain } from "../utils/api";
import Loader from "../components/ui/Loader";
import ErrorBox from "../components/ui/ErrorBox";
import { RefreshCw } from "lucide-react";
import { useTheme } from "../store/themeStore";

const SYMBOLS = ["NIFTY", "BANKNIFTY"];

function parseChain(data: any, mock: boolean) {
  if (mock && data?.expiryData) return { rows: data.expiryData, atmIndex: data.atmIndex ?? 10 };
  if (!mock && data?.optionsChain) {
    const ceMap: Record<number, any> = {};
    const peMap: Record<number, any> = {};
    let spot = 0;
    data.optionsChain.forEach((item: any) => {
      if (item.option_type === "") { spot = item.ltp; return; }
      if (item.option_type === "CE") ceMap[item.strike_price] = item;
      if (item.option_type === "PE") peMap[item.strike_price] = item;
    });
    const strikes = [...new Set([...Object.keys(ceMap), ...Object.keys(peMap)])]
      .map(Number).sort((a, b) => a - b);
    const atm = Math.round(spot / 50) * 50;
    let atmIndex = 0;
    const rows = strikes.map((k, i) => {
      if (k === atm) atmIndex = i;
      return {
        strike: k,
        ce_ltp: ceMap[k]?.ltp, pe_ltp: peMap[k]?.ltp,
        ce_oi : ceMap[k]?.oi,  pe_oi : peMap[k]?.oi,
        ce_iv : 0,             pe_iv : 0,
        atm   : k === atm,
      };
    });
    return { rows, atmIndex };
  }
  return { rows: [], atmIndex: 0 };
}

type OnSelect = (strike: number, optionType: "CE" | "PE", action: "BUY" | "SELL", ltp: number) => void;

export default function OptionChain({ onSelect }: { onSelect?: OnSelect } = {}) {
  const theme = useTheme();
  const [symbol, setSymbol] = useState("NIFTY");
  const [expiry, setExpiry] = useState("");

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey      : ["chain", symbol, expiry],
    queryFn       : () => fetchChain(symbol, expiry, 10),
    refetchInterval: 5000,
  });

  const isMock   = data?.mock ?? true;
  const spot     = data?.spot ?? 0;
  const expiries = (!isMock && data?.data?.expiryData && !data.data.expiryData[0]?.strike)
    ? (data.data.expiryData as any[])
    : [];
  const { rows, atmIndex } = parseChain(data?.data, isMock);

  const fmt    = (n?: number) => n != null ? n.toLocaleString("en-IN", { maximumFractionDigits: 1 }) : "-";
  const fmtOI  = (n?: number) => n != null ? (n / 100000).toFixed(1) + "L" : "-";

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="flex items-center gap-2 p-3 border-b flex-wrap"
        style={{ borderColor: theme.border.subtle }}>
        {/* Symbol toggle */}
        <div className="flex rounded-lg overflow-hidden"
          style={{ border: `1px solid ${theme.border.subtle}` }}>
          {SYMBOLS.map(s => (
            <button key={s} onClick={() => { setSymbol(s); setExpiry(""); }}
              className="px-3 py-1 text-sm font-bold transition-all"
              style={{
                background: symbol === s ? theme.accent.cyan : theme.bg.surfaceAlt,
                color     : symbol === s ? theme.bg.page : theme.text.muted,
              }}>
              {s}
            </button>
          ))}
        </div>

        {/* Expiry */}
        {expiries.length > 0 && (
          <select value={expiry} onChange={e => setExpiry(e.target.value)}
            className="text-sm px-2 py-1 rounded-lg outline-none"
            style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}`, color: theme.text.secondary }}>
            <option value="">Nearest</option>
            {expiries.map((e: any) => (
              <option key={e.expiry} value={e.expiry}>{e.date}</option>
            ))}
          </select>
        )}

        {/* Spot */}
        <span className="text-sm" style={{ color: theme.text.muted }}>
          Spot: <span style={{ color: theme.accent.cyan, fontWeight: 700 }}>
            {spot > 0 ? spot.toLocaleString("en-IN") : "---"}
          </span>
        </span>

        {/* Mock badge */}
        <span className="text-sm px-2 py-0.5 rounded ml-auto font-bold"
          style={{ background: isMock ? theme.accent.orange + "20" : theme.accent.green + "20", color: isMock ? theme.accent.orange : theme.accent.green }}>
          {isMock ? "MOCK" : "LIVE"}
        </span>

        {/* Refresh */}
        <button onClick={() => refetch()}
          className="p-2 rounded-lg transition-all"
          style={{ background: theme.border.subtle, color: theme.accent.cyan }}>
          <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-2">
        {isLoading && <Loader text="Loading option chain..." />}
        {isError   && <ErrorBox message="Failed to load option chain" />}

        {rows.length > 0 && (
          <>
            {/* Header */}
            <div className="grid text-center mb-2 px-1 font-semibold"
              style={{ gridTemplateColumns: "1fr 1fr 1fr 76px 1fr 1fr 1fr", fontSize: 11, color: theme.text.faint }}>
              <div style={{ color: theme.accent.green }}>CE OI</div>
              <div style={{ color: theme.accent.green }}>CE IV</div>
              <div style={{ color: theme.accent.green }}>CE LTP</div>
              <div style={{ color: theme.accent.cyan  }}>STRIKE</div>
              <div style={{ color: theme.accent.red   }}>PE LTP</div>
              <div style={{ color: theme.accent.red   }}>PE IV</div>
              <div style={{ color: theme.accent.red   }}>PE OI</div>
            </div>

            {/* Rows */}
            {rows.map((row: any, i: number) => {
              const isAtm = i === atmIndex || row.atm;
              return (
                <div key={i}
                  className="grid text-center mb-0.5 rounded-md"
                  style={{
                    gridTemplateColumns: "1fr 1fr 1fr 76px 1fr 1fr 1fr",
                    background : isAtm ? theme.accent.cyan + "12" : i % 2 === 0 ? theme.bg.surface : theme.bg.surfaceAlt,
                    border     : isAtm ? `1px solid ${theme.accent.cyan}40` : "1px solid transparent",
                    padding    : "6px 2px",
                    fontSize   : 13,
                  }}>
                  <div style={{ color: theme.text.faint }}>{fmtOI(row.ce_oi)}</div>
                  <div style={{ color: theme.text.faint }}>{row.ce_iv ? row.ce_iv.toFixed(1) + "%" : "-"}</div>
                  <div>
                    <div style={{ color: theme.accent.green, fontWeight: isAtm ? 800 : 600 }}>
                      {row.ce_ltp != null ? "₹" + fmt(row.ce_ltp) : "-"}
                    </div>
                    {onSelect && row.ce_ltp != null && (
                      <div className="flex gap-1 justify-center mt-0.5">
                        <button onClick={() => onSelect(row.strike, "CE", "BUY", row.ce_ltp)}
                          className="text-xs px-1.5 rounded font-bold" style={{ background: theme.accent.green + "20", color: theme.accent.green }}>B</button>
                        <button onClick={() => onSelect(row.strike, "CE", "SELL", row.ce_ltp)}
                          className="text-xs px-1.5 rounded font-bold" style={{ background: theme.accent.red + "20", color: theme.accent.red }}>S</button>
                      </div>
                    )}
                  </div>
                  <div style={{
                    color     : isAtm ? theme.accent.cyan : theme.text.secondary,
                    fontWeight: 700,
                    background: isAtm ? theme.accent.cyan + "15" : "none",
                    borderRadius: 4,
                  }}>
                    {row.strike}
                  </div>
                  <div>
                    <div style={{ color: theme.accent.red, fontWeight: isAtm ? 800 : 600 }}>
                      {row.pe_ltp != null ? "₹" + fmt(row.pe_ltp) : "-"}
                    </div>
                    {onSelect && row.pe_ltp != null && (
                      <div className="flex gap-1 justify-center mt-0.5">
                        <button onClick={() => onSelect(row.strike, "PE", "BUY", row.pe_ltp)}
                          className="text-xs px-1.5 rounded font-bold" style={{ background: theme.accent.green + "20", color: theme.accent.green }}>B</button>
                        <button onClick={() => onSelect(row.strike, "PE", "SELL", row.pe_ltp)}
                          className="text-xs px-1.5 rounded font-bold" style={{ background: theme.accent.red + "20", color: theme.accent.red }}>S</button>
                      </div>
                    )}
                  </div>
                  <div style={{ color: theme.text.faint }}>{row.pe_iv ? row.pe_iv.toFixed(1) + "%" : "-"}</div>
                  <div style={{ color: theme.text.faint }}>{fmtOI(row.pe_oi)}</div>
                </div>
              );
            })}
          </>
        )}

        {!isLoading && rows.length === 0 && (
          <div className="text-center py-16" style={{ color: theme.text.muted }}>
            <div className="text-3xl mb-2">📭</div>
            <div className="text-sm">No data available</div>
          </div>
        )}
      </div>
    </div>
  );
}
