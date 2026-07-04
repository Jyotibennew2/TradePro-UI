/**
 * TradePro Simulator - Greeks Display Component
 * Portfolio-level Greeks summary.
 */

import type { PortfolioGreeks } from "../models/Greeks";

interface Props {
  greeks: PortfolioGreeks;
}

interface GreekItem {
  label    : string;
  value    : number;
  color    : string;
  desc     : string;
  decimals : number;
}

export default function GreeksDisplay({ greeks }: Props) {
  const { netDelta, netGamma, netTheta, netVega, netRho, totalValue } = greeks;

  const items: GreekItem[] = [
    {
      label   : "Δ Delta",
      value   : netDelta,
      color   : Math.abs(netDelta) < 10 ? "#00d97e" : "#f0a030",
      desc    : "Spot sensitivity",
      decimals: 2,
    },
    {
      label   : "Γ Gamma",
      value   : netGamma,
      color   : netGamma >= 0 ? "#00c8f0" : "#9b5cf6",
      desc    : "Delta rate of change",
      decimals: 4,
    },
    {
      label   : "Θ Theta",
      value   : netTheta,
      color   : netTheta >= 0 ? "#00d97e" : "#f03060",
      desc    : "Daily time decay",
      decimals: 2,
    },
    {
      label   : "ν Vega",
      value   : netVega,
      color   : netVega >= 0 ? "#00c8f0" : "#f03060",
      desc    : "IV sensitivity",
      decimals: 2,
    },
    {
      label   : "ρ Rho",
      value   : netRho,
      color   : "#445566",
      desc    : "Rate sensitivity",
      decimals: 2,
    },
    {
      label   : "Value",
      value   : totalValue,
      color   : totalValue >= 0 ? "#00d97e" : "#f03060",
      desc    : "Net portfolio value",
      decimals: 0,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map(({ label, value, color, desc, decimals }) => (
        <div key={label} className="rounded-lg p-2 text-center"
          style={{ background: "#060c1a", border: "1px solid #0f1e36" }}>
          <div className="text-xs font-bold mb-0.5" style={{ color: "#445566" }}>
            {label}
          </div>
          <div className="text-sm font-black" style={{ color }}>
            {value >= 0 ? "+" : ""}{decimals === 0
              ? `₹${Math.round(value).toLocaleString("en-IN")}`
              : value.toFixed(decimals)
            }
          </div>
          <div className="text-xs mt-0.5" style={{ color: "#334455" }}>{desc}</div>
        </div>
      ))}
    </div>
  );
}
