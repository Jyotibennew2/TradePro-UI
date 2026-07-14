import { useTheme } from "../../store/themeStore";

interface BadgeProps {
  label   : string;
  variant?: "buy" | "sell" | "neutral" | "strong" | "moderate" | "weak" | "live" | "mock";
}

export default function Badge({ label, variant = "neutral" }: BadgeProps) {
  const theme = useTheme();

  const COLORS: Record<string, string> = {
    buy     : theme.accent.green,
    sell    : theme.accent.red,
    neutral : theme.text.muted,
    strong  : theme.accent.cyan,
    moderate: theme.accent.orange,
    weak    : theme.text.muted,
    live    : theme.accent.green,
    mock    : theme.accent.orange,
  };

  const color = COLORS[variant] ?? COLORS.neutral;

  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded"
      style={{ background: color + "20", color }}>
      {label}
    </span>
  );
}
