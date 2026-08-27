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
// خودش سمت راست باشن یا چپ. با دادنِ itemId، به‌جای گفت‌وگوی کلیِ سفارش، به
// رشته‌ی توضیحاتِ مخصوصِ همون قلم محدود می‌شه (compact=true یعنی جمع‌شده شروع
// بشه، فقط با کلیک باز بشه -- برای این‌که لیستِ اقلام شلوغ نشه)
export function OrderMessageThread({
  orderId,
  viewerRole,
  itemId,
  title,
  compact,
}: {
  orderId: string;
  viewerRole: "CUSTOMER" | "ADMIN";
  itemId?: string;
  title?: string;
  compact?: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(!compact);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function load() {
    const qs = itemId ? `?itemId=${itemId}` : "";
    fetch(`/api/orders/${orderId}/messages${qs}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Message[]) => setMessages(data))
      .finally(() => {
        setLoading(false);
        setLoaded(true);
      });
  }

  useEffect(() => {
    if (compact && !open) return;
    load();
    pollRef.current = setInterval(load, 15000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, itemId, open]);

  async function handleSend() {
    if (!text.trim()) return;
    setSending(true);
    setError("");
    const res = await fetch(`/api/orders/${orderId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text.trim(), itemId }),
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

  if (compact && !open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[11px] text-[var(--color-wine)] hover:underline"
      >
        {title ?? "توضیحات"} {loaded && messages.length > 0 ? `(${messages.length.toLocaleString("fa-IR")})` : ""}
      </button>
    );
  }

  const Wrapper = compact ? "div" : "section";

  return (
    <Wrapper
      id={itemId ? `item-note-${itemId}` : undefined}
      className={compact ? "border cut-line rounded-lg p-3 bg-[var(--color-linen-dim)]" : "mb-8 border cut-line rounded-lg p-4 bg-white"}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className={compact ? "font-bold text-xs" : "font-bold text-sm"}>{title ?? "گفت‌وگو درباره‌ی این سفارش"}</h2>
        {compact && (
          <button onClick={() => setOpen(false)} className="text-[11px] text-[var(--color-muted)] hover:underline">
            بستن
          </button>
        )}
      </div>

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
    </Wrapper>
  );
}
