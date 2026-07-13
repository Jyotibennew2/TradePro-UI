import { useState, useRef, useEffect } from "react";
import { useAppStore } from "../store";
import { useSimulatorStore } from "../simulator/state/simulatorStore";
import { Send, Bot, User, TrendingUp, BarChart2, Zap } from "lucide-react";

interface Message {
  role   : "user" | "assistant";
  content: string;
  time   : string;
}

const QUICK_PROMPTS = [
  { icon: "📊", label: "Market Analysis",    text: "Analyze current NIFTY market conditions and suggest best options strategy" },
  { icon: "🦅", label: "Iron Condor Setup",  text: "Give me Iron Condor setup for current NIFTY levels with exact strikes and premiums" },
  { icon: "📉", label: "Bearish Strategy",   text: "Market looks bearish today, what options strategy should I use?" },
  { icon: "⚡", label: "IV Analysis",         text: "Current IV is 15%, is it good time to sell options or buy?" },
  { icon: "🎯", label: "Strike Selection",   text: "Help me select best strikes for Short Straddle on NIFTY" },
  { icon: "🛡️", label: "Risk Management",   text: "What is my max risk if I sell 1 lot NIFTY ATM straddle?" },
  { icon: "📈", label: "Bullish Strategy",   text: "I am bullish on NIFTY for next week, suggest options strategy" },
  { icon: "🔄", label: "Adjustment Tips",   text: "My Iron Condor is going ITM on CE side, how to adjust?" },
];

