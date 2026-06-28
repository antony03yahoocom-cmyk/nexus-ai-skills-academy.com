import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  MessageCircle, X, Send, Bot, User, Loader2,
  Copy, Check, Trash2, ChevronDown, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────
type Msg = { role: "user" | "assistant"; content: string; ts?: number };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-chatbot`;
const DEFAULT_POS = { right: 24, bottom: 24 };

type DragState = {
  active: boolean;
  startX: number; startY: number;
  startRight: number; startBottom: number;
  moved: boolean;
};

// ── Strip markdown to plain text for clipboard ─────────────────────
function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, "").trim())
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "• ")
    .trim();
}

// ── Markdown renderer ──────────────────────────────────────────────
function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  let i = 0;
  const blocks: JSX.Element[] = [];

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push(
        <pre key={i} className="my-2 overflow-x-auto rounded-lg bg-black/20 border border-white/10 px-3 py-2 text-xs font-mono leading-relaxed">
          {lang && <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">{lang}</span>}
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      i++;
      continue;
    }

    // Headings
    if (line.startsWith("### ")) { blocks.push(<p key={i} className="font-semibold text-sm mt-3 mb-1">{renderInline(line.slice(4))}</p>); i++; continue; }
    if (line.startsWith("## "))  { blocks.push(<p key={i} className="font-semibold mt-3 mb-1">{renderInline(line.slice(3))}</p>); i++; continue; }
    if (line.startsWith("# "))   { blocks.push(<p key={i} className="font-bold mt-3 mb-1">{renderInline(line.slice(2))}</p>); i++; continue; }

    // Unordered list — collect consecutive list items
    if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
        items.push(lines[i].slice(2));
        i++;
      }
      blocks.push(
        <ul key={i} className="my-1 space-y-0.5 pl-2">
          {items.map((item, j) => (
            <li key={j} className="flex gap-1.5 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      let num = 1;
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      blocks.push(
        <ol key={i} className="my-1 space-y-0.5 pl-2">
          {items.map((item, j) => (
            <li key={j} className="flex gap-2 text-sm">
              <span className="shrink-0 font-mono text-primary text-xs mt-0.5">{j + 1}.</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Blank line
    if (line.trim() === "") { blocks.push(<div key={i} className="h-1.5" />); i++; continue; }

    // Paragraph
    blocks.push(<p key={i} className="text-sm leading-relaxed">{renderInline(line)}</p>);
    i++;
  }

  return <div className="space-y-0.5">{blocks}</div>;
}

function renderInline(text: string): JSX.Element {
  const parts: (string | JSX.Element)[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(<code key={key++} className="rounded bg-black/20 px-1 py-0.5 text-xs font-mono border border-white/10">{codeMatch[1]}</code>);
      remaining = remaining.slice(codeMatch[0].length); continue;
    }
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      parts.push(<strong key={key++} className="font-semibold">{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch[0].length); continue;
    }
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      parts.push(<em key={key++}>{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch[0].length); continue;
    }
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      parts.push(<a key={key++} href={linkMatch[2]} className="text-primary underline underline-offset-2 hover:opacity-80" target="_blank" rel="noopener noreferrer">{linkMatch[1]}</a>);
      remaining = remaining.slice(linkMatch[0].length); continue;
    }
    const next = remaining.slice(1).search(/[`*\[]/);
    if (next === -1) { parts.push(remaining); break; }
    parts.push(remaining.slice(0, next + 1));
    remaining = remaining.slice(next + 1);
  }

  return <>{parts}</>;
}

