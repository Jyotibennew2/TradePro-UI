/**
 * TradePro Simulator - Scenario Matrix Component
 * P&L matrix across spot and IV changes.
 */

import type { ScenarioMatrix } from "../models/Payoff";

interface Props {
  matrix: ScenarioMatrix;
}

function cellColor(pnl: number, maxAbs: number): string {
  if (maxAbs === 0) return "#0f1e36";
  const intensity = Math.min(Math.abs(pnl) / maxAbs, 1);
  if (pnl > 0) {
    const g = Math.round(100 + intensity * 117);
    return `rgba(0, ${g}, 100, 0.25)`;
  }
  const r = Math.round(150 + intensity * 90);
  return `rgba(${r}, 30, 60, 0.25)`;
}

export default function ScenarioMatrixDisplay({ matrix }: Props) {
  const { matrix: cells } = matrix;
  if (!cells.length) return null;

  const ivChanges  = cells[0].map(c => c.ivChange);
  const spotChanges= cells.map(row => row[0].spotChange);
  const allPnls    = cells.flat().map(c => Math.abs(c.pnl));
  const maxAbs     = Math.max(...allPnls, 1);

  return (
    <div className="overflow-x-auto">
      {/* IV header */}
      <div className="flex items-center mb-1">
        <div className="w-12 shrink-0" />
        <div className="flex-1 text-center text-xs mb-1" style={{ color: "#445566" }}>
          IV Change →
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center mb-1">
        <div className="w-12 shrink-0 text-xs text-center" style={{ color: "#334455" }}>
          Spot↓
        </div>
        {ivChanges.map(iv => (
          <div key={iv} className="flex-1 text-center text-xs font-bold"
            style={{ color: iv === 0 ? "#00c8f0" : iv > 0 ? "#f03060" : "#00d97e" }}>
            {iv > 0 ? "+" : ""}{iv}%
          </div>
        ))}
      </div>

      {/* Matrix rows */}
      {cells.map((row, ri) => (
        <div key={ri} className="flex items-center mb-0.5">
          {/* Spot label */}
          <div className="w-12 shrink-0 text-xs text-center font-bold"
            style={{ color: spotChanges[ri] === 0 ? "#00c8f0" : spotChanges[ri] > 0 ? "#00d97e" : "#f03060" }}>
            {spotChanges[ri] > 0 ? "+" : ""}{spotChanges[ri]}%
          </div>

          {/* Cells */}
          {row.map((cell, ci) => (
            <div
              key={ci}
              className="flex-1 text-center rounded text-xs py-1 mx-0.5 font-bold"
              style={{
                background: cellColor(cell.pnl, maxAbs),
                color     : cell.pnl >= 0 ? "#00d97e" : "#f03060",
                border    : (cell.spotChange === 0 && cell.ivChange === 0)
                  ? "1px solid #00c8f040"
                  : "1px solid transparent",
              }}
            >
              {cell.pnl >= 0 ? "+" : ""}
              {Math.abs(cell.pnl) >= 1000
                ? `${(cell.pnl / 1000).toFixed(1)}k`
                : cell.pnl}
            </div>
          ))}
        </div>
      ))}

      {/* Legend */}
      <div className="flex justify-center gap-4 mt-2 text-xs" style={{ color: "#334455" }}>
        <span style={{ color: "#00d97e" }}>■ Profit</span>
        <span style={{ color: "#f03060" }}>■ Loss</span>
        <span style={{ color: "#00c8f0" }}>■ Current</span>
      </div>
    </div>
  );
}
