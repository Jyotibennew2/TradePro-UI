import { AlertTriangle } from "lucide-react";
import { useTheme } from "../../store/themeStore";

export default function ErrorBox({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <div className="flex items-center gap-3 rounded-xl p-4"
      style={{ background: theme.accent.red + "10", border: `1px solid ${theme.accent.red}30` }}>
      <AlertTriangle size={18} color={theme.accent.red} />
      <span className="text-sm" style={{ color: theme.accent.red }}>{message}</span>
    </div>
  );
}
