import { useQuery } from "@tanstack/react-query";
import { fetchHealth, fetchFunds } from "../utils/api";
import Card from "../components/ui/Card";
import { Sun, Moon } from "lucide-react";
import { useTheme, useThemeStore } from "../store/themeStore";

export default function Settings() {
  const theme = useTheme();
  const { mode, toggle } = useThemeStore();
  const health = useQuery({ queryKey: ["health"], queryFn: fetchHealth, refetchInterval: 10000 });
  const funds  = useQuery({ queryKey: ["funds"],  queryFn: fetchFunds,  refetchInterval: 30000 });

  const h = health.data;
  const f = funds.data?.data;
  const fmt = (n?: number) => n != null
    ? n.toLocaleString("en-IN", { maximumFractionDigits: 2 })
    : "---";

  return (
    <div className="p-4 space-y-4">
      {/* Appearance */}
      <Card title="Appearance">
        <div className="flex items-center justify-between py-1">
          <span className="text-sm" style={{ color: theme.text.muted }}>Theme</span>
          <button onClick={toggle}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold"
            style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}`, color: theme.text.secondary }}>
            {mode === "light" ? <><Sun size={16} /> Light</> : <><Moon size={16} /> Dark</>}
          </button>
        </div>
      </Card>

      {/* Server Status */}
      <Card title="Server Status">
        <div className="space-y-3">
          {[
            { label: "Backend",       value: h ? "Online"            : "Offline", ok: !!h              },
            { label: "Fyers Auth",    value: h?.authenticated ? "Authenticated" : "Not Auth", ok: h?.authenticated },
            { label: "Data Mode",     value: h?.mock_mode ? "MOCK" : "LIVE",      ok: !h?.mock_mode    },
            { label: "Version",       value: h?.version ?? "---",                 ok: true             },
          ].map(({ label, value, ok }) => (
            <div key={label} className="flex items-center justify-between py-1 border-b"
              style={{ borderColor: theme.border.subtle }}>
              <span className="text-sm" style={{ color: theme.text.muted }}>{label}</span>
              <span className="text-sm font-bold" style={{ color: ok ? theme.accent.green : theme.accent.red }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Funds */}
      <Card title="Account Funds">
        {funds.isLoading ? (
          <div className="text-sm text-center" style={{ color: theme.text.muted }}>Loading...</div>
        ) : (
          <div className="space-y-2">
            {[
              { label: "Total Balance", value: f?.total,     color: theme.text.secondary },
              { label: "Used Margin",   value: f?.used,      color: theme.accent.red },
              { label: "Available",     value: f?.available, color: theme.accent.green },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between py-1 border-b"
                style={{ borderColor: theme.border.subtle }}>
                <span className="text-sm" style={{ color: theme.text.muted }}>{label}</span>
                <span className="text-sm font-bold" style={{ color }}>₹{fmt(value)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* API Endpoints */}
      <Card title="API Endpoints">
        <div className="space-y-1">
          {[
            "/api/health", "/api/quotes", "/api/optionchain", "/api/greeks",
            "/api/strategy", "/api/scanner", "/api/papertrade", "/api/portfolio",
            "/api/funds", "/api/backtest", "/api/historical", "/api/scheduler",
          ].map(ep => (
            <div key={ep} className="flex items-center justify-between py-1 border-b"
              style={{ borderColor: theme.border.subtle }}>
              <span className="text-sm font-mono" style={{ color: theme.accent.cyan }}>{ep}</span>
              <span className="text-sm" style={{ color: theme.accent.green }}>● Active</span>
            </div>
          ))}
        </div>
      </Card>

      {/* App Info */}
      <Card title="App Info">
        <div className="space-y-2 text-sm" style={{ color: theme.text.muted }}>
          <div className="flex justify-between">
            <span>Frontend</span>
            <span style={{ color: theme.text.secondary }}>React + Vite + TypeScript</span>
          </div>
          <div className="flex justify-between">
            <span>Backend</span>
            <span style={{ color: theme.text.secondary }}>Python Flask v3.0</span>
          </div>
          <div className="flex justify-between">
            <span>Broker</span>
            <span style={{ color: theme.text.secondary }}>Fyers API v3</span>
          </div>
          <div className="flex justify-between">
            <span>Styling</span>
            <span style={{ color: theme.text.secondary }}>TailwindCSS</span>
          </div>
          <div className="flex justify-between">
            <span>Charts</span>
            <span style={{ color: theme.text.secondary }}>Recharts</span>
          </div>
          <div className="flex justify-between">
            <span>State</span>
            <span style={{ color: theme.text.secondary }}>Zustand + TanStack Query</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
