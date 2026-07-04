import { useAppStore } from "../../store";
import { useHealth, useQuotes } from "../../hooks/useQuotes";
import { Activity, Zap } from "lucide-react";

export default function Header() {
  useHealth();
  useQuotes();

  const { nifty, bankNifty, isLive, isMock } = useAppStore();

  const fmt = (n: number) =>
    n > 0 ? n.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "---";

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b"
      style={{ background: "#060c1a", borderColor: "#0f1e36" }}>

      {/* Logo */}
      <div className="flex items-center gap-2">
        <Zap size={18} color="#00c8f0" fill="#00c8f0" />
        <span className="font-black text-lg" style={{ color: "#00c8f0" }}>
          TradePro
        </span>
        <span className="text-xs px-1 rounded"
          style={{ background: "#0f1e36", color: "#445566" }}>
          v3.0
        </span>
      </div>

      {/* Quotes */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs"
          style={{ background: "#090f1e", border: "1px solid #0f1e36" }}>
          <span style={{ color: "#445566" }}>N</span>
          <span className="font-bold" style={{ color: "#00c8f0" }}>{fmt(nifty)}</span>
        </div>
        <div className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs"
          style={{ background: "#090f1e", border: "1px solid #0f1e36" }}>
          <span style={{ color: "#445566" }}>BN</span>
          <span className="font-bold" style={{ color: "#9b5cf6" }}>{fmt(bankNifty)}</span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <Activity size={10} color={isLive ? "#00d97e" : "#f0a030"} />
          <span style={{ color: isLive ? "#00d97e" : "#f0a030" }}>
            {isMock ? "MOCK" : "LIVE"}
          </span>
        </div>
      </div>
    </header>
  );
}
