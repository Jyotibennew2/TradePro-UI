interface BadgeProps {
  label   : string;
  variant?: "buy" | "sell" | "neutral" | "strong" | "moderate" | "weak" | "live" | "mock";
}

const COLORS: Record<string, { bg: string; color: string }> = {
  buy     : { bg: "#00d97e20", color: "#00d97e" },
  sell    : { bg: "#f0306020", color: "#f03060" },
  neutral : { bg: "#44556620", color: "#445566" },
  strong  : { bg: "#00c8f020", color: "#00c8f0" },
  moderate: { bg: "#f0a03020", color: "#f0a030" },
  weak    : { bg: "#44556620", color: "#445566" },
  live    : { bg: "#00d97e20", color: "#00d97e" },
  mock    : { bg: "#f0a03020", color: "#f0a030" },
};

export default function Badge({ label, variant = "neutral" }: BadgeProps) {
  const c = COLORS[variant] ?? COLORS.neutral;
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded"
      style={{ background: c.bg, color: c.color }}>
      {label}
    </span>
  );
}
