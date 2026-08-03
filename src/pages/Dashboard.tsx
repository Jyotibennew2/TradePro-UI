import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { createChart, AreaSeries, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { fetchHealth, fetchQuotes, fetchFunds, fetchPortfolio, fetchHistory } from "../utils/api";
import Card from "../components/ui/Card";
import Loader from "../components/ui/Loader";
import { Server } from "lucide-react";
import { useTheme } from "../store/themeStore";
import type { Theme } from "../styles/theme";

function StatBox({ label, value, sub, color, theme }: {
  label: string; value: string; sub?: string; color: string; theme: Theme;
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}` }}>
      <div className="text-sm mb-1" style={{ color: theme.text.muted }}>{label}</div>
      <div className="text-xl font-black" style={{ color }}>{value}</div>
      {sub && <div className="text-sm mt-1" style={{ color: theme.text.faint }}>{sub}</div>}
    </div>
  );
}

/**
 * Real equity curve, built from the actual paper-trade history (previously
 * this chart fabricated fake interpolated points - see PR history). Uses
 * lightweight-charts (TradingView, Apache 2.0) since this is genuine
 * financial time-series data, not decorative.
 *
 * License requirement: Apache 2.0 permits commercial use but requires a
 * visible attribution back to the project - see the link rendered below
 * the chart. Do not remove it.
 */
function EquityCurveChart({ points }: { points: { time: UTCTimestamp; value: number }[] }) {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height: 140,
      layout: {
        background: { color: "transparent" },
        textColor: theme.text.muted,
        fontSize: 11,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: theme.border.subtle },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true },
      handleScroll: false,
      handleScale: false,
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor       : theme.accent.cyan,
      topColor        : theme.accent.cyan + "4D",
      bottomColor     : theme.accent.cyan + "00",
      lineWidth       : 2,
      priceFormat     : { type: "custom", formatter: (v: number) => `₹${v.toLocaleString("en-IN")}` },
    });
    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    seriesRef.current?.setData(points);
    chartRef.current?.timeScale().fitContent();
  }, [points]);

  return (
    <div>
      <div ref={containerRef} style={{ width: "100%" }} />
      <div className="text-sm mt-1 text-right">
        <a href="https://www.tradingview.com/lightweight-charts/" target="_blank" rel="noopener noreferrer"
          style={{ color: theme.text.faint }}>
          Charts by TradingView Lightweight Charts
        </a>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const theme = useTheme();
  const health  = useQuery({ queryKey: ["health"],    queryFn: fetchHealth,    refetchInterval: 10000 });
  const quotes  = useQuery({ queryKey: ["quotes"],    queryFn: fetchQuotes,    refetchInterval: 3000  });
  const funds   = useQuery({ queryKey: ["funds"],     queryFn: fetchFunds,     refetchInterval: 30000 });
  const paper   = useQuery({ queryKey: ["portfolio"], queryFn: fetchPortfolio, refetchInterval: 5000  });
  const history = useQuery({ queryKey: ["history"],   queryFn: () => fetchHistory(200), refetchInterval: 5000 });

  const q       = quotes.data?.data ?? {};
  const nifty   = q["NSE:NIFTY50-INDEX"];
  const bank    = q["NSE:NIFTYBANK-INDEX"];
  const f       = funds.data?.data;
  const p       = paper.data?.data;

  const fmt = (n?: number) => n != null
    ? n.toLocaleString("en-IN", { maximumFractionDigits: 2 })
    : "---";

  const pct = (n?: number) => n != null ? `${n > 0 ? "+" : ""}${n.toFixed(2)}%` : "";

  // Real equity curve: starting capital, then cumulative capital after each
  // CLOSED trade (in chronological order, using the real exit timestamp),
  // ending at the current live capital figure. No fabricated/interpolated
  // points - if there's no trade history yet, this is just a flat line at
  // the starting capital (still real, not fake).
  const closedTrades = (history.data?.data ?? [])
    .filter(t => t.exit_time_epoch > 0)
    .sort((a, b) => a.exit_time_epoch - b.exit_time_epoch);

  const startingCapital = (p?.capital ?? 500000) - (p?.realized_pnl ?? 0);
  let running = startingCapital;
  const equityCurve: { time: UTCTimestamp; value: number }[] = closedTrades.map(t => {
    running += t.pnl;
    return { time: t.exit_time_epoch as UTCTimestamp, value: Math.round(running) };
  });
  // Always end on the live current capital figure (includes unrealized MTM via `capital` on exit only,
  // so this last point may sit slightly apart from the last trade point if positions are still open)
  const nowPoint = { time: Math.floor(Date.now() / 1000) as UTCTimestamp, value: Math.round(p?.capital ?? startingCapital) };
  if (equityCurve.length === 0 || equityCurve[equityCurve.length - 1].time !== nowPoint.time) {
    equityCurve.push(nowPoint);
  }

  if (quotes.isLoading) return <Loader text="Loading dashboard..." />;

  return (
    <div className="p-4 space-y-4">
      {/* Status bar */}
      <div className="flex items-center gap-3 text-sm" style={{ color: theme.text.muted }}>
        <Server size={14} />
        <span>Backend</span>
        <span style={{ color: health.data?.authenticated ? theme.accent.green : theme.accent.red }}>
          ● {health.data?.authenticated ? "LIVE" : "MOCK"}
        </span>
        <span>v{health.data?.version ?? "---"}</span>
        <span className="ml-auto">{new Date().toLocaleTimeString("en-IN")}</span>
      </div>

      {/* Index cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatBox theme={theme}
          label="NIFTY 50"
          value={fmt(nifty?.ltp)}
          sub={pct(nifty?.chp)}
          color={(nifty?.ch ?? 0) >= 0 ? theme.accent.green : theme.accent.red}
        />
        <StatBox theme={theme}
          label="BANK NIFTY"
          value={fmt(bank?.ltp)}
          sub={pct(bank?.chp)}
          color={(bank?.ch ?? 0) >= 0 ? theme.accent.green : theme.accent.red}
        />
        <StatBox theme={theme}
          label="Paper Capital"
          value={`₹${fmt(p?.capital)}`}
          sub="Paper Trading"
          color={theme.accent.purple}
        />
        <StatBox theme={theme}
          label="Total P&L"
          value={`₹${fmt(p?.total_pnl)}`}
          sub={`${p?.open_count ?? 0} open positions`}
          color={(p?.total_pnl ?? 0) >= 0 ? theme.accent.green : theme.accent.red}
        />
      </div>

      {/* Funds */}
      {f && (
        <Card title="Funds">
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: "Total",     value: f.total,     color: theme.text.secondary },
              { label: "Used",      value: f.used,      color: theme.accent.red },
              { label: "Available", value: f.available, color: theme.accent.green },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className="text-sm mb-1" style={{ color: theme.text.muted }}>{label}</div>
                <div className="text-sm font-bold" style={{ color }}>
                  ₹{fmt(value)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Paper P&L chart - real trade history, not simulated */}
      <Card title="Paper Portfolio">
        {closedTrades.length === 0 ? (
          <div className="text-sm text-center py-6" style={{ color: theme.text.muted }}>
            No closed trades yet — equity curve will build up as paper trades close.
          </div>
        ) : (
          <EquityCurveChart points={equityCurve} />
        )}
        <div className="grid grid-cols-3 gap-2 mt-3 text-center text-sm">
          <div>
            <div style={{ color: theme.text.muted }}>Realized</div>
            <div style={{ color: (p?.realized_pnl ?? 0) >= 0 ? theme.accent.green : theme.accent.red }}>
              ₹{fmt(p?.realized_pnl)}
            </div>
          </div>
          <div>
            <div style={{ color: theme.text.muted }}>Unrealized</div>
            <div style={{ color: (p?.unrealized_pnl ?? 0) >= 0 ? theme.accent.green : theme.accent.red }}>
              ₹{fmt(p?.unrealized_pnl)}
            </div>
          </div>
          <div>
            <div style={{ color: theme.text.muted }}>Open</div>
            <div style={{ color: theme.accent.cyan }}>{p?.open_count ?? 0}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