export default function AIAssistant() {
  const { nifty, bankNifty } = useAppStore();
  const legs = useSimulatorStore(s => s.legs);
  const iv   = useSimulatorStore(s => s.iv);

  const [messages, setMessages] = useState<Message[]>([
    {
      role   : "assistant",
      content: `Namaste! 🙏 Main TradePro AI Assistant hoon.\n\nMain aapki help kar sakta hoon:\n• Options strategy selection\n• Strike price analysis\n• Risk management\n• Market analysis\n• Greeks explanation\n• Trade adjustments\n\nAbhi NIFTY: ₹${nifty > 0 ? nifty.toLocaleString("en-IN") : "Loading..."} | BankNifty: ₹${bankNifty > 0 ? bankNifty.toLocaleString("en-IN") : "Loading..."}\n\nKya poochna chahte hain?`,
      time   : new Date().toLocaleTimeString("en-IN"),
    }
  ]);
  const [input,   setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const getContext = () => {
    let ctx = `Current market data:\n- NIFTY: ₹${nifty.toLocaleString("en-IN")}\n- BankNifty: ₹${bankNifty.toLocaleString("en-IN")}\n- IV: ${iv}%`;
    if (legs.length > 0) {
      ctx += `\n\nCurrent strategy in simulator:\n`;
      legs.forEach(leg => {
        ctx += `- ${leg.action} ${leg.contract.symbol} ${leg.contract.strike} ${leg.contract.optionType} @ ₹${leg.entryPrice} (${leg.lots} lot)\n`;
      });
    }
    return ctx;
  };

  const sendMessage = async (text?: string) => {
    const userText = text || input.trim();
    if (!userText || loading) return;

    const userMsg: Message = {
      role   : "user",
      content: userText,
      time   : new Date().toLocaleTimeString("en-IN"),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const systemPrompt = `You are TradePro AI, an expert options trading assistant for Indian markets (NSE). You help traders with NIFTY and BankNifty options strategies.

Always respond in Hinglish (mix of Hindi and English) to be friendly and easy to understand for Indian traders.

${getContext()}

Rules:
- Always mention specific strike prices and premiums when suggesting strategies
- Explain risk clearly in rupees
- Keep responses concise and actionable
- Add relevant emojis to make it engaging
- Always mention stop loss levels
- Disclaimer: These are educational suggestions, not financial advice`;

      const response = await fetch("/api/ai/chat", {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify({
          system  : systemPrompt,
          messages: [
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: userText }
          ],
        }),
      });

      const data = await response.json();
      const aiText = data.success ? data.text : "Sorry, kuch problem aayi. Please try again.";

      setMessages(prev => [...prev, {
        role   : "assistant",
        content: aiText,
        time   : new Date().toLocaleTimeString("en-IN"),
      }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role   : "assistant",
        content: "❌ Network error. Please check connection and try again.",
        time   : new Date().toLocaleTimeString("en-IN"),
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b"
        style={{ borderColor: "#0f1e36", background: "#060c1a" }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: "#00c8f020", border: "1px solid #00c8f040" }}>
          <Bot size={16} color="#00c8f0" />
        </div>
        <div>
          <div className="text-sm font-bold" style={{ color: "#00c8f0" }}>TradePro AI</div>
          <div className="text-xs" style={{ color: "#00d97e" }}>● Online • Powered by Claude</div>
        </div>
        <div className="ml-auto flex gap-2 text-xs">
          <span style={{ background: "#090f1e", border: "1px solid #0f1e36", borderRadius: 6, padding: "2px 8px", color: "#445566" }}>
            N: <span style={{ color: "#00c8f0" }}>{nifty > 0 ? nifty.toLocaleString("en-IN") : "---"}</span>
          </span>
        </div>
      </div>

      {/* Quick prompts */}
      <div className="flex gap-2 px-3 py-2 overflow-x-auto border-b"
        style={{ borderColor: "#0f1e36" }}>
        {QUICK_PROMPTS.map((p, i) => (
          <button key={i} onClick={() => sendMessage(p.text)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all"
            style={{ background: "#090f1e", border: "1px solid #0f1e36", color: "#445566" }}>
            <span>{p.icon}</span>
            <span>{p.label}</span>
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            {/* Avatar */}
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1"
              style={{
                background: msg.role === "assistant" ? "#00c8f020" : "#9b5cf620",
                border    : `1px solid ${msg.role === "assistant" ? "#00c8f040" : "#9b5cf640"}`,
              }}>
              {msg.role === "assistant"
                ? <Bot  size={12} color="#00c8f0" />
                : <User size={12} color="#9b5cf6" />
              }
            </div>

            {/* Bubble */}
            <div className="max-w-xs">
              <div className="rounded-2xl px-3 py-2 text-xs"
                style={{
                  background  : msg.role === "assistant" ? "#090f1e" : "#9b5cf620",
                  border      : `1px solid ${msg.role === "assistant" ? "#0f1e36" : "#9b5cf640"}`,
                  color       : "#c0d0e8",
                  whiteSpace  : "pre-wrap",
                  lineHeight  : 1.6,
                }}>
                {msg.content}
              </div>
              <div className="text-xs mt-0.5 px-1" style={{ color: "#334455" }}>
                {msg.time}
              </div>
            </div>
          </div>
        ))}

        {/* Loading */}
        {loading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: "#00c8f020", border: "1px solid #00c8f040" }}>
              <Bot size={12} color="#00c8f0" />
            </div>
            <div className="rounded-2xl px-4 py-3"
              style={{ background: "#090f1e", border: "1px solid #0f1e36" }}>
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{ background: "#00c8f0", animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t" style={{ borderColor: "#0f1e36" }}>
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Options strategy poochho... (e.g. NIFTY ke liye best strategy?)"
            rows={2}
            className="flex-1 px-3 py-2 rounded-xl text-xs outline-none resize-none"
            style={{
              background: "#090f1e",
              border    : "1px solid #0f1e36",
              color     : "#c0d0e8",
            }}
          />
          <button onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="p-3 rounded-xl flex items-center justify-center"
            style={{
              background: input.trim() && !loading ? "#00c8f0" : "#0f1e36",
              color     : input.trim() && !loading ? "#03050d" : "#445566",
            }}>
            <Send size={16} />
          </button>
        </div>
        <div className="text-xs text-center mt-1" style={{ color: "#334455" }}>
          Educational purposes only • Not financial advice
        </div>
      </div>
    </div>
  );
}
