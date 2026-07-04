import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchChain } from "../utils/api";
import Loader from "../components/ui/Loader";
import ErrorBox from "../components/ui/ErrorBox";
import { RefreshCw } from "lucide-react";

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

export default function OptionChain() {
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
        style={{ borderColor: "#0f1e36" }}>
        {/* Symbol toggle */}
        <div className="flex rounded-lg overflow-hidden"
          style={{ border: "1px solid #0f1e36" }}>
          {SYMBOLS.map(s => (
            <button key={s} onClick={() => { setSymbol(s); setExpiry(""); }}
              className="px-3 py-1 text-xs font-bold transition-all"
              style={{
                background: symbol === s ? "#00c8f0" : "#090f1e",
                color     : symbol === s ? "#03050d" : "#445566",
              }}>
              {s}
            </button>
          ))}
        </div>

        {/* Expiry */}
        {expiries.length > 0 && (
          <select value={expiry} onChange={e => setExpiry(e.target.value)}
            className="text-xs px-2 py-1 rounded-lg outline-none"
            style={{ background: "#090f1e", border: "1px solid #0f1e36", color: "#c0d0e8" }}>
            <option value="">Nearest</option>
            {expiries.map((e: any) => (
              <option key={e.expiry} value={e.expiry}>{e.date}</option>
            ))}
          </select>
        )}

        {/* Spot */}
        <span className="text-xs" style={{ color: "#445566" }}>
          Spot: <span style={{ color: "#00c8f0", fontWeight: 700 }}>
            {spot > 0 ? spot.toLocaleString("en-IN") : "---"}
          </span>
        </span>

        {/* Mock badge */}
        <span className="text-xs px-2 py-0.5 rounded ml-auto"
          style={{ background: isMock ? "#f0a03020" : "#00d97e20", color: isMock ? "#f0a030" : "#00d97e" }}>
          {isMock ? "MOCK" : "LIVE"}
        </span>

        {/* Refresh */}
        <button onClick={() => refetch()}
          className="p-1.5 rounded-lg transition-all"
          style={{ background: "#0f1e36", color: "#00c8f0" }}>
          <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-2">
        {isLoading && <Loader text="Loading option chain..." />}
        {isError   && <ErrorBox message="Failed to load option chain" />}

        {rows.length > 0 && (
          <>
            {/* Header */}
            <div className="grid text-center mb-2 px-1"
              style={{ gridTemplateColumns: "1fr 1fr 1fr 72px 1fr 1fr 1fr", fontSize: 9, color: "#334455" }}>
              <div style={{ color: "#00d97e88" }}>CE OI</div>
              <div style={{ color: "#00d97e88" }}>CE IV</div>
              <div style={{ color: "#00d97e"   }}>CE LTP</div>
              <div style={{ color: "#00c8f0"   }}>STRIKE</div>
              <div style={{ color: "#f03060"   }}>PE LTP</div>
              <div style={{ color: "#f0306088" }}>PE IV</div>
              <div style={{ color: "#f0306088" }}>PE OI</div>
            </div>

            {/* Rows */}
            {rows.map((row: any, i: number) => {
              const isAtm = i === atmIndex || row.atm;
              return (
                <div key={i}
                  className="grid text-center mb-0.5 rounded-md"
                  style={{
                    gridTemplateColumns: "1fr 1fr 1fr 72px 1fr 1fr 1fr",
                    background : isAtm ? "#0d1f38" : i % 2 === 0 ? "#060c1a" : "#070e1c",
                    border     : isAtm ? "1px solid #00c8f040" : "1px solid transparent",
                    padding    : "5px 2px",
                    fontSize   : 11,
                  }}>
                  <div style={{ color: "#00d97e88" }}>{fmtOI(row.ce_oi)}</div>
                  <div style={{ color: "#00c8f077" }}>{row.ce_iv ? row.ce_iv.toFixed(1) + "%" : "-"}</div>
                  <div style={{ color: "#00d97e", fontWeight: isAtm ? 800 : 500 }}>
                    {row.ce_ltp != null ? "₹" + fmt(row.ce_ltp) : "-"}
                  </div>
                  <div style={{
                    color     : isAtm ? "#00c8f0" : "#8899aa",
                    fontWeight: 700,
                    background: isAtm ? "#00c8f015" : "none",
                    borderRadius: 4,
                  }}>
                    {row.strike}
                  </div>
                  <div style={{ color: "#f03060", fontWeight: isAtm ? 800 : 500 }}>
                    {row.pe_ltp != null ? "₹" + fmt(row.pe_ltp) : "-"}
                  </div>
                  <div style={{ color: "#f0306077" }}>{row.pe_iv ? row.pe_iv.toFixed(1) + "%" : "-"}</div>
                  <div style={{ color: "#f0306088" }}>{fmtOI(row.pe_oi)}</div>
                </div>
              );
            })}
          </>
        )}

        {!isLoading && rows.length === 0 && (
          <div className="text-center py-16" style={{ color: "#445566" }}>
            <div className="text-3xl mb-2">📭</div>
            <div className="text-sm">No data available</div>
          </div>
        )}
      </div>
    </div>
  );
}
