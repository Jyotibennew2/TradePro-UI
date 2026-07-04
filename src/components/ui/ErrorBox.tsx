import { AlertTriangle } from "lucide-react";

export default function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl p-4"
      style={{ background: "#f0306010", border: "1px solid #f0306030" }}>
      <AlertTriangle size={16} color="#f03060" />
      <span className="text-xs" style={{ color: "#f03060" }}>{message}</span>
    </div>
  );
}
