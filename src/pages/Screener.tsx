import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/ui/Card";

type View = "bullish" | "bearish" | "sideways" | "volatile";
type Risk = "Defined Risk" | "Undefined Risk";

interface StrategyInfo {
  key      : string;
  name     : string;
  legs     : number;
  risk     : Risk;
  ivPref   : "High IV" | "Low/Medium IV";
  views    : View[];
  note     : string;
}

const CATALOG: StrategyInfo[] = [
  { key: "LONG_CALL",        name: "Long Call",         legs: 1, risk: "Defined Risk",   ivPref: "Low/Medium IV", views: ["bullish"],            note: "Simple bullish bet. Unlimited upside, risk limited to premium paid." },
  { key: "BULL_CALL_SPREAD", name: "Bull Call Spread",  legs: 2, risk: "Defined Risk",   ivPref: "Low/Medium IV", views: ["bullish"],            note: "Moderately bullish. Cheaper than Long Call, limited profit and loss." },
  { key: "BULL_PUT_SPREAD",  name: "Bull Put Spread",   legs: 2, risk: "Defined Risk",   ivPref: "High IV",       views: ["bullish", "sideways"], note: "Credit spread. Profits if price stays above short strike." },
  { key: "SHORT_PUT",        name: "Short Put",         legs: 1, risk: "Undefined Risk", ivPref: "High IV",       views: ["bullish"],            note: "Collect premium betting price stays above strike. Risk if price falls hard." },

  { key: "LONG_PUT",         name: "Long Put",          legs: 1, risk: "Defined Risk",   ivPref: "Low/Medium IV", views: ["bearish"],            note: "Simple bearish bet. Large downside profit potential, limited risk." },
  { key: "BEAR_PUT_SPREAD",  name: "Bear Put Spread",   legs: 2, risk: "Defined Risk",   ivPref: "Low/Medium IV", views: ["bearish"],            note: "Moderately bearish. Cheaper than Long Put, limited profit and loss." },
  { key: "BEAR_CALL_SPREAD", name: "Bear Call Spread",  legs: 2, risk: "Defined Risk",   ivPref: "High IV",       views: ["bearish", "sideways"], note: "Credit spread. Profits if price stays below short strike." },
  { key: "SHORT_CALL",       name: "Short Call",        legs: 1, risk: "Undefined Risk", ivPref: "High IV",       views: ["bearish"],            note: "Collect premium betting price stays below strike. Risk if price rises hard." },

  { key: "IRON_CONDOR",      name: "Iron Condor",       legs: 4, risk: "Defined Risk",   ivPref: "High IV",       views: ["sideways"],           note: "Most popular range-bound strategy. Defined risk, steady premium income." },
  { key: "IRON_FLY",         name: "Iron Fly",          legs: 4, risk: "Defined Risk",   ivPref: "High IV",       views: ["sideways"],           note: "Tighter range than Iron Condor. Higher premium, defined risk." },
  { key: "SHORT_STRANGLE",   name: "Short Strangle",    legs: 2, risk: "Undefined Risk", ivPref: "High IV",       views: ["sideways"],           note: "Wider profit zone, high premium. Risk is undefined on a big move." },
  { key: "SHORT_STRADDLE",   name: "Short Straddle",    legs: 2, risk: "Undefined Risk", ivPref: "High IV",       views: ["sideways"],           note: "Max premium if price stays exactly at strike. High risk on big moves." },
];

const VIEWS: { key: View; label: string; icon: string }[] = [
  { key: "bullish",  label: "Bullish",  icon: "📈" },
  { key: "bearish",  label: "Bearish",  icon: "📉" },
  { key: "sideways", label: "Sideways", icon: "↔️"  },
  { key: "volatile", label: "Volatile", icon: "⚡" },
];

export default function Screener() {
  const [view, setView] = useState<View>("sideways");
  const navigate = useNavigate();

  const matches = CATALOG.filter(s => s.views.includes(view));

  return (
    <div className="p-4 space-y-4">

      <Card title="Market View">
        <div className="grid grid-cols-2 gap-2">
          {VIEWS.map(v => (
            <button key={v.key} onClick={() => setView(v.key)}
              className="py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
              style={{
                background: view === v.key ? "#00c8f020" : "#090f1e",
                color     : view === v.key ? "#00c8f0" : "#445566",
                border    : `1px solid ${view === v.key ? "#00c8f0" : "#0f1e36"}`,
              }}>
              <span>{v.icon}</span> {v.label}
            </button>
          ))}
        </div>
      </Card>

      {view === "volatile" ? (
        <Card title="Recommended Approach">
          <div className="text-center py-8" style={{ color: "#445566" }}>
            <div className="text-3xl mb-2">⚡</div>
            <div className="text-sm mb-2" style={{ color: "#c0d0e8" }}>
              Volatile view ke liye Long Straddle / Long Strangle sabse best hai
              (bade move ka fayda, dono taraf).
            </div>
            <div className="text-xs">
              Abhi ye templates builder me nahi hai — Simulator ke "Custom Strategy"
              mode me jaake <b style={{ color: "#00c8f0" }}>BUY CE</b> + <b style={{ color: "#00c8f0" }}>BUY PE</b> (same strike)
              add karke khud bana sakte hai.
            </div>
            <button onClick={() => navigate("/simulator")}
              className="mt-4 px-4 py-2 rounded-lg text-xs font-bold"
              style={{ background: "#00c8f0", color: "#03050d" }}>
              Open Simulator →
            </button>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {matches.map(s => (
            <Card key={s.key} title={s.name}>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded"
                  style={{ background: "#0f1e36", color: "#c0d0e8" }}>
                  {s.legs} {s.legs === 1 ? "Leg" : "Legs"}
                </span>
                <span className="text-xs px-2 py-0.5 rounded"
                  style={{
                    background: s.risk === "Defined Risk" ? "#00d97e20" : "#f0306020",
                    color     : s.risk === "Defined Risk" ? "#00d97e" : "#f03060",
                  }}>
                  {s.risk}
                </span>
                <span className="text-xs px-2 py-0.5 rounded"
                  style={{ background: "#9b5cf620", color: "#9b5cf6" }}>
                  {s.ivPref}
                </span>
              </div>
              <div className="text-xs mb-3" style={{ color: "#445566" }}>{s.note}</div>
              <button onClick={() => navigate("/simulator", { state: { template: s.key } })}
                className="w-full py-2 rounded-lg text-xs font-bold"
                style={{ background: "#00c8f015", color: "#00c8f0", border: "1px solid #00c8f030" }}>
                Open in Simulator → select "{s.name}"
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
