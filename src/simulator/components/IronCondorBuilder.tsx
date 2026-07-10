import { useState, useMemo } from "react";
import { bsPrice } from "../pricing/BlackScholes";
import { STRIKE_STEPS, LOT_SIZES } from "../models/Option";
import type { UnderlyingType } from "../models/Option";

interface Props {
  underlying: UnderlyingType; spot: number; iv: number;
  daysToExpiry: number; r: number; lots: number;
  onBuild: (opts: { callInner: number; callWing: number; putInner: number; putWing: number }) => void;
}

function prem(spot: number, strike: number, T: number, r: number, iv: number, type: "CE" | "PE") {
  return Math.max(Math.round(bsPrice(spot, strike, T, r / 100, iv / 100, type) * 20) / 20, 0.05);
}

function Ctrl({ label, val, set }: { label: string; val: number; set: (v: number) => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0" }}>
      <span style={{ color: "#445566", fontSize: 11 }}>{label}</span>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <button onClick={() => set(Math.max(1, val - 1))} style={{ background: "#0f1e36", color: "#aaa", border: "none", borderRadius: 4, width: 24, height: 24, cursor: "pointer", fontSize: 16 }}>-</button>
        <b style={{ color: "#00c8f0", minWidth: 18, textAlign: "center" }}>{val}</b>
        <button onClick={() => set(Math.min(8, val + 1))} style={{ background: "#0f1e36", color: "#aaa", border: "none", borderRadius: 4, width: 24, height: 24, cursor: "pointer", fontSize: 16 }}>+</button>
      </div>
    </div>
  );
}

export default function IronCondorBuilder({ underlying, spot, iv, daysToExpiry, r, lots, onBuild }: Props) {
  const [callInner, setCallInner] = useState(2);
  const [callWing,  setCallWing]  = useState(2);
  const [putInner,  setPutInner]  = useState(2);
  const [putWing,   setPutWing]   = useState(2);

  const step    = STRIKE_STEPS[underlying];
  const lotSize = LOT_SIZES[underlying];
  const A       = Math.round(spot / step) * step;
  const T       = daysToExpiry / 365;

  const shortCE = A + step * callInner;
  const longCE  = A + step * (callInner + callWing);
  const shortPE = A - step * putInner;
  const longPE  = A - step * (putInner + putWing);

  const p = useMemo(() => ({
    sCE: prem(spot, shortCE, T, r, iv, "CE"),
    lCE: prem(spot, longCE,  T, r, iv, "CE"),
    sPE: prem(spot, shortPE, T, r, iv, "PE"),
    lPE: prem(spot, longPE,  T, r, iv, "PE"),
  }), [spot, shortCE, longCE, shortPE, longPE, T, r, iv]);

  const net  = +(p.sCE - p.lCE + p.sPE - p.lPE).toFixed(2);
  const maxP = Math.round(net * lots * lotSize);
  const maxL = Math.round((Math.max(callWing, putWing) * step - net) * lots * lotSize);
  const card = { background: "#090f1e", border: "1px solid #0f1e36", borderRadius: 8, padding: "6px 8px", textAlign: "center" as const };

  return (
    <div style={{ fontSize: 12, padding: 4 }}>
      <table style={{ width: "100%", marginBottom: 10, borderCollapse: "collapse" }}>
        <thead><tr style={{ color: "#334455" }}>
          <th style={{ textAlign: "left" }}>Action</th>
          <th style={{ textAlign: "left" }}>Strike</th>
          <th style={{ textAlign: "right" }}>Premium</th>
        </tr></thead>
        <tbody>
          <tr><td style={{ color: "#f03060", fontWeight: "bold", padding: "3px 0" }}>SELL CE</td><td style={{ color: "#c0d0e8" }}>Rs.{shortCE.toLocaleString("en-IN")}</td><td style={{ color: "#00c8f0", textAlign: "right" }}>Rs.{p.sCE.toFixed(2)}</td></tr>
          <tr><td style={{ color: "#00d97e", fontWeight: "bold", padding: "3px 0" }}>BUY  CE</td><td style={{ color: "#c0d0e8" }}>Rs.{longCE.toLocaleString("en-IN")}</td><td style={{ color: "#00c8f0", textAlign: "right" }}>Rs.{p.lCE.toFixed(2)}</td></tr>
          <tr><td style={{ color: "#f03060", fontWeight: "bold", padding: "3px 0" }}>SELL PE</td><td style={{ color: "#c0d0e8" }}>Rs.{shortPE.toLocaleString("en-IN")}</td><td style={{ color: "#00c8f0", textAlign: "right" }}>Rs.{p.sPE.toFixed(2)}</td></tr>
          <tr><td style={{ color: "#00d97e", fontWeight: "bold", padding: "3px 0" }}>BUY  PE</td><td style={{ color: "#c0d0e8" }}>Rs.{longPE.toLocaleString("en-IN")}</td><td style={{ color: "#00c8f0", textAlign: "right" }}>Rs.{p.lPE.toFixed(2)}</td></tr>
        </tbody>
      </table>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div>
          <div style={{ color: "#334455", fontSize: 10, marginBottom: 4 }}>CALL SIDE</div>
          <Ctrl label="Inner" val={callInner} set={setCallInner} />
          <Ctrl label="Wing"  val={callWing}  set={setCallWing} />
        </div>
        <div>
          <div style={{ color: "#334455", fontSize: 10, marginBottom: 4 }}>PUT SIDE</div>
          <Ctrl label="Inner" val={putInner} set={setPutInner} />
          <Ctrl label="Wing"  val={putWing}  set={setPutWing} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
        <div style={card}><div style={{ color: "#334455", fontSize: 9 }}>Net Credit</div><b style={{ color: "#00d97e" }}>Rs.{net}</b></div>
        <div style={card}><div style={{ color: "#334455", fontSize: 9 }}>Max Profit</div><b style={{ color: "#00d97e" }}>+Rs.{maxP.toLocaleString("en-IN")}</b></div>
        <div style={card}><div style={{ color: "#334455", fontSize: 9 }}>Max Loss</div><b style={{ color: "#f03060" }}>-Rs.{Math.max(0,maxL).toLocaleString("en-IN")}</b></div>
      </div>

      <button onClick={() => onBuild({ callInner, callWing, putInner, putWing })}
        style={{ width: "100%", padding: 10, borderRadius: 12, background: "linear-gradient(135deg,#00c8f015,#9b5cf615)", color: "#00c8f0", border: "1px solid #00c8f040", fontSize: 13, fontWeight: "bold", cursor: "pointer" }}>
        Add Iron Condor Legs
      </button>
    </div>
  );
}
