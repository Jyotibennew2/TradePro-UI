import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPortfolio, placePaperOrder, exitPaperOrder } from "../utils/api";
import { useAppStore } from "../store";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Loader from "../components/ui/Loader";
import ErrorBox from "../components/ui/ErrorBox";
import { PlusCircle, LogOut } from "lucide-react";

const SYMBOLS = ["NIFTY", "BANKNIFTY"];

export default function PaperTrade() {
  const qc = useQueryClient();
  const { nifty, bankNifty } = useAppStore();

  const [symbol,     setSymbol]     = useState("NIFTY");
  const [optType,    setOptType]    = useState("CE");
  const [strike,     setStrike]     = useState("");
  const [expiry,     setExpiry]     = useState("");
  const [action,     setAction]     = useState("BUY");
  const [qty,        setQty]        = useState("1");
  const [entryPrice, setEntryPrice] = useState("");
  const [sl,         setSl]         = useState("");
  const [target,     setTarget]     = useState("");
  const [msg,        setMsg]        = useState("");

  const ltp = symbol === "NIFTY" ? nifty : bankNifty;

  const { data, isLoading, isError } = useQuery({
    queryKey      : ["portfolio"],
    queryFn       : fetchPortfolio,
    refetchInterval: 3000,
  });

  const place = useMutation({
    mutationFn: placePaperOrder,
    onSuccess : (d) => {
      if (d.success) {
        setMsg(`✅ Order placed: ${d.order_id}`);
        qc.invalidateQueries({ queryKey: ["portfolio"] });
      } else {
        setMsg(`❌ ${d.error}`);
      }
    },
    onError: () => setMsg("❌ Failed to place order"),
  });

  const exit = useMutation({
    mutationFn: ({ id, price }: { id: string; price: number }) =>
      exitPaperOrder(id, price),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolio"] }),
  });

  const handlePlace = () => {
    if (!strike || !entryPrice) {
      setMsg("❌ Strike and Entry Price required");
      return;
    }
    place.mutate({
      symbol, option_type: optType,
      strike      : Number(strike),
      expiry      : expiry || "",
      action,
      qty         : Number(qty),
      entry_price : Number(entryPrice),
      sl          : Number(sl)     || 0,
      target      : Number(target) || 0,
    });
  };

  const p = data?.data;
  const fmt = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

  return (
    <div className="p-4 space-y-4">
      {/* Portfolio summary */}
      {isLoading && <Loader text="Loading portfolio..." />}
      {isError   && <ErrorBox message="Failed to load portfolio" />}

      {p && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Capital",    value: `₹${fmt(p.capital)}`,        color: "#c0d0e8" },
            { label: "Available",  value: `₹${fmt(p.available)}`,      color: "#00d97e" },
            { label: "Unrealized", value: `₹${fmt(p.unrealized_pnl)}`, color: p.unrealized_pnl >= 0 ? "#00d97e" : "#f03060" },
            { label: "Realized",   value: `₹${fmt(p.realized_pnl)}`,   color: p.realized_pnl   >= 0 ? "#00d97e" : "#f03060" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl p-3 text-center"
              style={{ background: "#090f1e", border: "1px solid #0f1e36" }}>
              <div className="text-xs mb-1" style={{ color: "#445566" }}>{label}</div>
              <div className="text-sm font-bold" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Place order form */}
      <Card title="Place Order">
        <div className="space-y-3">
          {/* Symbol + Type */}
          <div className="flex gap-2">
            <div className="flex rounded-lg overflow-hidden flex-1"
              style={{ border: "1px solid #0f1e36" }}>
              {SYMBOLS.map(s => (
                <button key={s} onClick={() => setSymbol(s)}
                  className="flex-1 py-1.5 text-xs font-bold"
                  style={{
                    background: symbol === s ? "#00c8f0" : "#090f1e",
                    color     : symbol === s ? "#03050d" : "#445566",
                  }}>
                  {s}
                </button>
              ))}
            </div>
            <div className="flex rounded-lg overflow-hidden"
              style={{ border: "1px solid #0f1e36" }}>
              {["CE", "PE"].map(t => (
                <button key={t} onClick={() => setOptType(t)}
                  className="px-3 py-1.5 text-xs font-bold"
                  style={{
                    background: optType === t ? (t === "CE" ? "#00d97e" : "#f03060") : "#090f1e",
                    color     : optType === t ? "#03050d" : "#445566",
                  }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* BUY / SELL */}
          <div className="flex rounded-lg overflow-hidden"
            style={{ border: "1px solid #0f1e36" }}>
            {["BUY", "SELL"].map(a => (
              <button key={a} onClick={() => setAction(a)}
                className="flex-1 py-1.5 text-xs font-bold"
                style={{
                  background: action === a ? (a === "BUY" ? "#00d97e" : "#f03060") : "#090f1e",
                  color     : action === a ? "#03050d" : "#445566",
                }}>
                {a}
              </button>
            ))}
          </div>

          {/* Spot display */}
          <div className="text-xs text-center" style={{ color: "#445566" }}>
            {symbol} Spot: <span style={{ color: "#00c8f0" }}>{ltp > 0 ? ltp.toLocaleString("en-IN") : "---"}</span>
          </div>

          {/* Inputs */}
          {[
            { label: "Strike",      value: strike,     setter: setStrike,     ph: "e.g. 24300" },
            { label: "Entry Price", value: entryPrice, setter: setEntryPrice, ph: "e.g. 150"   },
            { label: "Quantity (lots)", value: qty,    setter: setQty,        ph: "1"          },
            { label: "Stop Loss",   value: sl,         setter: setSl,         ph: "Optional"   },
            { label: "Target",      value: target,     setter: setTarget,     ph: "Optional"   },
            { label: "Expiry",      value: expiry,     setter: setExpiry,     ph: "Optional"   },
          ].map(({ label, value, setter, ph }) => (
            <div key={label}>
              <div className="text-xs mb-1" style={{ color: "#445566" }}>{label}</div>
              <input
                type="text"
                value={value}
                onChange={e => setter(e.target.value)}
                placeholder={ph}
                className="w-full px-3 py-1.5 rounded-lg text-xs outline-none"
                style={{ background: "#060c1a", border: "1px solid #0f1e36", color: "#c0d0e8" }}
              />
            </div>
          ))}

          {/* Message */}
          {msg && (
            <div className="text-xs p-2 rounded-lg"
              style={{
                background: msg.startsWith("✅") ? "#00d97e10" : "#f0306010",
                color     : msg.startsWith("✅") ? "#00d97e"   : "#f03060",
                border    : `1px solid ${msg.startsWith("✅") ? "#00d97e30" : "#f0306030"}`,
              }}>
              {msg}
            </div>
          )}

          {/* Place button */}
          <button onClick={handlePlace} disabled={place.isPending}
            className="w-full py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
            style={{
              background: action === "BUY" ? "#00d97e" : "#f03060",
              color     : "#03050d",
              opacity   : place.isPending ? 0.7 : 1,
            }}>
            <PlusCircle size={14} />
            {place.isPending ? "Placing..." : `${action} ${symbol} ${optType}`}
          </button>
        </div>
      </Card>

      {/* Open positions */}
      {p && p.open_positions.length > 0 && (
        <Card title={`Open Positions (${p.open_count})`}>
          <div className="space-y-2">
            {p.open_positions.map((pos: any) => (
              <div key={pos.order_id} className="rounded-lg p-3"
                style={{ background: "#060c1a", border: "1px solid #0f1e36" }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold" style={{ color: "#c0d0e8" }}>
                      {pos.symbol} {pos.strike} {pos.option_type}
                    </span>
                    <Badge label={pos.action} variant={pos.action.toLowerCase() as "buy" | "sell"} />
                  </div>
                  <button
                    onClick={() => exit.mutate({ id: pos.order_id, price: pos.entry_price })}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                    style={{ background: "#f0306020", color: "#f03060" }}>
                    <LogOut size={10} /> Exit
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1 text-xs" style={{ color: "#445566" }}>
                  <span>Qty: <span style={{ color: "#c0d0e8" }}>{pos.qty}</span></span>
                  <span>Entry: <span style={{ color: "#c0d0e8" }}>₹{pos.entry_price}</span></span>
                  <span style={{ color: pos.mtm >= 0 ? "#00d97e" : "#f03060" }}>
                    MTM: ₹{pos.mtm?.toFixed(1) ?? 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
