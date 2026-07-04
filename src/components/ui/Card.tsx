import { ReactNode } from "react";

interface CardProps {
  children : ReactNode;
  className?: string;
  title?   : string;
  extra?   : ReactNode;
}

export default function Card({ children, className = "", title, extra }: CardProps) {
  return (
    <div
      className={`rounded-xl ${className}`}
      style={{ background: "#090f1e", border: "1px solid #0f1e36" }}
    >
      {title && (
        <div className="flex items-center justify-between px-4 py-2 border-b"
          style={{ borderColor: "#0f1e36" }}>
          <span className="text-xs font-bold tracking-widest uppercase"
            style={{ color: "#445566" }}>{title}</span>
          {extra}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
