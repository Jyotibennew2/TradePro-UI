import { useState, useEffect } from "react";
import { fetchHistorical, fetchArchivedDates, type Timeframe } from "../../utils/api";
import Card from "../../components/ui/Card";
import Loader from "../../components/ui/Loader";
import ErrorBox from "../../components/ui/ErrorBox";
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "../../store/themeStore";
import { StatBox, DataSourceBadge, fmt } from "./shared";
import HistoricalChain from "./HistoricalChain";

interface Props {
  symbol    : string;
  resolution: Timeframe;
  days      : number;
  setDays   : (n: number) => void;
  maxDays   : number;
}

export default function HistoricalData({ symbol, resolution, days, setDays, maxDays }: Props) {
  const theme = useTheme();

  const [archivedDates, setArchivedDates] = useState<string[]>([]);
  useEffect(() => {
    fetchArchivedDates(symbol).then(r => setArchivedDates(r.dates ?? [])).catch(() => setArchivedDates([]));
  }, [symbol]);

  const [histData, setHistData]       = useState<any>(null);
  const [histLoading, setHistLoading] = useState(false);
  const [histError, setHistError]     = useState(false);
  const [candleIdx, setCandleIdx]     = useState(0);

  const loadHistorical = async () => {
    setHistLoading(true); setHistError(false); setHistData(null);
    try {
      const res = await fetchHistorical(symbol, days, resolution);
      setHistData(res);
      setCandleIdx(res.candles.length > 0 ? res.candles.length - 1 : 0);
    } catch { setHistError(true); }
    finally { setHistLoading(false); }
  };

  const isIntraday    = resolution !== "1d";
  const histChartData = (histData?.candles ?? []).map((c: any) => ({
    date : isIntraday
      ? new Date(c.t * 1000).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
      : new Date(c.t * 1000).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    close: c.close, high: c.high, low: c.low,
  }));

  const histStats = histChartData.length > 0 ? {
    first: histChartData[0].close,
    last : histChartData[histChartData.length - 1].close,
    high : Math.max(...histChartData.map((c: any) => c.high)),
    low  : Math.min(...histChartData.map((c: any) => c.low)),
  } : null;
  const histChangePct = histStats ? ((histStats.last - histStats.first) / histStats.first) * 100 : 0;

  return (
    <>
      <Card title="Load Historical Data">
        <div className="space-y-3">
          <div>
            <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Days: <span style={{ color: theme.accent.cyan }}>{days}</span></div>
            <input type="range" min={1} max={maxDays} value={days} onChange={e => setDays(Number(e.target.value))} className="w-full" />
          </div>
          <button onClick={loadHistorical} disabled={histLoading}
            className="w-full py-2.5 rounded-xl text-sm font-black"
            style={{ background: theme.accent.cyan, color: theme.bg.page, opacity: histLoading ? 0.7 : 1 }}>
            {histLoading ? "Loading..." : `▶ Load ${symbol} • ${resolution}`}
          </button>
          {archivedDates.length > 0 && (
            <div className="text-sm px-2 py-1.5 rounded-lg flex items-center gap-1" style={{ background: theme.accent.green + "15", color: theme.accent.green }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: theme.accent.green }} />
              {archivedDates.length} date{archivedDates.length > 1 ? "s" : ""} of REAL saved option-chain data available
            </div>
          )}
        </div>
      </Card>

      {histLoading && <Loader text="Fetching historical candles..." />}
      {histError   && <ErrorBox message="Failed to load historical data" />}

      {histData && histStats && (
        <>
          <div className="flex justify-end"><DataSourceBadge source={histData.mock ? "MOCK" : "LIVE"} theme={theme} /></div>
          <div className="grid grid-cols-2 gap-2">
            <StatBox theme={theme} label={`${symbol} — start`}  value={`₹${fmt(histStats.first)}`} color={theme.text.secondary} />
            <StatBox theme={theme} label={`${symbol} — latest`} value={`₹${fmt(histStats.last)}`}  color={theme.accent.cyan} />
            <StatBox theme={theme} label="Period High"          value={`₹${fmt(histStats.high)}`}  color={theme.accent.green} />
            <StatBox theme={theme} label="Period Low"           value={`₹${fmt(histStats.low)}`}   color={theme.accent.red} />
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}` }}>
            <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Change over period</div>
            <div className="text-xl font-black" style={{ color: histChangePct >= 0 ? theme.accent.green : theme.accent.red }}>
              {histChangePct >= 0 ? "+" : ""}{histChangePct.toFixed(2)}%
            </div>
          </div>

          <Card title={`${symbol} • ${resolution} Price History (${histChartData.length} candles)`}>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={histChartData}>
                <defs>
                  <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={theme.accent.cyan} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={theme.accent.cyan} stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={theme.border.subtle} strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: theme.text.muted, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis domain={["auto", "auto"]} tick={{ fill: theme.text.muted, fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(1)}k`} axisLine={false} tickLine={false} width={44} />
                <Tooltip contentStyle={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, borderRadius: 8, fontSize: 13 }}
                  formatter={(v) => [`₹${fmt(Number(v ?? 0))}`, "Close"]} />
                <Area type="monotone" dataKey="close" stroke={theme.accent.cyan} strokeWidth={2} fill="url(#histGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <HistoricalChain
            symbol={symbol}
            resolution={resolution}
            histData={histData}
            candleIdx={candleIdx}
            setCandleIdx={setCandleIdx}
            histChartData={histChartData}
          />
        </>
      )}
      {!histData && !histLoading && (
        <div className="text-center py-16" style={{ color: theme.text.muted }}>
          <div className="text-4xl mb-3">📅</div>
          <div className="text-sm">Load {resolution} candles for {symbol}</div>
        </div>
      )}
    </>
  );
}
