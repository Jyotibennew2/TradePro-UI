import { Save, Download, Upload, FolderOpen, Sparkles, Settings, Zap } from "lucide-react";
import type { ChangeEvent } from "react";
import type { Theme } from "../../styles/theme";
import type { BuiltStrategy } from "../../simulator/models/Strategy";
import { strategyStorage } from "../../simulator/services/strategyStorage";

interface Props {
  theme: Theme;
  stratName: string;
  setStratName: (s: string) => void;
  bornAt: Date;
  deployLabel: string;
  handleSave: () => void;
  loadOpen: boolean;
  setLoadOpen: (v: boolean | ((v: boolean) => boolean)) => void;
  handleExport: () => void;
  flashToast: (msg: string) => void;
  savedList: BuiltStrategy[];
  setSavedList: (s: BuiltStrategy[]) => void;
  handleLoad: (s: BuiltStrategy) => void;
  handleImport: (e: ChangeEvent<HTMLInputElement>) => void;
}

export default function SimulatorHeader({
  theme, stratName, setStratName, bornAt, deployLabel, handleSave,
  loadOpen, setLoadOpen, handleExport, flashToast, savedList, setSavedList, handleLoad, handleImport,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 flex-wrap"
      style={{ background: theme.bg.surface, borderBottom: `1px solid ${theme.border.subtle}` }}>
      <div className="flex items-center gap-2 shrink-0">
        <Zap size={18} color={theme.accent.cyan} />
        <span className="font-black text-sm" style={{ color: theme.accent.cyan }}>TradePro</span>
        <span style={{ fontSize: 8, color: theme.text.faint }}>build-posbook-guards-1</span>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <input
          value={stratName}
          onChange={e => setStratName(e.target.value)}
          className="px-2 py-1 rounded-lg text-sm font-bold text-center outline-none"
          style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}`, color: theme.text.primary, width: 160 }}
        />
        <div className="text-sm" style={{ color: theme.text.muted }}>
          <div>Strategy: {bornAt.toLocaleDateString("en-IN")} {bornAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
        <div className="text-sm" style={{ color: theme.text.muted }}>
          <div>Deploy: {deployLabel}</div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 relative">
        <button onClick={handleSave} title="Save"
          className="p-1.5 rounded-lg" style={{ background: theme.accent.green + "20", color: theme.accent.green }}>
          <Save size={15} />
        </button>
        <button onClick={() => setLoadOpen(v => !v)} title="Load"
          className="p-1.5 rounded-lg" style={{ background: theme.accent.cyan + "20", color: theme.accent.cyan }}>
          <FolderOpen size={15} />
        </button>
        <button onClick={handleExport} title="Export"
          className="p-1.5 rounded-lg" style={{ background: theme.accent.purple + "20", color: theme.accent.purple }}>
          <Download size={15} />
        </button>
        <button onClick={() => flashToast("AI Suggest — coming soon")} title="AI"
          className="p-1.5 rounded-lg" style={{ background: theme.accent.orange + "20", color: theme.accent.orange }}>
          <Sparkles size={15} />
        </button>
        <button onClick={() => flashToast("Settings — coming soon")} title="Settings"
          className="p-1.5 rounded-lg" style={{ background: theme.border.subtle, color: theme.text.muted }}>
          <Settings size={15} />
        </button>

        {loadOpen && (
          <div className="absolute top-full mt-1 right-0 z-30 rounded-xl overflow-hidden w-72"
            style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}` }}>
            <div className="px-3 py-2 text-sm font-bold" style={{ color: theme.text.muted, borderBottom: `1px solid ${theme.border.subtle}` }}>
              Saved Strategies
            </div>
            <div className="max-h-64 overflow-y-auto">
              {savedList.length === 0 ? (
                <div className="text-center py-6 text-sm" style={{ color: theme.text.muted }}>No saved strategies</div>
              ) : savedList.map(s => (
                <div key={s.id} className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${theme.border.subtle}` }}>
                  <div>
                    <div className="text-sm font-bold" style={{ color: theme.text.secondary }}>{s.name}</div>
                    <div className="text-sm" style={{ color: theme.text.faint }}>{s.underlying} • {s.legs.length} legs</div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleLoad(s)} className="text-sm px-2 py-0.5 rounded" style={{ background: theme.accent.cyan + "20", color: theme.accent.cyan }}>Load</button>
                    <button onClick={() => { strategyStorage.deleteStrategy(s.id); setSavedList(strategyStorage.getAll()); }}
                      className="text-sm px-2 py-0.5 rounded" style={{ background: theme.accent.red + "15", color: theme.accent.red }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
            <label className="block px-3 py-2 text-sm font-bold cursor-pointer text-center"
              style={{ color: theme.accent.purple, borderTop: `1px solid ${theme.border.subtle}` }}>
              <Upload size={13} className="inline mr-1" /> Import from file
              <input type="file" accept=".json" className="hidden" onChange={handleImport} />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
