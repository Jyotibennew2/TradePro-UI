import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/ui/Card";
import { useTheme } from "../store/themeStore";

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
  const theme = useTheme();
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
                background: view === v.key ? theme.accent.cyan + "20" : theme.bg.surfaceAlt,
                color     : view === v.key ? theme.accent.cyan : theme.text.muted,
                border    : `1px solid ${view === v.key ? theme.accent.cyan : theme.border.subtle}`,
              }}>
              <span>{v.icon}</span> {v.label}
            </button>
          ))}
        </div>
      </Card>

      {view === "volatile" ? (
        <Card title="Recommended Approach">
          <div className="text-center py-8" style={{ color: theme.text.muted }}>
            <div className="text-3xl mb-2">⚡</div>
            <div className="text-sm mb-2" style={{ color: theme.text.secondary }}>
              Volatile view ke liye Long Straddle / Long Strangle sabse best hai
              (bade move ka fayda, dono taraf).
            </div>
            <div className="text-sm">
              Abhi ye templates builder me nahi hai — Simulator ke "Custom Strategy"
              mode me jaake <b style={{ color: theme.accent.cyan }}>BUY CE</b> + <b style={{ color: theme.accent.cyan }}>BUY PE</b> (same strike)
              add karke khud bana sakte hai.
            </div>
            <button onClick={() => navigate("/simulator")}
              className="mt-4 px-4 py-2 rounded-lg text-sm font-bold"
              style={{ background: theme.accent.cyan, color: theme.bg.page }}>
              Open Simulator →
            </button>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {matches.map(s => (
            <Card key={s.key} title={s.name}>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-sm px-2 py-0.5 rounded"
                  style={{ background: theme.border.subtle, color: theme.text.secondary }}>
                  {s.legs} {s.legs === 1 ? "Leg" : "Legs"}
                </span>
                <span className="text-sm px-2 py-0.5 rounded"
                  style={{
                    background: s.risk === "Defined Risk" ? theme.accent.green + "20" : theme.accent.red + "20",
                    color     : s.risk === "Defined Risk" ? theme.accent.green : theme.accent.red,
                  }}>
                  {s.risk}
                </span>
                <span className="text-sm px-2 py-0.5 rounded"
                  style={{ background: theme.accent.purple + "20", color: theme.accent.purple }}>
                  {s.ivPref}
                </span>
              </div>
              <div className="text-sm mb-3" style={{ color: theme.text.muted }}>{s.note}</div>
              <button onClick={() => navigate("/simulator", { state: { template: s.key } })}
                className="w-full py-2 rounded-lg text-sm font-bold"
                style={{ background: theme.accent.cyan + "15", color: theme.accent.cyan, border: `1px solid ${theme.accent.cyan}30` }}>
                Open in Simulator → select "{s.name}"
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
