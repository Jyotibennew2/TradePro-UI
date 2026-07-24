/**
 * TradePro Simulator - Replay Control Bar
 * Reverse/forward buttons per timeframe (5m/15m/30m/1H/2H/1D) either side
 * of a centered Auto-play button with a speed menu. Pure presentation on
 * top of useHistoricalChain — same replay logic as before, just direct
 * per-timeframe jump buttons instead of "pick a step size, then reverse/
 * forward".
 */
import { useState } from "react";
import { Play, Pause, ChevronDown } from "lucide-react";
import { useTheme } from "../../store/themeStore";
import { TIMEFRAMES, SPEEDS } from "../hooks/useHistoricalChain";
import type { HistoricalChain } from "../hooks/useHistoricalChain";

export default function ReplayControlBar({ chain }: { chain: HistoricalChain }) {
  const theme = useTheme();
  const [speedOpen, setSpeedOpen] = useState(false);

  if (!chain.hasData) return null;

  return (
    <div
      className="flex items-center justify-between gap-2 px-3 py-2 overflow-x-auto"
      style={{ background: theme.bg.surface, borderBottom: `1px solid ${theme.border.subtle}` }}
    >
      <div className="flex items-center gap-1 shrink-0">
        {TIMEFRAMES.map(tf => (
          <button
            key={`rev-${tf.key}`}
            onClick={() => chain.jump(tf, -1)}
            className="px-2 py-1.5 rounded-lg text-sm font-bold shrink-0"
            style={{ background: theme.bg.surfaceAlt, color: theme.text.secondary, border: `1px solid ${theme.border.subtle}` }}
          >
            «{tf.shortLabel}
          </button>
        ))}
      </div>

      <div className="relative flex items-center gap-2 shrink-0">
        <button
          onClick={() => chain.setIsPlaying(p => !p)}
          className="px-4 py-1.5 rounded-lg text-sm font-black flex items-center gap-1.5"
          style={{
            background: chain.isPlaying ? theme.accent.red + "20" : theme.accent.green + "20",
            color: chain.isPlaying ? theme.accent.red : theme.accent.green,
            border: `1px solid ${(chain.isPlaying ? theme.accent.red : theme.accent.green)}40`,
          }}
        >
          {chain.isPlaying ? <Pause size={15} /> : <Play size={15} />}
          {chain.isPlaying ? "Pause" : "Auto Play"}
        </button>

        <button
          onClick={() => setSpeedOpen(v => !v)}
          className="px-2 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1"
          style={{ background: theme.bg.surfaceAlt, color: theme.accent.orange, border: `1px solid ${theme.border.subtle}` }}
        >
          {chain.speed}× <ChevronDown size={12} />
        </button>

        {speedOpen && (
          <div
            className="absolute top-full mt-1 right-0 z-20 rounded-lg overflow-hidden"
            style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}` }}
          >
            {SPEEDS.map(sp => (
              <button
                key={sp}
                onClick={() => { chain.setSpeed(sp); setSpeedOpen(false); }}
                className="block w-full px-4 py-1.5 text-sm font-bold text-left"
                style={{
                  background: chain.speed === sp ? theme.accent.orange + "20" : "transparent",
                  color: chain.speed === sp ? theme.accent.orange : theme.text.secondary,
                }}
              >
                {sp}×
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {TIMEFRAMES.map(tf => (
          <button
            key={`fwd-${tf.key}`}
            onClick={() => chain.jump(tf, 1)}
            className="px-2 py-1.5 rounded-lg text-sm font-bold shrink-0"
            style={{ background: theme.bg.surfaceAlt, color: theme.text.secondary, border: `1px solid ${theme.border.subtle}` }}
          >
            {tf.shortLabel}»
          </button>
        ))}
      </div>
    </div>
  );
}
