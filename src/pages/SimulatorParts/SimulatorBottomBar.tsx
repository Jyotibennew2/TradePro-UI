import { RefreshCw, Save, FolderOpen, Download, Sparkles, Zap, LineChart as LineChartIcon } from "lucide-react";
import type { Theme } from "../../styles/theme";

interface Props {
  theme: Theme;
  calculate: () => void;
  handleSave: () => void;
  setLoadOpen: (v: boolean | ((v: boolean) => boolean)) => void;
  handleExport: () => void;
  flashToast: (msg: string) => void;
  runWalkForward: () => void;
  handlePaperTrade: () => void;
}

export default function SimulatorBottomBar({
  theme, calculate, handleSave, setLoadOpen, handleExport, flashToast, runWalkForward, handlePaperTrade,
}: Props) {
  return (
    <div className="fixed bottom-0 left-0 right-0 flex items-center justify-around gap-1 px-2 py-2 z-20 overflow-x-auto"
      style={{ background: theme.bg.surface, borderTop: `1px solid ${theme.border.subtle}` }}>
      <button onClick={calculate} className="flex flex-col items-center gap-0.5 px-2 shrink-0" style={{ color: theme.accent.cyan }}>
        <RefreshCw size={16} /><span style={{ fontSize: 9 }}>Calculate</span>
      </button>
      <button onClick={handleSave} className="flex flex-col items-center gap-0.5 px-2 shrink-0" style={{ color: theme.accent.green }}>
        <Save size={16} /><span style={{ fontSize: 9 }}>Save</span>
      </button>
      <button onClick={() => setLoadOpen(v => !v)} className="flex flex-col items-center gap-0.5 px-2 shrink-0" style={{ color: theme.accent.cyan }}>
        <FolderOpen size={16} /><span style={{ fontSize: 9 }}>Load</span>
      </button>
      <button onClick={handleExport} className="flex flex-col items-center gap-0.5 px-2 shrink-0" style={{ color: theme.accent.purple }}>
        <Download size={16} /><span style={{ fontSize: 9 }}>Export</span>
      </button>
      <button onClick={() => flashToast("AI Suggest — coming soon")} className="flex flex-col items-center gap-0.5 px-2 shrink-0" style={{ color: theme.accent.orange }}>
        <Sparkles size={16} /><span style={{ fontSize: 9 }}>AI Suggest</span>
      </button>
      <button onClick={runWalkForward} className="flex flex-col items-center gap-0.5 px-2 shrink-0" style={{ color: theme.accent.orange }}>
        <Zap size={16} /><span style={{ fontSize: 9 }}>Run Backtest</span>
      </button>
      <button onClick={handlePaperTrade} className="flex flex-col items-center gap-0.5 px-2 shrink-0" style={{ color: theme.accent.green }}>
        <LineChartIcon size={16} /><span style={{ fontSize: 9 }}>Paper Trade</span>
      </button>
    </div>
  );
}
