"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ChatMessage = {
  id: string;
  sender: "CUSTOMER" | "ADMIN";
  message: string;
  createdAt: string;
};

// چت زنده‌ی پشتیبانی -- دکمه‌ی شناور پایین‌چپ که پنل گفتگو را باز می‌کند.
// پیام‌های جدید با SSE همان‌لحظه می‌رسند (بدون پولینگ) + ایندیکاتور «در حال
// نوشتن» ادمین. ادمین‌ها از پنل ادمین پاسخ می‌دهند.
export function SupportChatWidget() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [adminTyping, setAdminTyping] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const typingSentRef = useRef(false);

  const isLoggedIn = status === "authenticated" && session?.user?.role !== "ADMIN";

  function loadMessages(markRead: boolean) {
    setLoading(true);
    fetch(`/api/support/messages${markRead ? "?read=1" : ""}`)
      .then((res) => (res.ok ? res.json() : { messages: [] }))
      .then((data) => {
        setMessages(data.messages ?? []);
        if (markRead) setUnread(0);
      })
      .finally(() => setLoading(false));
  }

  function loadUnread() {
    fetch("/api/support/unread")
      .then((res) => (res.ok ? res.json() : { unread: 0 }))
      .then((data) => setUnread(data.unread ?? 0))
      .catch(() => {});
  }

  // اتصال زنده -- پیام ادمین و «در حال نوشتن» بدون پولینگ می‌رسد
  useEffect(() => {
    if (!isLoggedIn) return;
    const es = new EventSource("/api/support/stream");
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as
          | { type: "message"; userId: string; message: ChatMessage }
          | { type: "typing"; userId: string; sender: "CUSTOMER" | "ADMIN"; typing: boolean };
        if (event.type === "message") {
          setMessages((prev) => {
            if (prev.some((m) => m.id === event.message.id)) return prev;
            const next = [...prev, event.message];
            if (open) setUnread(0);
            return next;
          });
        } else if (event.type === "typing" && event.sender === "ADMIN") {
          setAdminTyping(event.typing);
        }
      } catch {
        // داده‌ی خراب -- نادیده بگیر
      }
    };
    return () => es.close();
  }, [isLoggedIn, open]);

  // در حالت بسته، بجِ نخوانده را با پولینگ سبک به‌روز نگه دار
  useEffect(() => {
    if (!isLoggedIn || open) return;
    const t = setInterval(loadUnread, 15000);
    return () => clearInterval(t);
  }, [open, isLoggedIn]);

  // تایپینگ ادمین بعد از ۲.۵ ثانیه بی‌حرکتی خاموش می‌شود
  useEffect(() => {
    if (!adminTyping) return;
    const t = setTimeout(() => setAdminTyping(false), 2500);
    return () => clearTimeout(t);
  }, [adminTyping]);

  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, adminTyping, open]);

  if (status === "loading") return null;
  if (!isLoggedIn) return null;

  function sendTyping(typing: boolean) {
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
    <div className="fixed bottom-4 left-4 z-50 flex flex-col items-start gap-3">
      {open && (
        <div className="w-[320px] max-w-[calc(100vw-2rem)] border cut-line rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col">
          <div className="bg-[var(--color-wine)] text-white px-4 py-3 flex items-center justify-between">
            <p className="font-bold text-sm">پشتیبانی مُداشاپ</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="بستن چت"
              className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-sm hover:bg-white/30 transition-colors"
            >
              ✕
            </button>
          </div>

          <div ref={listRef} className="h-72 overflow-y-auto p-3 space-y-2 bg-[var(--color-linen-dim)]/40">
            {loading && messages.length === 0 ? (
              <p className="text-xs text-[var(--color-muted)] text-center">در حال بارگذاری...</p>
            ) : messages.length === 0 ? (
              <p className="text-xs text-[var(--color-muted)] text-center leading-relaxed">
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
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                        isMine
                          ? "bg-[var(--color-wine)] text-white rounded-br-sm"
                          : "bg-white border cut-line rounded-bl-sm"
                      }`}
                    >
                      <p className="whitespace-pre-line">{m.message}</p>
                      <p className={`text-[10px] mt-1 ${isMine ? "opacity-70" : "text-[var(--color-muted)]"}`}>
                        {new Date(m.createdAt).toLocaleTimeString("fa-IR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
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

          <Link
            href="/messages"
            className="block text-center text-[11px] text-[var(--color-muted)] pb-2 hover:text-[var(--color-wine)]"
          >
            صفحه‌ی کامل پیام‌ها ←
          </Link>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setOpen((o) => {
            const next = !o;
            if (next) loadMessages(true);
            else loadUnread();
            return next;
          });
        }}
        aria-label="پشتیبانی"
        className="relative w-14 h-14 rounded-full bg-[var(--color-wine)] text-white shadow-lg hover:scale-105 transition-transform flex items-center justify-center text-2xl"
      >
        {open ? "✕" : "💬"}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "۹+" : unread.toLocaleString("fa-IR")}
          </span>
        )}
      </button>
    </div>
  );
}