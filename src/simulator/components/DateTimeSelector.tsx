/**
 * TradePro Simulator - Date & Time Selector (Historical Option Chain)
 *
 * Replaces the plain "jump to date" dropdown with a compact button that
 * expands into a full picker: Year tabs -> Month tabs -> Calendar grid ->
 * archived-time chips, plus Prev/Next Candle and Prev/Next Trading Day
 * buttons always visible. Only dates/times present in chain.dates/
 * chain.times are selectable — everything else is disabled, since that's
 * literally what "available" means here (the archive doesn't have data
 * for it). Latest-available-timestamp default and date/time preservation
 * across changes were already handled inside useHistoricalChain (from an
 * earlier pass) — this component only adds the picker UI on top of it.
 *
 * Selecting a date/time only calls chain.setDateIdx / chain.setTimeIdx /
 * chain.jump — none of which touch legs, Position Book, or any other page
 * state, so the current strategy is always preserved across a date/time
 * change.
 *
 * ── Enhancement pass ────────────────────────────────────────────
 * Calendar day cells now render a small colored dot when that date is
 * either the selected expiry (auto-detected from real archived data) or a
 * curated macro event (RBI/Budget/Results, from EVENT_CALENDAR). This is
 * purely additive to the existing grid — layout, sizing, and every other
 * interaction are unchanged.
 */
import { useState, useMemo } from "react";
import { Calendar, ChevronLeft, ChevronRight, SkipBack, SkipForward } from "lucide-react";
import { useTheme } from "../../store/themeStore";
import { TIMEFRAMES, getEventForDate } from "../hooks/useHistoricalChain";
import type { HistoricalChain } from "../hooks/useHistoricalChain";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

interface Props {
  chain: HistoricalChain;
}

