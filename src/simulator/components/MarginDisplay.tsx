/**
 * TradePro Simulator - Margin Display Component
 * Shows portfolio margin breakdown.
 */

import type { PortfolioMargin } from "../models/Margin";

interface Props {
  margin   : PortfolioMargin;
  available: number;
}

export default function MarginDisplay({ margin, available }: Props) {
  const {
    totalMargin, netSpan, netExposure, hedgeBenefit,
    premiumPaid, premiumReceived, netPremium,
  } = margin;

  const utilPct    = available > 0 ? Math.round((totalMargin / available) * 100) : 0;
  const sufficient = available >= totalMargin;

  const fmt = (n: number) =>
    `₹${Math.round(n).toLocaleString("en-IN")}`;

  return (
    <div className="space-y-3">
      {/* Utilization bar */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span style={{ color: "#445566" }}>Margin Utilization</span>
          <span style={{ color: sufficient ? "#00d97e" : "#f03060", fontWeight: 700 }}>
            {utilPct}%
          </span>
        </div>
        <div className="rounded-full h-1.5 overflow-hidden"
          style={{ background: "#0f1e36" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width     : `${Math.min(utilPct, 100)}%`,
              background: utilPct > 80 ? "#f03060" : utilPct > 60 ? "#f0a030" : "#00d97e",
            }}
          />
        </div>
        <div className="flex justify-between text-xs mt-1" style={{ color: "#334455" }}>
          <span>Required: {fmt(totalMargin)}</span>
          <span>Available: {fmt(available)}</span>
        </div>
      </div>

      {/* Margin breakdown */}
      <div className="space-y-1">
        {[
          { label: "SPAN Margin",    value: netSpan,          color: "#c0d0e8" },
          { label: "Exposure",       value: netExposure,      color: "#c0d0e8" },
          { label: "Hedge Benefit",  value: -hedgeBenefit,    color: "#00d97e" },
          { label: "Total Required", value: totalMargin,      color: "#f0a030", bold: true },
        ].map(({ label, value, color, bold }) => (
          <div key={label} className="flex justify-between text-xs py-1 border-b"
            style={{ borderColor: "#0f1e3620" }}>
            <span style={{ color: "#445566" }}>{label}</span>
            <span style={{ color, fontWeight: bold ? 700 : 400 }}>
              {value < 0 ? "-" : ""}{fmt(Math.abs(value))}
            </span>
          </div>
        ))}
      </div>

      {/* Premium summary */}
      <div className="rounded-lg p-2"
        style={{ background: "#060c1a", border: "1px solid #0f1e36" }}>
        <div className="text-xs mb-2" style={{ color: "#445566" }}>Premium Flow</div>
        <div className="grid grid-cols-3 gap-1 text-center text-xs">
          <div>
            <div style={{ color: "#334455" }}>Paid</div>
            <div style={{ color: "#f03060" }}>{fmt(premiumPaid)}</div>
          </div>
          <div>
            <div style={{ color: "#334455" }}>Received</div>
            <div style={{ color: "#00d97e" }}>{fmt(premiumReceived)}</div>
          </div>
          <div>
            <div style={{ color: "#334455" }}>Net</div>
            <div style={{ color: netPremium >= 0 ? "#00d97e" : "#f03060", fontWeight: 700 }}>
              {netPremium >= 0 ? "+" : ""}{fmt(netPremium)}
            </div>
          </div>
        </div>
      </div>

      {/* Status */}
      {!sufficient && (
        <div className="rounded-lg p-2 text-xs text-center"
          style={{ background: "#f0306015", border: "1px solid #f0306040", color: "#f03060" }}>
          ⚠️ Insufficient margin — shortfall {fmt(totalMargin - available)}
        </div>
      )}
    </div>
  );
}
