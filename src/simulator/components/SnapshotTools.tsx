/**
 * TradePro Simulator - Snapshot Tools
 *
 * Three small, self-contained controls meant to sit in the existing header
 * strip next to "Strategy: ...":
 *   1. Bookmark (⭐) — save/recall specific date+time+expiry snapshots
 *   2. Resume banner — one-time toast confirming a prior session was restored
 *   3. Compare toggle — flips the Option Chain panel into two-column mode
 *
 * All persistence (bookmarks, last session) lives in useHistoricalChain via
 * localStorage — this file is presentation only. Uses the app's central
 * theme system (`useTheme()`), matching OptionChainPanel.tsx.
 */
import { useState, useEffect, useRef } from "react";
import { Star, History, Columns2, X, Trash2 } from "lucide-react";
import { useTheme } from "../../store/themeStore";
import type { HistoricalChain, SnapshotBookmark } from "../hooks/useHistoricalChain";
import { fmtDateLabel, fmtTime } from "../hooks/useHistoricalChain";

export function BookmarkControl({ chain }: { chain: HistoricalChain }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [labelInput, setLabelInput] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [open]);

  if (!chain.hasData) return null;

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        title={chain.isCurrentBookmarked ? "Snapshot bookmarked" : "Bookmark this snapshot"}
        className="flex items-center justify-center w-7 h-7 rounded-md"
        style={{
          background: chain.isCurrentBookmarked ? theme.accent.orange + "20" : theme.bg.surface,
          border: `1px solid ${chain.isCurrentBookmarked ? theme.accent.orange + "50" : theme.border.subtle}`,
        }}
      >
        <Star
          size={13}
          color={chain.isCurrentBookmarked ? theme.accent.orange : theme.text.muted}
          fill={chain.isCurrentBookmarked ? theme.accent.orange : "none"}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 top-8 z-50 rounded-lg shadow-xl p-2"
          style={{ background: theme.bg.surface, border: `1px solid ${theme.border.strong}`, width: 260 }}
        >
          <div className="flex gap-1 mb-2">
            <input
              value={labelInput}
              onChange={e => setLabelInput(e.target.value)}
              placeholder="Label (optional)"
              className="flex-1 px-2 py-1 rounded outline-none"
              style={{ background: theme.bg.surfaceAlt, color: theme.text.primary, border: `1px solid ${theme.border.subtle}`, fontSize: 11 }}
            />
            <button
              onClick={() => { chain.addBookmark(labelInput); setLabelInput(""); }}
              className="px-2 rounded font-bold"
              style={{ background: theme.accent.orange, color: theme.bg.page, fontSize: 10 }}
            >
              Save ⭐
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
            {chain.bookmarks.length === 0 && (
              <div style={{ color: theme.text.faint, fontSize: 10 }} className="text-center py-2">
                No bookmarks yet
              </div>
            )}
            {chain.bookmarks.map((bm: SnapshotBookmark) => (
              <div
                key={bm.id}
                className="flex items-center justify-between gap-1 px-2 py-1 rounded"
                style={{ background: theme.bg.surfaceAlt }}
              >
                <button
                  onClick={() => { chain.goToBookmark(bm); setOpen(false); }}
                  className="flex-1 text-left truncate"
                  style={{ color: theme.text.secondary, fontSize: 10 }}
                  title={`${bm.symbol} · ${fmtDateLabel(bm.date)} · ${fmtTime(bm.time)}`}
                >
                  {bm.label}
                </button>
                <button onClick={() => chain.removeBookmark(bm.id)} className="shrink-0">
                  <Trash2 size={11} color={theme.accent.red} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ResumeSessionBanner({ chain }: { chain: HistoricalChain }) {
  const theme = useTheme();
  const [dismissed, setDismissed] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (chain.hasResumedSession && !shown) {
      setShown(true);
      const t = setTimeout(() => setDismissed(true), 4000);
      return () => clearTimeout(t);
    }
  }, [chain.hasResumedSession, shown]);

  if (!shown || dismissed) return null;

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1"
      style={{ background: theme.accent.cyan + "15", color: theme.accent.cyan, fontSize: 10 }}
    >
      <History size={11} />
      <span>Resumed last session</span>
      <button onClick={() => setDismissed(true)} className="ml-auto">
        <X size={11} />
      </button>
    </div>
  );
}

export function CompareToggle({ chain }: { chain: HistoricalChain }) {
  const theme = useTheme();
  if (!chain.hasData) return null;

  return (
    <button
      onClick={chain.toggleCompareMode}
      title="Compare two snapshots side by side"
      className="flex items-center gap-1 h-7 px-2 rounded-md shrink-0"
      style={{
        background: chain.compareMode ? theme.accent.purple + "20" : theme.bg.surface,
        border: `1px solid ${chain.compareMode ? theme.accent.purple + "50" : theme.border.subtle}`,
        color: chain.compareMode ? theme.accent.purple : theme.text.muted,
      }}
    >
      <Columns2 size={12} />
      <span className="font-bold" style={{ fontSize: 10 }}>Compare</span>
    </button>
  );
}