export default function DateTimeSelector({ chain }: Props) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const dateSet = useMemo(() => new Set(chain.dates), [chain.dates]);
  const parsed = useMemo(
    () => chain.dates.map(d => {
      const [y, m, day] = d.split("-").map(Number);
      return { d, y, m, day };
    }),
    [chain.dates]
  );
  const years = useMemo(() => Array.from(new Set(parsed.map(p => p.y))).sort((a, b) => b - a), [parsed]);
  const selected = parsed.find(p => p.d === chain.selectedDate);

  const [viewYear, setViewYear] = useState<number>(selected?.y ?? years[0] ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(selected?.m ?? (new Date().getMonth() + 1));

  // Keep the calendar's visible year/month synced with whatever date is
  // actually selected (e.g. after Prev/Next Trading Day moves it).
  const syncKey = chain.selectedDate;
  useMemo(() => {
    if (selected) { setViewYear(selected.y); setViewMonth(selected.m); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncKey]);

  const monthsWithData = useMemo(
    () => Array.from(new Set(parsed.filter(p => p.y === viewYear).map(p => p.m))).sort((a, b) => a - b),
    [parsed, viewYear]
  );

  const daysInGrid = useMemo(() => {
    const first = new Date(viewYear, viewMonth - 1, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
    const cells: (number | null)[] = Array(startDow).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  const pickDate = (dStr: string) => {
    const idx = chain.dates.indexOf(dStr);
    if (idx >= 0) chain.setDateIdx(idx);
  };

  const timeOptions = chain.times.map(t => ({
    epoch: t,
    label: new Date(t * 1000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
  }));

  const dayTf = TIMEFRAMES.find(t => t.snapshotStep === "day") ?? TIMEFRAMES[TIMEFRAMES.length - 1];
  const candleTf = TIMEFRAMES[0]; // finest granularity = one archived snapshot

  const currentLabel = chain.chainMeta
    ? `${new Date(chain.chainMeta.savedAt * 1000).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}, ${new Date(chain.chainMeta.savedAt * 1000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
    : "Pick date & time";

  if (!chain.hasData) return null;

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <button onClick={() => chain.jump(candleTf, -1)} title="Previous candle"
          className="p-1.5 rounded-lg shrink-0" style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color: theme.text.secondary }}>
          <ChevronLeft size={13} />
        </button>
        <button onClick={() => chain.jump(dayTf, -1)} title="Previous trading day"
          className="p-1.5 rounded-lg shrink-0" style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color: theme.text.secondary }}>
          <SkipBack size={13} />
        </button>

        <button onClick={() => setOpen(v => !v)}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-sm font-bold min-w-0"
          style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color: theme.accent.cyan }}>
          <Calendar size={13} className="shrink-0" />
          <span className="truncate">{currentLabel}</span>
        </button>

        <button onClick={() => chain.jump(dayTf, 1)} title="Next trading day"
          className="p-1.5 rounded-lg shrink-0" style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color: theme.text.secondary }}>
          <SkipForward size={13} />
        </button>
        <button onClick={() => chain.jump(candleTf, 1)} title="Next candle"
          className="p-1.5 rounded-lg shrink-0" style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color: theme.text.secondary }}>
          <ChevronRight size={13} />
        </button>
      </div>

      {open && (
        <div className="absolute z-40 mt-1 left-0 right-0 rounded-xl overflow-hidden shadow-2xl p-3"
          style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}` }}>

          {/* Years */}
          <div className="flex gap-1 overflow-x-auto pb-2">
            {years.map(y => (
              <button key={y} onClick={() => setViewYear(y)}
                className="shrink-0 px-2.5 py-1 rounded-lg text-sm font-bold"
                style={{ background: viewYear === y ? theme.accent.cyan : theme.bg.surface, color: viewYear === y ? theme.bg.page : theme.text.secondary }}>
                {y}
              </button>
            ))}
          </div>

          {/* Months */}
          <div className="grid grid-cols-6 gap-1 mb-2">
            {MONTH_NAMES.map((m, i) => {
              const mi = i + 1;
              const has = monthsWithData.includes(mi);
              return (
                <button key={m} disabled={!has} onClick={() => has && setViewMonth(mi)}
                  className="py-1 rounded-lg text-sm font-bold"
                  style={{
                    background: viewMonth === mi && has ? theme.accent.cyan : theme.bg.surface,
                    color: !has ? theme.text.faint : viewMonth === mi ? theme.bg.page : theme.text.secondary,
                    opacity: has ? 1 : 0.35,
                  }}>
                  {m}
                </button>
              );
            })}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DOW.map((d, i) => <div key={i} className="text-center" style={{ fontSize: 9, color: theme.text.faint }}>{d}</div>)}
            {daysInGrid.map((day, i) => {
              if (day == null) return <div key={i} />;
              const dStr = `${viewYear}-${String(viewMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const has = dateSet.has(dStr);
              const isSelected = dStr === chain.selectedDate;
              const isExpiry = dStr === chain.expiry;
              const event = getEventForDate(dStr);
              const dotColor = isExpiry ? theme.accent.red : event ? theme.accent.orange : null;
              return (
                <button key={i} disabled={!has} onClick={() => has && pickDate(dStr)}
                  title={event?.label ?? (isExpiry ? "Expiry day" : undefined)}
                  className="relative aspect-square rounded-lg text-sm font-bold"
                  style={{
                    background: isSelected ? theme.accent.cyan : has ? theme.bg.surface : "transparent",
                    color: isSelected ? theme.bg.page : has ? theme.text.secondary : theme.text.faint,
                    opacity: has ? 1 : 0.3,
                  }}>
                  {day}
                  {dotColor && (
                    <span
                      className="absolute rounded-full"
                      style={{
                        width: 4, height: 4, bottom: 3, left: "50%", transform: "translateX(-50%)",
                        background: isSelected ? theme.bg.page : dotColor,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Archived times for the selected date */}
          {timeOptions.length > 0 && (
            <div>
              <div className="mb-1" style={{ color: theme.text.faint, fontSize: 10 }}>Time (archived snapshots)</div>
              <div className="flex gap-1 overflow-x-auto pb-1">
                {timeOptions.map((t, i) => (
                  <button key={t.epoch} onClick={() => chain.setTimeIdx(i)}
                    className="shrink-0 px-2 py-1 rounded-lg text-sm font-bold"
                    style={{
                      background: i === chain.timeIdx ? theme.accent.orange : theme.bg.surface,
                      color: i === chain.timeIdx ? theme.bg.page : theme.text.secondary,
                    }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => setOpen(false)}
            className="w-full mt-2 py-1.5 rounded-lg text-sm font-bold"
            style={{ background: theme.accent.cyan + "18", color: theme.accent.cyan }}>
            Done
          </button>
        </div>
      )}
    </div>
  );
}
