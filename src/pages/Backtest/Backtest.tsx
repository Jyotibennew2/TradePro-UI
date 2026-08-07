import { useState, useEffect } from "react";
import { type Timeframe } from "../../utils/api";
import Card from "../../components/ui/Card";
import { useTheme } from "../../store/themeStore";
import { SYMBOLS, TIMEFRAMES, type Mode } from "./shared";
import SingleBacktest from "./SingleBacktest";
import CompareBacktest from "./CompareBacktest";
import HistoricalData from "./HistoricalData";

export default function Backtest() {
  const theme = useTheme();

  const [mode, setMode] = useState<Mode>("single");

  const [symbol,     setSymbol]     = useState("NIFTY");
  const [resolution, setResolution] = useState<Timeframe>("1d");
  const [days,       setDays]       = useState(90);
  const [slPct,      setSlPct]      = useState(50);
  const [tgtPct,     setTgtPct]     = useState(50);
  const [lotSize,    setLotSize]    = useState(50);

  const activeTf = TIMEFRAMES.find(t => t.key === resolution)!;

  useEffect(() => {
    setDays(d => Math.min(d, activeTf.maxDays));
  }, [resolution]);

  return (
    <div className="p-4 space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-1">
        {(["single", "compare", "historical"] as Mode[]).map((m, i) => (
          <button key={m} onClick={() => setMode(m)}
            className="flex-1 py-2 rounded-xl text-sm font-bold"
            style={{ background: mode === m ? theme.accent.cyan : theme.bg.surfaceAlt, color: mode === m ? theme.bg.page : theme.text.muted, border: `1px solid ${theme.border.subtle}` }}>
            {["Single Backtest", "Compare Strategies", "Historical Data"][i]}
          </button>
        ))}
      </div>

      {/* Shared: Symbol + Timeframe */}
      <Card title="Symbol & Timeframe">
        <div className="space-y-3">
          <div>
            <div className="text-sm mb-1" style={{ color: theme.text.muted }}>Symbol</div>
            <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${theme.border.subtle}` }}>
              {SYMBOLS.map(sym => (
                <button key={sym} onClick={() => setSymbol(sym)}
                  className="flex-1 py-1.5 text-sm font-bold"
                  style={{ background: symbol === sym ? theme.accent.cyan : theme.bg.surfaceAlt, color: symbol === sym ? theme.bg.page : theme.text.muted }}>
                  {sym}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-sm mb-1" style={{ color: theme.text.muted }}>
              Timeframe <span style={{ color: theme.text.faint }}>(max {activeTf.maxDays}d lookback)</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {TIMEFRAMES.map(tf => (
                <button key={tf.key} onClick={() => setResolution(tf.key)}
                  className="px-3 py-1.5 rounded-lg text-sm font-bold"
                  style={{ background: resolution === tf.key ? theme.accent.purple : theme.bg.surfaceAlt, color: resolution === tf.key ? theme.bg.page : theme.text.muted, border: `1px solid ${theme.border.subtle}` }}>
                  {tf.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {mode === "single" && (
        <SingleBacktest
          symbol={symbol} resolution={resolution}
          days={days} setDays={setDays}
          slPct={slPct} setSlPct={setSlPct}
          tgtPct={tgtPct} setTgtPct={setTgtPct}
          lotSize={lotSize} setLotSize={setLotSize}
          maxDays={activeTf.maxDays}
        />
      )}

      {mode === "compare" && (
        <CompareBacktest
          symbol={symbol} resolution={resolution}
          days={days} setDays={setDays}
          slPct={slPct} setSlPct={setSlPct}
          tgtPct={tgtPct} setTgtPct={setTgtPct}
          lotSize={lotSize} setLotSize={setLotSize}
          maxDays={activeTf.maxDays}
        />
      )}

      {mode === "historical" && (
        <HistoricalData
          symbol={symbol} resolution={resolution}
          days={days} setDays={setDays}
          maxDays={activeTf.maxDays}
        />
      )}
    </div>
  );
}
