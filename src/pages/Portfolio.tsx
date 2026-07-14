import { useQuery } from "@tanstack/react-query";
import { fetchPortfolio } from "../utils/api";
import Card from "../components/ui/Card";
import Loader from "../components/ui/Loader";
import ErrorBox from "../components/ui/ErrorBox";
import { PieChart, Pie, Cell } from "recharts";
import { useTheme } from "../store/themeStore";

export default function Portfolio() {
  const theme = useTheme();
  const { data, isLoading, isError } = useQuery({
    queryKey      : ["portfolio"],
    queryFn       : fetchPortfolio,
    refetchInterval: 5000,
  });

  const p   = data?.data;
  const fmt = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

  const pieData = p ? [
    { name: "Available",  value: Math.max(p.available,      0), color: theme.accent.green },
    { name: "Used Margin",value: Math.max(p.used_margin,    0), color: theme.accent.red },
  ] : [];

  const pnlData = p ? [
    { name: "Realized",   value: p.realized_pnl   },
    { name: "Unrealized", value: p.unrealized_pnl },
    { name: "Total",      value: p.total_pnl      },
  ] : [];

  if (isLoading) return <Loader text="Loading portfolio..." />;
  if (isError)   return <div className="p-4"><ErrorBox message="Failed to load portfolio" /></div>;
  if (!p)        return null;

  return (
    <div className="p-4 space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Capital",     value: `₹${fmt(p.capital)}`,        color: theme.text.secondary },
          { label: "Available",   value: `₹${fmt(p.available)}`,      color: theme.accent.green },
          { label: "Used Margin", value: `₹${fmt(p.used_margin)}`,    color: theme.accent.red },
          { label: "Open Trades", value: `${p.open_count}`,           color: theme.accent.cyan },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl p-3 text-center"
            style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}` }}>
            <div className="text-sm mb-1" style={{ color: theme.text.muted }}>{label}</div>
            <div className="text-base font-black" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* PnL summary */}
      <Card title="P&L Summary">
        <div className="grid grid-cols-3 gap-2 text-center">
          {pnlData.map(({ name, value }) => (
            <div key={name}>
              <div className="text-sm mb-1" style={{ color: theme.text.muted }}>{name}</div>
              <div className="text-sm font-bold"
                style={{ color: value >= 0 ? theme.accent.green : theme.accent.red }}>
                {value >= 0 ? "+" : ""}₹{fmt(value)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Margin pie chart */}
      {p.capital > 0 && (
        <Card title="Margin Utilization">
          <div className="flex items-center justify-center gap-6">
            <PieChart width={120} height={120}>
              <Pie
                data={pieData}
                cx={55} cy={55}
                innerRadius={35}
                outerRadius={55}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
            <div className="space-y-2">
              {pieData.map(({ name, value, color }) => (
                <div key={name} className="flex items-center gap-2 text-sm">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  <span style={{ color: theme.text.muted }}>{name}</span>
                  <span style={{ color }}>₹{fmt(value)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Open positions */}
      {p.open_positions.length > 0 && (
        <Card title={`Open Positions (${p.open_count})`}>
          <div className="space-y-2">
            {p.open_positions.map((pos: any) => (
              <div key={pos.order_id} className="rounded-lg p-3"
                style={{ background: theme.bg.surface, border: `1px solid ${theme.border.subtle}` }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold" style={{ color: theme.text.secondary }}>
                      {pos.symbol} {pos.strike} {pos.option_type}
                    </div>
                    <div className="text-sm mt-0.5" style={{ color: theme.text.muted }}>
                      {pos.action} • Qty: {pos.qty} • Entry: ₹{pos.entry_price}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold"
                      style={{ color: (pos.mtm ?? 0) >= 0 ? theme.accent.green : theme.accent.red }}>
                      ₹{fmt(pos.mtm ?? 0)}
                    </div>
                    <div className="text-sm mt-0.5" style={{ color: theme.text.muted }}>MTM</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {p.open_positions.length === 0 && (
        <div className="text-center py-10" style={{ color: theme.text.muted }}>
          <div className="text-3xl mb-2">💼</div>
          <div className="text-sm">No open positions</div>
          <div className="text-sm mt-1">Go to Paper Trade to place orders</div>
        </div>
      )}
    </div>
  );
}
