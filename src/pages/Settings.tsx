import { useQuery } from "@tanstack/react-query";
import { fetchHealth, fetchFunds } from "../utils/api";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import { Server, Database, Clock, Shield } from "lucide-react";

export default function Settings() {
  const health = useQuery({ queryKey: ["health"], queryFn: fetchHealth, refetchInterval: 10000 });
  const funds  = useQuery({ queryKey: ["funds"],  queryFn: fetchFunds,  refetchInterval: 30000 });

  const h = health.data;
  const f = funds.data?.data;
  const fmt = (n?: number) => n != null
    ? n.toLocaleString("en-IN", { maximumFractionDigits: 2 })
    : "---";

  return (
    <div className="p-4 space-y-4">
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
              style={{ borderColor: "#0f1e36" }}>
              <span className="text-xs" style={{ color: "#445566" }}>{label}</span>
              <span className="text-xs font-bold" style={{ color: ok ? "#00d97e" : "#f03060" }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Funds */}
      <Card title="Account Funds">
        {funds.isLoading ? (
          <div className="text-xs text-center" style={{ color: "#445566" }}>Loading...</div>
        ) : (
          <div className="space-y-2">
            {[
              { label: "Total Balance", value: f?.total,     color: "#c0d0e8" },
              { label: "Used Margin",   value: f?.used,      color: "#f03060" },
              { label: "Available",     value: f?.available, color: "#00d97e" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between py-1 border-b"
                style={{ borderColor: "#0f1e36" }}>
                <span className="text-xs" style={{ color: "#445566" }}>{label}</span>
                <span className="text-xs font-bold" style={{ color }}>₹{fmt(value)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* API Endpoints */}
      <Card title="API Endpoints">
        <div className="space-y-1">
          {[
            "/api/health",
            "/api/quotes",
            "/api/optionchain",
            "/api/greeks",
            "/api/strategy",
            "/api/scanner",
            "/api/papertrade",
            "/api/portfolio",
            "/api/funds",
            "/api/backtest",
            "/api/historical",
            "/api/scheduler",
          ].map(ep => (
            <div key={ep} className="flex items-center justify-between py-1 border-b"
              style={{ borderColor: "#0f1e36" }}>
              <span className="text-xs font-mono" style={{ color: "#00c8f077" }}>{ep}</span>
              <span className="text-xs" style={{ color: "#00d97e" }}>● Active</span>
            </div>
          ))}
        </div>
      </Card>

      {/* App Info */}
      <Card title="App Info">
        <div className="space-y-2 text-xs" style={{ color: "#445566" }}>
          <div className="flex justify-between">
            <span>Frontend</span>
            <span style={{ color: "#c0d0e8" }}>React + Vite + TypeScript</span>
          </div>
          <div className="flex justify-between">
            <span>Backend</span>
            <span style={{ color: "#c0d0e8" }}>Python Flask v3.0</span>
          </div>
          <div className="flex justify-between">
            <span>Broker</span>
            <span style={{ color: "#c0d0e8" }}>Fyers API v3</span>
          </div>
          <div className="flex justify-between">
            <span>Styling</span>
            <span style={{ color: "#c0d0e8" }}>TailwindCSS</span>
          </div>
          <div className="flex justify-between">
            <span>Charts</span>
            <span style={{ color: "#c0d0e8" }}>Recharts</span>
          </div>
          <div className="flex justify-between">
            <span>State</span>
            <span style={{ color: "#c0d0e8" }}>Zustand + TanStack Query</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
