/**
 * TradePro Simulator - Greeks Display Component
 * Portfolio-level Greeks summary.
 */

import type { PortfolioGreeks } from "../models/Greeks";
import { useTheme } from "../../store/themeStore";

interface Props {
  greeks: PortfolioGreeks;
}

export default function GreeksDisplay({ greeks }: Props) {
  const theme = useTheme();
  const { netDelta, netGamma, netTheta, netVega, netRho, totalValue } = greeks;

  const items = [
    {
      label   : "Δ Delta",
      value   : netDelta,
      color   : Math.abs(netDelta) < 10 ? theme.accent.green : theme.accent.orange,
      desc    : "Spot sensitivity",
      decimals: 2,
    },
    {
      label   : "Γ Gamma",
      value   : netGamma,
      color   : netGamma >= 0 ? theme.accent.cyan : theme.accent.purple,
      desc    : "Delta rate of change",
      decimals: 4,
    },
    {
      label   : "Θ Theta",
      value   : netTheta,
      color   : netTheta >= 0 ? theme.accent.green : theme.accent.red,
      desc    : "Daily time decay",
      decimals: 2,
    },
    {
      label   : "ν Vega",
      value   : netVega,
      color   : netVega >= 0 ? theme.accent.cyan : theme.accent.red,
      desc    : "IV sensitivity",
      decimals: 2,
    },
    {
      label   : "ρ Rho",
      value   : netRho,
      color   : theme.text.muted,
      desc    : "Rate sensitivity",
      decimals: 2,
    },
    {
      label   : "Value",
      value   : totalValue,
      color   : totalValue >= 0 ? theme.accent.green : theme.accent.red,
      desc    : "Net portfolio value",
      decimals: 0,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map(({ label, value, color, desc, decimals }) => (
        <div key={label} className="rounded-lg p-3 text-center"
          style={{ background: theme.bg.surface, border: `1px solid ${theme.border.strong}` }}>
          <div className="text-sm font-bold mb-1" style={{ color: theme.text.muted }}>
            {label}
          </div>
          <div className="text-lg font-black" style={{ color }}>
            {value >= 0 ? "+" : ""}{decimals === 0
              ? `₹${Math.round(value).toLocaleString("en-IN")}`
              : value.toFixed(decimals)
            }
          </div>
          <div className="text-xs mt-1" style={{ color: theme.text.faint }}>{desc}</div>
        </div>
      ))}
    </div>
  );
}
