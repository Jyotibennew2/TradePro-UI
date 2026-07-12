import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  GitBranch,
  Radar,
  Lightbulb,
  ClipboardList,
  PieChart,
  Settings,
  BarChart2,
  History,
  Compass,
} from "lucide-react";

const NAV = [
  { to: "/",          icon: LayoutDashboard, label: "Dashboard"  },
  { to: "/chain",     icon: GitBranch,       label: "Option Chain"},
  { to: "/scanner",   icon: Radar,           label: "Scanner"    },
  { to: "/strategy",  icon: Lightbulb,       label: "Strategy"   },
  { to: "/paper",     icon: ClipboardList,   label: "Paper Trade"},
  { to: "/portfolio", icon: PieChart,        label: "Portfolio"  },
  { to: "/simulator", icon: BarChart2,       label: "Simulator"  },
  { to: "/backtest",  icon: History,         label: "Backtest"   },
  { to: "/screener2", icon: Compass,         label: "Screener"   },
  { to: "/settings",  icon: Settings,        label: "Settings"   },
];

export default function Sidebar() {
  return (
    <aside className="flex flex-col gap-1 py-3 px-2 h-full"
      style={{ background: "#060c1a", borderRight: "1px solid #0f1e36", width: 52 }}>
      {NAV.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to} end={to === "/"}
          title={label}
          className={({ isActive }) =>
            `flex items-center justify-center rounded-lg p-2 transition-all ${
              isActive ? "bg-cyan-500/10" : "hover:bg-white/5"
            }`
          }
          style={({ isActive }) => ({
            color : isActive ? "#00c8f0" : "#445566",
            border: isActive ? "1px solid #00c8f030" : "1px solid transparent",
          })}
        >
          <Icon size={18} />
        </NavLink>
      ))}
    </aside>
  );
}
