"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  sender: "CUSTOMER" | "ADMIN";
  message: string;
  createdAt: string;
};

// گفت‌وگوی مستقیم درباره‌ی سفارش -- همون کامپوننت هم توی صفحه‌ی سفارش مشتری
// هم توی صفحه‌ی سفارش ادمین استفاده می‌شه؛ فقط viewerRole تعیین می‌کنه پیام‌های
// خودش سمت راست باشن یا چپ
export function OrderMessageThread({ orderId, viewerRole }: { orderId: string; viewerRole: "CUSTOMER" | "ADMIN" }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function load() {
    fetch(`/api/orders/${orderId}/messages`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Message[]) => setMessages(data))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 15000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function handleSend() {
    if (!text.trim()) return;
    setSending(true);
    setError("");
    const res = await fetch(`/api/orders/${orderId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text.trim() }),
    });
    setSending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "خطا در ارسال پیام");
      return;
    }
    setText("");
    load();
  }

  return (
    <section className="mb-8 border cut-line rounded-lg p-4 bg-white">
      <h2 className="font-bold text-sm mb-3">گفت‌وگو درباره‌ی این سفارش</h2>

      {loading ? (
        <p className="text-xs text-[var(--color-muted)]">در حال بارگذاری...</p>
      ) : messages.length === 0 ? (
        <p className="text-xs text-[var(--color-muted)] mb-3">
          هنوز پیامی ثبت نشده. اگه سوالی داری یا نیاز به تغییری (مثلاً سایز) هست، همین‌جا بنویس.
        </p>
      ) : (
        <div className="space-y-2 mb-3 max-h-80 overflow-y-auto">
          {messages.map((m) => {
            const isMine = m.sender === viewerRole;
            return (
              <div key={m.id} className={`flex ${isMine ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${
                    isMine ? "bg-[var(--color-wine)] text-white" : "bg-[var(--color-linen-dim)]"
                  }`}
                >
                  <p className="font-bold mb-0.5 opacity-80">{m.sender === "ADMIN" ? "پشتیبانی" : "مشتری"}</p>
                  <p className="whitespace-pre-line">{m.message}</p>
                  <p className="text-[10px] opacity-70 mt-1">{new Date(m.createdAt).toLocaleString("fa-IR")}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      <div className="flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          placeholder="پیام خود را بنویسید..."
          className="flex-1 border cut-line rounded-lg px-3 py-2 text-sm bg-white"
        />
        <button
          onClick={handleSend}
          disabled={sending || !text.trim()}
          className="bg-[var(--color-wine)] text-white px-4 py-2 rounded-full text-sm font-medium disabled:opacity-50"
        >
          {sending ? "..." : "ارسال"}
        </button>
      </div>
    </section>
  );
}
