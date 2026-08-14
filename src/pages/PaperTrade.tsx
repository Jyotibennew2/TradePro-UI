import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPortfolio, placePaperOrder, exitPaperOrder, fetchHistory } from "../utils/api";
import { useAppStore } from "../store";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Loader from "../components/ui/Loader";
import ErrorBox from "../components/ui/ErrorBox";
import { PlusCircle, LogOut } from "lucide-react";
import { useTheme } from "../store/themeStore";

const SYMBOLS = ["NIFTY", "BANKNIFTY"];

export default function PaperTrade() {
  const theme = useTheme();
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

  // Closed trade history - previously only used to build Dashboard's equity
  // curve, not shown as a list anywhere. Genuine gap: a trader has no way
  // to review what actually closed and why on this page.
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey       : ["history"],
    queryFn        : () => fetchHistory(30),
    refetchInterval: 5000,
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio"] });
      qc.invalidateQueries({ queryKey: ["history"] });
    },
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
  const history = [...(historyData?.data ?? [])].reverse(); // most recent first
  const fmt = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

  return (
    <div className="p-4 space-y-4">
      {/* Portfolio summary */}
      {isLoading && <Loader text="Loading portfolio..." />}
      {isError   && <ErrorBox message="Failed to load portfolio" />}

      {p && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Capital",    value: `₹${fmt(p.capital)}`,        color: theme.text.secondary },
            { label: "Available",  value: `₹${fmt(p.available)}`,      color: theme.accent.green },
            { label: "Unrealized", value: `₹${fmt(p.unrealized_pnl)}`, color: p.unrealized_pnl >= 0 ? theme.accent.green : theme.accent.red },
            { label: "Realized",   value: `₹${fmt(p.realized_pnl)}`,   color: p.realized_pnl   >= 0 ? theme.accent.green : theme.accent.red },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl p-3 text-center"
              style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}` }}>
              <div className="text-sm mb-1" style={{ color: theme.text.muted }}>{label}</div>
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
              style={{ border: `1px solid ${theme.border.subtle}` }}>
              {SYMBOLS.map(s => (
                <button key={s} onClick={() => setSymbol(s)}
                  className="flex-1 py-1.5 text-sm font-bold"
                  style={{
                    background: symbol === s ? theme.accent.cyan : theme.bg.surfaceAlt,
                    color     : symbol === s ? theme.bg.page : theme.text.muted,
                  }}>
                  {s}
                </button>
              ))}
            </div>
            <div className="flex rounded-lg overflow-hidden"
              style={{ border: `1px solid ${theme.border.subtle}` }}>
              {["CE", "PE"].map(t => (
                <button key={t} onClick={() => setOptType(t)}
                  className="px-3 py-1.5 text-sm font-bold"
                  style={{
                    background: optType === t ? (t === "CE" ? theme.accent.green : theme.accent.red) : theme.bg.surfaceAlt,
                    color     : optType === t ? theme.bg.page : theme.text.muted,
                  }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* BUY / SELL */}
          <div className="flex rounded-lg overflow-hidden"
            style={{ border: `1px solid ${theme.border.subtle}` }}>
            {["BUY", "SELL"].map(a => (
              <button key={a} onClick={() => setAction(a)}
                className="flex-1 py-1.5 text-sm font-bold"
                style={{
                  background: action === a ? (a === "BUY" ? theme.accent.green : theme.accent.red) : theme.bg.surfaceAlt,
                  color     : action === a ? theme.bg.page : theme.text.muted,
                }}>
                {a}
              </button>
            ))}
          </div>

          {/* Spot display */}
          <div className="text-sm text-center" style={{ color: theme.text.muted }}>
            {symbol} Spot: <span style={{ color: theme.accent.cyan }}>{ltp > 0 ? ltp.toLocaleString("en-IN") : "---"}</span>
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
              <div className="text-sm mb-1" style={{ color: theme.text.muted }}>{label}</div>
              <input
                type="text"
                value={value}
                onChange={e => setter(e.target.value)}
                placeholder={ph}
                className="w-full px-3 py-1.5 rounded-lg text-sm outline-none"
                style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color: theme.text.secondary }}
              />
            </div>
          ))}

          {/* Message */}
          {msg && (
            <div className="text-sm p-2 rounded-lg"
              style={{
                background: msg.startsWith("✅") ? theme.accent.green + "10" : theme.accent.red + "10",
                color     : msg.startsWith("✅") ? theme.accent.green   : theme.accent.red,
                border    : `1px solid ${msg.startsWith("✅") ? theme.accent.green + "30" : theme.accent.red + "30"}`,
              }}>
              {msg}
            </div>
          )}

          {/* Place button */}
          <button onClick={handlePlace} disabled={place.isPending}
            className="w-full py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2"
            style={{
              background: action === "BUY" ? theme.accent.green : theme.accent.red,
              color     : theme.bg.page,
              opacity   : place.isPending ? 0.7 : 1,
            }}>
            <PlusCircle size={16} />
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
                style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}` }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-bold" style={{ color: theme.text.secondary }}>
                      {pos.symbol} {pos.strike} {pos.option_type}
                    </span>
                    <Badge label={pos.action} variant={pos.action.toLowerCase() as "buy" | "sell"} />
                  </div>
                  <button
                    onClick={() => exit.mutate({ id: pos.order_id, price: pos.entry_price })}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-sm"
                    style={{ background: theme.accent.red + "20", color: theme.accent.red }}>
                    <LogOut size={13} /> Exit
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1 text-sm" style={{ color: theme.text.muted }}>
                  <span>Qty: <span style={{ color: theme.text.secondary }}>{pos.qty}</span></span>
                  <span>Entry: <span style={{ color: theme.text.secondary }}>₹{pos.entry_price}</span></span>
                  <span style={{ color: pos.mtm >= 0 ? theme.accent.green : theme.accent.red }}>
                    MTM: ₹{pos.mtm?.toFixed(1) ?? 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Trade history - closed trades (previously nowhere on this page,
          even though the data was already available and used elsewhere) */}
      <Card title="Trade History">
        {historyLoading ? <Loader text="Loading history..." /> : history.length === 0 ? (
          <div className="text-sm text-center py-6" style={{ color: theme.text.muted }}>
            No closed trades yet.
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((t) => (
              <div key={t.order_id} className="rounded-lg p-3"
                style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}` }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-bold" style={{ color: theme.text.secondary }}>
                      {t.symbol} {t.strike} {t.option_type}
                    </span>
                    <Badge label={t.action} variant={t.action.toLowerCase() as "buy" | "sell"} />
                    <span className="text-sm px-1.5 py-0.5 rounded"
                      style={{ color: theme.text.faint, background: theme.border.subtle }}>
                      {t.status}
                    </span>
                  </div>
                  <span className="text-sm font-bold" style={{ color: t.pnl >= 0 ? theme.accent.green : theme.accent.red }}>
                    {t.pnl >= 0 ? "+" : ""}₹{fmt(t.pnl)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-sm" style={{ color: theme.text.muted }}>
                  <span>Qty: <span style={{ color: theme.text.secondary }}>{t.qty}</span></span>
                  <span>Entry: <span style={{ color: theme.text.secondary }}>₹{t.entry_price}</span></span>
                  <span>Exit: <span style={{ color: theme.text.secondary }}>₹{t.exit_price}</span></span>
                </div>
                <div className="text-sm mt-1" style={{ color: theme.text.faint }}>
                  {t.entry_time} → {t.exit_time}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
