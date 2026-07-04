export default function Loader({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: "#00c8f0", borderTopColor: "transparent" }} />
      <span className="text-xs" style={{ color: "#445566" }}>{text}</span>
    </div>
  );
}
