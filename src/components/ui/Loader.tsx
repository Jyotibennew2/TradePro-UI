import { useTheme } from "../../store/themeStore";

export default function Loader({ text = "Loading..." }: { text?: string }) {
  const theme = useTheme();
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: theme.accent.cyan, borderTopColor: "transparent" }} />
      <span className="text-sm" style={{ color: theme.text.muted }}>{text}</span>
    </div>
  );
}
