"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type ChatMessage = {
  id: string;
  sender: "CUSTOMER" | "ADMIN";
  message: string;
  createdAt: string;
};

// مرکز پیام (صفحه‌ی کامل) -- همان گفتگوی پشتیبانی ولی تمام‌صفحه و زنده:
// پیام‌های جدید با SSE همان‌لحظه می‌رسند و «در حال نوشتن» نمایش داده می‌شود.
export function MessageCenter() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adminTyping, setAdminTyping] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const typingSentRef = useRef(false);

  const loadMessages = useCallback(async () => {
    const res = await fetch("/api/support/messages");
    const data = res.ok ? await res.json() : { messages: [] };
    setMessages(data.messages ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // اتصال زنده: پیام جدید + «ادمین در حال نوشتن است»
  useEffect(() => {
    const es = new EventSource("/api/support/stream");
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as
          | { type: "message"; userId: string; message: ChatMessage }
          | { type: "typing"; userId: string; sender: "CUSTOMER" | "ADMIN"; typing: boolean };
        if (event.type === "message") {
          setMessages((prev) => (prev.some((m) => m.id === event.message.id) ? prev : [...prev, event.message]));
          setLoading(false);
        } else if (event.type === "typing" && event.sender === "ADMIN") {
          setAdminTyping(event.typing);
        }
      } catch {
        // داده‌ی خراب از سوکت -- نادیده بگیر
      }
    };
    es.onerror = () => {
      // EventSource خودکار دوباره متصل می‌شود
    };
    return () => es.close();
  }, []);

  // تایپینگ تایمر: بعد از ۲.۵ ثانیه بی‌حرکتی «در حال نوشتن» را خاموش کن
  useEffect(() => {
    if (!adminTyping) return;
    const t = setTimeout(() => setAdminTyping(false), 2500);
    return () => clearTimeout(t);
  }, [adminTyping]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, adminTyping]);

  async function sendTyping(typing: boolean) {
    if (typing === typingSentRef.current) return;
    typingSentRef.current = typing;
    fetch("/api/support/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ typing }),
    }).catch(() => {});
  }

  async function handleSend() {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setError("");
    const res = await fetch("/api/support/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: body }),
    });
    setSending(false);
    sendTyping(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }
      setError(data.error ?? "خطا در ارسال پیام");
      return;
    }
    setText("");
    // پیام خودمان از طریق SSE می‌رسد
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold mb-4">پیام‌ها — پشتیبانی مُداشاپ</h1>

      <div className="border cut-line rounded-2xl bg-white overflow-hidden flex flex-col h-[calc(100vh-220px)] min-h-[420px]">
        <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-[var(--color-linen-dim)]/40">
          {loading ? (
            <p className="text-xs text-[var(--color-muted)] text-center pt-8">در حال بارگذاری...</p>
          ) : messages.length === 0 ? (
            <p className="text-xs text-[var(--color-muted)] text-center pt-8 leading-relaxed">
              سلام! 👋
              <br />
              سوالی درباره‌ی سفارش یا محصولات دارید؟ همین‌جا بنویسید.
            </p>
          ) : (
            messages.map((m) => {
              const isMine = m.sender === "CUSTOMER";
              return (
                <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                      isMine
                        ? "bg-[var(--color-wine)] text-white rounded-br-sm"
                        : "bg-white border cut-line rounded-bl-sm"
                    }`}
                  >
                    <p className="whitespace-pre-line">{m.message}</p>
                    <p className={`text-[10px] mt-1 ${isMine ? "opacity-70" : "text-[var(--color-muted)]"}`}>
                      {new Date(m.createdAt).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          {adminTyping && (
            <p className="text-xs text-[var(--color-muted)] italic">پشتیبانی در حال نوشتن است...</p>
          )}
        </div>

        {error && <p className="text-xs text-red-600 px-4 pt-2">{error}</p>}

        <div className="flex items-center gap-2 p-3 border-t cut-line">
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              sendTyping(e.target.value.trim().length > 0);
            }}
            onBlur={() => sendTyping(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            placeholder="پیام خود را بنویسید..."
            className="flex-1 border cut-line rounded-full px-3 py-2 text-sm bg-white"
          />
          <button
            onClick={handleSend}
            disabled={sending || !text.trim()}
            className="bg-[var(--color-wine)] text-white px-4 py-2 rounded-full text-sm font-bold disabled:opacity-50"
          >
            {sending ? "..." : "ارسال"}
          </button>
        </div>
      </div>
    </div>
  );
}