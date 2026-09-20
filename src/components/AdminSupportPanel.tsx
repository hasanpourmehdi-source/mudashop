"use client";

import { useEffect, useRef, useState } from "react";

type Conversation = {
  userId: string;
  name: string | null;
  email: string;
  messageCount: number;
  unread: number;
  lastAt: string;
};

type ChatMessage = {
  id: string;
  sender: "CUSTOMER" | "ADMIN";
  message: string;
  createdAt: string;
};

const FA = "۰۱۲۳۴۵۶۷۸۹";
function faNumber(n: number | string): string {
  return String(n).replace(/\d/g, (d) => FA[Number(d)]);
}

// پنل چت پشتیبانی ادمین: لیست گفتگوها در راست، مکالمه در چپ، پاسخ در پایین.
// زنده: پیام مشتری و «در حال نوشتن» او با SSE همان‌لحظه می‌رسد و بجِ لیست
// گفتگوها خودکار آپدیت می‌شود.
export function AdminSupportPanel() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [customerTyping, setCustomerTyping] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const typingSentRef = useRef(false);

  async function loadConversations() {
    const res = await fetch("/api/admin/support/conversations");
    if (res.ok) {
      const data = await res.json();
      setConversations(data.conversations ?? []);
    }
    setLoading(false);
  }

  async function openConversation(userId: string) {
    setActiveUserId(userId);
    setError("");
    const res = await fetch(`/api/admin/support/messages?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) return;
    const data = await res.json();
    setMessages(data.messages ?? []);
    loadConversations();
  }

  useEffect(() => {
    loadConversations();
  }, []);

  // اتصال زنده: پیام مشتری → آپدیت لیست/مکالمه؛ «در حال نوشتن» مشتری
  useEffect(() => {
    const es = new EventSource("/api/admin/support/stream");
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as
          | { type: "message"; userId: string; message: ChatMessage }
          | { type: "typing"; userId: string; sender: "CUSTOMER" | "ADMIN"; typing: boolean };
        if (event.type === "message") {
          if (activeUserId === event.userId) {
            setMessages((prev) =>
              prev.some((m) => m.id === event.message.id) ? prev : [...prev, event.message]
            );
          }
          loadConversations();
        } else if (event.type === "typing" && event.sender === "CUSTOMER" && activeUserId === event.userId) {
          setCustomerTyping(event.typing);
        }
      } catch {
        // داده‌ی خراب -- نادیده بگیر
      }
    };
    return () => es.close();
  }, [activeUserId]);

  useEffect(() => {
    if (!customerTyping) return;
    const t = setTimeout(() => setCustomerTyping(false), 2500);
    return () => clearTimeout(t);
  }, [customerTyping]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, customerTyping, activeUserId]);

  function sendTyping(typing: boolean) {
    if (!activeUserId || typing === typingSentRef.current) return;
    typingSentRef.current = typing;
    fetch("/api/admin/support/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: activeUserId, typing }),
    }).catch(() => {});
  }

  async function handleSend() {
    const body = text.trim();
    if (!body || !activeUserId) return;
    setSending(true);
    const res = await fetch("/api/admin/support/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: activeUserId, message: body }),
    });
    setSending(false);
    sendTyping(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "خطا در ارسال پیام");
      return;
    }
    setText("");
    const created = await res.json();
    setMessages((prev) => (prev.some((m) => m.id === created.id) ? prev : [...prev, created]));
    loadConversations();
  }

  if (loading) return <p className="text-sm text-[var(--color-muted)]">در حال بارگذاری...</p>;

  return (
    <div className="grid md:grid-cols-[260px_1fr] gap-4 items-start">
      {/* min-w-0 پیشگیرانه روی هردو فرزند -- پایینِ md که این گرید تک‌ستونیِ
          ضمنی می‌شه، بدونش محتوای غیرِ-جمع‌شونده (مثلاً پیام‌های بلندِ چت)
          می‌تونست عرضِ صفحه رو بترکونه */}
      <aside className="border cut-line rounded-xl bg-white overflow-hidden min-w-0">
        <h2 className="px-3 py-2.5 text-xs font-bold text-[var(--color-muted)] border-b cut-line">
          گفتگوها
        </h2>
        {conversations.length === 0 ? (
          <p className="p-3 text-xs text-[var(--color-muted)]">هنوز گفتگویی ثبت نشده.</p>
        ) : (
          <ul className="divide-y cut-line max-h-[70vh] overflow-y-auto">
            {conversations.map((c) => (
              <li key={c.userId}>
                <button
                  type="button"
                  onClick={() => openConversation(c.userId)}
                  className={`w-full text-right px-3 py-2.5 text-xs hover:bg-[var(--color-linen-dim)] transition-colors ${
                    activeUserId === c.userId ? "bg-[var(--color-linen-dim)]" : ""
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-bold truncate">{c.name ?? c.email}</span>
                    {c.unread > 0 && activeUserId !== c.userId && (
                      <span className="shrink-0 min-w-5 h-5 px-1 rounded-full bg-[var(--color-wine)] text-white text-[10px] font-bold flex items-center justify-center">
                        {faNumber(c.unread)}
                      </span>
                    )}
                  </span>
                  <span className="block text-[10px] text-[var(--color-muted)] mt-0.5" dir="ltr">
                    {new Date(c.lastAt).toLocaleString("fa-IR")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="border cut-line rounded-xl bg-white overflow-hidden flex flex-col min-h-[420px] min-w-0">
        {!activeUserId ? (
          <p className="m-auto text-xs text-[var(--color-muted)] p-6 text-center">
            یک گفتگو را از راست انتخاب کنید تا پیام‌ها و پاسخ نمایش داده شود.
          </p>
        ) : (
          <>
            <div ref={listRef} className="flex-1 max-h-[55vh] overflow-y-auto p-4 space-y-2 bg-[var(--color-linen-dim)]/40">
              {messages.length === 0 ? (
                <p className="text-xs text-[var(--color-muted)] text-center">
                  هنوز پیامی در این گفتگو نیست. اولین پیام را بفرستید.
                </p>
              ) : (
                messages.map((m) => {
                  const isMine = m.sender === "ADMIN";
                  return (
                    <div key={m.id} className={`flex ${isMine ? "justify-start" : "justify-end"}`}>
                      <div
                        className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${
                          isMine
                            ? "bg-[var(--color-wine)] text-white rounded-br-sm"
                            : "bg-white border cut-line rounded-bl-sm"
                        }`}
                      >
                        <p className="whitespace-pre-line">{m.message}</p>
                        <p className={`text-[10px] mt-1 ${isMine ? "opacity-70" : "text-[var(--color-muted)]"}`}>
                          {new Date(m.createdAt).toLocaleString("fa-IR")}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              {customerTyping && (
                <p className="text-xs text-[var(--color-muted)] italic">
                  {conversations.find((c) => c.userId === activeUserId)?.name ?? "مشتری"} در حال نوشتن است...
                </p>
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
                placeholder="پاسخ خود را بنویسید..."
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
          </>
        )}
      </section>
    </div>
  );
}