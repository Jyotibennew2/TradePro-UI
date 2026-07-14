import { useState, useRef, useEffect } from "react";
import { useAppStore } from "../store";
import { useSimulatorStore } from "../simulator/state/simulatorStore";
import { Send, Bot, User, TrendingUp, BarChart2, Zap } from "lucide-react";
import { useTheme } from "../store/themeStore";

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
  const theme = useTheme();
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
        style={{ borderColor: theme.border.subtle, background: theme.bg.surface }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: theme.accent.cyan + "20", border: `1px solid ${theme.accent.cyan}40` }}>
          <Bot size={16} color={theme.accent.cyan} />
        </div>
        <div>
          <div className="text-sm font-bold" style={{ color: theme.accent.cyan }}>TradePro AI</div>
          <div className="text-sm" style={{ color: theme.accent.green }}>● Online • Powered by Claude</div>
        </div>
        <div className="ml-auto flex gap-2 text-sm">
          <span style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}`, borderRadius: 6, padding: "2px 8px", color: theme.text.muted }}>
            N: <span style={{ color: theme.accent.cyan }}>{nifty > 0 ? nifty.toLocaleString("en-IN") : "---"}</span>
          </span>
        </div>
      </div>

      {/* Quick prompts */}
      <div className="flex gap-2 px-3 py-2 overflow-x-auto border-b"
        style={{ borderColor: theme.border.subtle }}>
        {QUICK_PROMPTS.map((p, i) => (
          <button key={i} onClick={() => sendMessage(p.text)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold shrink-0 transition-all"
            style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}`, color: theme.text.muted }}>
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
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1"
              style={{
                background: msg.role === "assistant" ? theme.accent.cyan + "20" : theme.accent.purple + "20",
                border    : `1px solid ${msg.role === "assistant" ? theme.accent.cyan + "40" : theme.accent.purple + "40"}`,
              }}>
              {msg.role === "assistant"
                ? <Bot  size={16} color={theme.accent.cyan} />
                : <User size={16} color={theme.accent.purple} />
              }
            </div>

            {/* Bubble */}
            <div className="max-w-xs">
              <div className="rounded-2xl px-3 py-2 text-sm"
                style={{
                  background  : msg.role === "assistant" ? theme.bg.surfaceAlt : theme.accent.purple + "20",
                  border      : `1px solid ${msg.role === "assistant" ? theme.border.subtle : theme.accent.purple + "40"}`,
                  color       : theme.text.secondary,
                  whiteSpace  : "pre-wrap",
                  lineHeight  : 1.6,
                }}>
                {msg.content}
              </div>
              <div className="text-sm mt-0.5 px-1" style={{ color: theme.text.faint }}>
                {msg.time}
              </div>
            </div>
          </div>
        ))}

        {/* Loading */}
        {loading && (
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: theme.accent.cyan + "20", border: `1px solid ${theme.accent.cyan}40` }}>
              <Bot size={16} color={theme.accent.cyan} />
            </div>
            <div className="rounded-2xl px-4 py-3"
              style={{ background: theme.bg.surfaceAlt, border: `1px solid ${theme.border.subtle}` }}>
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{ background: theme.accent.cyan, animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t" style={{ borderColor: theme.border.subtle }}>
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
            className="flex-1 px-3 py-2 rounded-xl text-sm outline-none resize-none"
            style={{
              background: theme.bg.surfaceAlt,
              border    : `1px solid ${theme.border.subtle}`,
              color     : theme.text.secondary,
            }}
          />
          <button onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="p-3 rounded-xl flex items-center justify-center"
            style={{
              background: input.trim() && !loading ? theme.accent.cyan : theme.border.subtle,
              color     : input.trim() && !loading ? theme.bg.page : theme.text.muted,
            }}>
            <Send size={18} />
          </button>
        </div>
        <div className="text-sm text-center mt-1" style={{ color: theme.text.faint }}>
          Educational purposes only • Not financial advice
        </div>
      </div>
    </div>
  );
}
