import type { ReactNode } from "react";
import { useTheme } from "../../store/themeStore";

interface CardProps {
  children : ReactNode;
  className?: string;
  title?   : string;
  extra?   : ReactNode;
}

export default function Card({ children, className = "", title, extra }: CardProps) {
  const theme = useTheme();
  return (
    <div
      className={`rounded-xl ${className}`}
      style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}` }}
    >
      {title && (
        <div className="flex items-center justify-between px-4 py-2 border-b"
          style={{ borderColor: theme.border.subtle }}>
          <span className="text-xs font-bold tracking-widest uppercase"
            style={{ color: theme.text.muted }}>{title}</span>
          {extra}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
