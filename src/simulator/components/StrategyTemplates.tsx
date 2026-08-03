/**
 * TradePro Simulator - Strategy Templates
 * Pre-built strategy selector with 17 templates.
 */

import type { StrategyType } from "../models/Strategy";

interface Template {
  key        : StrategyType | "CALENDAR" | "DIAGONAL";
  label      : string;
  outlook    : string;
  complexity : "BASIC" | "INTERMEDIATE" | "ADVANCED";
  legs       : number;
  emoji      : string;
}

const TEMPLATES: Template[] = [
  { key: "LONG_CALL",       label: "Long Call",            outlook: "Bullish",  complexity: "BASIC",        legs: 1, emoji: "📈" },
  { key: "LONG_PUT",        label: "Long Put",             outlook: "Bearish",  complexity: "BASIC",        legs: 1, emoji: "📉" },
  { key: "COVERED_CALL",    label: "Covered Call",         outlook: "Neutral",  complexity: "BASIC",        legs: 1, emoji: "🛡️" },
  { key: "BULL_CALL_SPREAD",label: "Bull Call Spread",     outlook: "Bullish",  complexity: "INTERMEDIATE", legs: 2, emoji: "🐂" },
  { key: "BEAR_PUT_SPREAD", label: "Bear Put Spread",      outlook: "Bearish",  complexity: "INTERMEDIATE", legs: 2, emoji: "🐻" },
  { key: "SHORT_STRADDLE",  label: "Short Straddle",       outlook: "Sideways", complexity: "INTERMEDIATE", legs: 2, emoji: "⚡" },
  { key: "LONG_STRADDLE",   label: "Long Straddle",        outlook: "Volatile", complexity: "INTERMEDIATE", legs: 2, emoji: "🌊" },
  { key: "SHORT_STRANGLE",  label: "Short Strangle",       outlook: "Sideways", complexity: "INTERMEDIATE", legs: 2, emoji: "🔒" },
  { key: "LONG_STRANGLE",   label: "Long Strangle",        outlook: "Volatile", complexity: "INTERMEDIATE", legs: 2, emoji: "💥" },
  { key: "IRON_CONDOR",     label: "Iron Condor",          outlook: "Sideways", complexity: "ADVANCED",     legs: 4, emoji: "🦅" },
  { key: "IRON_FLY",        label: "Iron Butterfly",       outlook: "Sideways", complexity: "ADVANCED",     legs: 4, emoji: "🦋" },
  { key: "JADE_LIZARD",     label: "Jade Lizard",          outlook: "Bullish",  complexity: "ADVANCED",     legs: 3, emoji: "🦎" },
  { key: "BWB",             label: "Broken Wing Butterfly",outlook: "Neutral",  complexity: "ADVANCED",     legs: 3, emoji: "🪁" },
  { key: "BULL_PUT_SPREAD", label: "Bull Put Spread",      outlook: "Bullish",  complexity: "INTERMEDIATE", legs: 2, emoji: "📊" },
  { key: "BEAR_CALL_SPREAD",label: "Bear Call Spread",     outlook: "Bearish",  complexity: "INTERMEDIATE", legs: 2, emoji: "📊" },
  { key: "RATIO",           label: "Ratio Spread",         outlook: "Neutral",  complexity: "ADVANCED",     legs: 3, emoji: "⚖️" },
  { key: "CUSTOM",          label: "Custom Strategy",      outlook: "Any",      complexity: "ADVANCED",     legs: 0, emoji: "🔧" },
];

const COMPLEXITY_COLOR: Record<string, string> = {
  BASIC       : "#00d97e",
  INTERMEDIATE: "#f0a030",
  ADVANCED    : "#f03060",
};

const OUTLOOK_COLOR: Record<string, string> = {
  Bullish : "#00d97e",
  Bearish : "#f03060",
  Sideways: "#00c8f0",
  Volatile: "#9b5cf6",
  Neutral : "#445566",
  Any     : "#445566",
};

interface Props {
  onSelect: (key: string) => void;
  selected: string;
}

export default function StrategyTemplates({ onSelect, selected }: Props) {
  return (
    <div className="space-y-1">
      {TEMPLATES.map(t => (
        <button
          key={t.key}
          onClick={() => onSelect(t.key)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all"
          style={{
            background: selected === t.key ? "#00c8f015" : "transparent",
            border    : selected === t.key ? "1px solid #00c8f040" : "1px solid transparent",
          }}
        >
          <span className="text-base">{t.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold truncate" style={{ color: "#c0d0e8" }}>
              {t.label}
            </div>
            <div className="text-xs" style={{ color: OUTLOOK_COLOR[t.outlook] }}>
              {t.outlook} • {t.legs > 0 ? `${t.legs} leg${t.legs > 1 ? "s" : ""}` : "Custom"}
            </div>
          </div>
          <span className="text-xs font-bold shrink-0"
            style={{ color: COMPLEXITY_COLOR[t.complexity] }}>
            {t.complexity[0]}
          </span>
        </button>
      ))}
    </div>
  );
}