// ── Typing indicator ───────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
          style={{ animationDelay: `${i * 150}ms`, animationDuration: "900ms" }}
        />
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────
export default function StudentChatbot() {
  const { session, user } = useAuth();

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ right: number; bottom: number }>(() => {
    try { const raw = localStorage.getItem("nexus_chatbot_pos"); if (raw) return JSON.parse(raw); } catch {}
    return DEFAULT_POS;
  });

  const dragStateRef = useRef<DragState | null>(null);

  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: "Hi! 👋 I'm **NEXUS AI Assistant** — your personal learning guide.\n\nI can help you:\n- Understand course concepts\n- Work through assignments\n- Navigate the platform\n- Explore career opportunities\n\nWhat would you like to explore today?",
      ts: Date.now(),
    },
  ]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const scrollRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 100);
  }, [open]);

  // ── Drag handling ────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      const d = dragStateRef.current;
      if (!d?.active) return;
      const isTouch = "touches" in e;
      const cx = isTouch ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      const cy = isTouch ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
      if (isTouch) e.preventDefault();
      const dx = cx - d.startX, dy = cy - d.startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) d.moved = true;
      setPos({
        right:  Math.max(8, Math.round(d.startRight  - dx)),
        bottom: Math.max(8, Math.round(d.startBottom - dy)),
      });
    };
    const onUp = () => {
      if (!dragStateRef.current?.active) return;
      if (dragStateRef.current.moved) {
        try { localStorage.setItem("nexus_chatbot_pos", JSON.stringify(pos)); } catch {}
      }
      if (dragStateRef.current) dragStateRef.current.active = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: false } as AddEventListenerOptions);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove as EventListener);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    };
  }, [pos]);

  const startDrag = (clientX: number, clientY: number) => {
    dragStateRef.current = {
      active: true, moved: false,
      startX: clientX, startY: clientY,
      startRight: pos.right, startBottom: pos.bottom,
    };
  };

  // ── Copy handler ─────────────────────────────────────────────────
  const copyMessage = useCallback(async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(stripMarkdown(text));
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement("textarea");
      el.value = stripMarkdown(text);
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    }
  }, []);

  // ── Clear chat ───────────────────────────────────────────────────
  const clearChat = useCallback(() => {
    setMessages([{
      role: "assistant",
      content: "Chat cleared! How can I help you?",
      ts: Date.now(),
    }]);
  }, []);

  // ── Send message ─────────────────────────────────────────────────
  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Msg = { role: "user", content: text, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    let assistantSoFar = "";

    try {
      const token = session?.access_token;
      if (!user || !token) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Please sign in to use the AI assistant.", ts: Date.now() }]);
        setLoading(false);
        return;
      }

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })) }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setMessages((prev) => [...prev, { role: "assistant", content: err.error || "Something went wrong. Please try again.", ts: Date.now() }]);
        setLoading(false);
        return;
      }

      if (!resp.body) throw new Error("No stream");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let streamStarted = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let nlIdx: number;
        while ((nlIdx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nlIdx).replace(/\r$/, "");
          buf = buf.slice(nlIdx + 1);
          if (!line.startsWith("data: ") || line.trim() === "") continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const chunk = JSON.parse(jsonStr);
            const content = chunk.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              const ts = Date.now();
              if (!streamStarted) {
                streamStarted = true;
                setMessages((prev) => [...prev, { role: "assistant", content: assistantSoFar, ts }]);
              } else {
                setMessages((prev) => {
                  const next = [...prev];
                  next[next.length - 1] = { role: "assistant", content: assistantSoFar, ts };
                  return next;
                });
              }
            }
          } catch { /* parse errors during stream are normal */ }
        }
      }
    } catch (err) {
      console.error("Chatbot error:", err);
      setMessages((prev) => [...prev, { role: "assistant", content: "Connection issue — please try again.", ts: Date.now() }]);
    }

    setLoading(false);
  }, [input, loading, messages, session, user]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const toggleOpen = () => {
    if (dragStateRef.current?.moved) { dragStateRef.current.moved = false; return; }
    setOpen((o) => !o);
  };

  const PANEL_GAP = 12; // px between bubble top and panel bottom
  const BUBBLE_H  = 56; // h-14

  return (
    <>
      {/* ── Chat panel — floats ABOVE the bubble ─────────────────── */}
      {open && (
        <div
          style={{ right: pos.right, bottom: pos.bottom + BUBBLE_H + PANEL_GAP }}
          className="fixed z-50 w-[380px] max-w-[calc(100vw-2rem)] flex flex-col rounded-2xl border border-border/50 bg-background shadow-2xl overflow-hidden"
          // Height: fills from its bottom position up to 8rem from viewport top
          // (handled by max-height so it never overflows)
          // min-height keeps it usable on large screens
          // Use dynamic style instead of Tailwind for the bottom-constrained height
          // eslint-disable-next-line react/forbid-dom-props
        >
          {/* Header — also the drag handle */}
          <div
            onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
            onTouchStart={(e) => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
            className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-primary/90 to-primary text-primary-foreground shrink-0 cursor-grab active:cursor-grabbing select-none"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/20">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight">NEXUS AI Assistant</p>
              <p className="text-[11px] opacity-75 leading-tight">Powered by Claude · Ask me anything</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={clearChat}
                title="Clear chat"
                className="flex h-7 w-7 items-center justify-center rounded-lg opacity-70 hover:opacity-100 hover:bg-primary-foreground/20 transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              {/* Close button in header — same action as tapping the bubble */}
              <button
                onClick={() => setOpen(false)}
                title="Close"
                className="flex h-7 w-7 items-center justify-center rounded-lg opacity-70 hover:opacity-100 hover:bg-primary-foreground/20 transition-all"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[420px]"
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-2.5",
                  msg.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                {/* Bot avatar */}
                {msg.role === "assistant" && (
                  <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}

                <div className={cn("flex flex-col gap-1", msg.role === "user" ? "items-end" : "items-start")}>
                  {/* Bubble */}
                  <div
                    className={cn(
                      "relative rounded-2xl px-3.5 py-2.5 max-w-[88%] group",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted/70 border border-border/40 rounded-bl-sm",
                    )}
                  >
                    {msg.role === "assistant" ? (
                      <MarkdownText text={msg.content} />
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>

                  {/* Copy button — only on assistant messages, appears below bubble */}
                  {msg.role === "assistant" && (
                    <button
                      onClick={() => copyMessage(msg.content, i)}
                      title={copiedIdx === i ? "Copied!" : "Copy response"}
                      className={cn(
                        "flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all",
                        copiedIdx === i
                          ? "text-primary bg-primary/10"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                      )}
                    >
                      {copiedIdx === i ? (
                        <><Check className="h-3 w-3" /> Copied</>
                      ) : (
                        <><Copy className="h-3 w-3" /> Copy</>
                      )}
                    </button>
                  )}
                </div>

                {/* User avatar */}
                {msg.role === "user" && (
                  <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {loading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-2.5">
                <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="bg-muted/70 border border-border/40 rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                  <TypingDots />
                </div>
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="border-t border-border/50 bg-background/80 p-3 shrink-0">
            <div className="flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything… (Enter to send)"
                className="min-h-[40px] max-h-[120px] resize-none text-sm bg-muted/40 border-border/40 focus:bg-background transition-colors"
                rows={1}
                disabled={loading}
              />
              <Button
                size="icon"
                onClick={send}
                disabled={loading || !input.trim()}
                className="h-10 w-10 shrink-0 rounded-xl"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground/60 text-center">
              Shift+Enter for new line · AI responses may not always be accurate
            </p>
          </div>
        </div>
      )}

      {/* ── Toggle bubble — always visible, tapping it opens/closes ─ */}
      <button
        onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
        onTouchStart={(e) => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
        onClick={toggleOpen}
        style={{ right: pos.right, bottom: pos.bottom }}
        className={cn(
          "fixed z-50 h-14 w-14 rounded-full shadow-lg flex items-center justify-center touch-none select-none transition-all duration-200",
          open
            ? "bg-muted text-foreground hover:bg-muted/80 shadow-md"
            : "bg-primary text-primary-foreground hover:scale-105 active:scale-95 glow-primary",
        )}
        aria-label={open ? "Close chat" : "Open AI assistant"}
        title={open ? "Close chat" : "Ask NEXUS AI"}
      >
        <div className="relative">
          {open ? (
            <X className="h-5 w-5" />
          ) : (
            <>
              <MessageCircle className="h-6 w-6" />
              {/* Unread pulse — only show when closed */}
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-400 border-2 border-background" />
            </>
          )}
        </div>
      </button>
    </>
  );
}
