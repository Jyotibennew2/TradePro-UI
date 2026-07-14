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
  Bot,
  LayoutGrid,
} from "lucide-react";
import { useTheme } from "../../store/themeStore";

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
  { to: "/workspace",  icon: LayoutGrid,       label: "Workspace"  },
  { to: "/ai",         icon: Bot,              label: "AI Chat"    },
  { to: "/settings",  icon: Settings,        label: "Settings"   },
];

export default function Sidebar() {
  const theme = useTheme();
  return (
    <aside className="flex flex-col gap-1 py-3 px-2 h-full"
      style={{ background: theme.bg.header, borderRight: `1px solid ${theme.border.subtle}`, width: 60 }}>
      {NAV.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to} end={to === "/"}
          title={label}
          className="flex items-center justify-center rounded-lg p-2.5 transition-all"
          style={({ isActive }) => ({
            color     : isActive ? theme.accent.cyan : theme.text.muted,
            background: isActive ? theme.accent.cyan + "18" : "transparent",
            border    : isActive ? `1px solid ${theme.accent.cyan}40` : "1px solid transparent",
          })}
        >
          <Icon size={22} strokeWidth={2} />
        </NavLink>
      ))}
    </aside>
  );
}
