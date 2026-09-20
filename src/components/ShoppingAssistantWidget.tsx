"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type ChatEntry =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; products: AssistantProduct[]; orders: AssistantOrderLink[] };

type AssistantProduct = { slug: string; title: string; basePrice: number; discount: number; image: string };
type AssistantOrderLink = { id: string; label: string; href: string };

// دستیارِ خریدِ هوش‌مصنوعی -- دکمه‌ی شناور پایین-راست (چت پشتیبانی پایین-چپه).
// بدون نیاز به لاگین. کاتالوگِ مزون رو بر اساسِ پیامِ مشتری جست‌وجو می‌کند.
export function ShoppingAssistantWidget() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  async function send() {
    const message = text.trim();
    if (!message || sending) return;
    setText("");
    setEntries((prev) => [...prev, { role: "user", text: message }]);
    setSending(true);
    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (res.ok) {
        setEntries((prev) => [
          ...prev,
          { role: "assistant", text: data.reply, products: data.products ?? [], orders: data.orders ?? [] },
        ]);
      } else {
        setEntries((prev) => [
          ...prev,
          { role: "assistant", text: "مشکلی پیش آمد، دوباره تلاش کن.", products: [], orders: [] },
        ]);
      }
    } catch {
      setEntries((prev) => [
        ...prev,
        { role: "assistant", text: "مشکلی پیش آمد، دوباره تلاش کن.", products: [], orders: [] },
      ]);
    }
    setSending(false);
    setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 50);
  }

  return (
    <div className="fixed bottom-20 md:bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-80 max-w-[90vw] h-96 bg-white rounded-2xl border cut-line shadow-xl flex flex-col overflow-hidden">
          <div className="bg-[var(--color-wine)] text-white px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-bold">🛍️ دستیار خرید</span>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white">
              ✕
            </button>
          </div>
          <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {entries.length === 0 && (
              <p className="text-xs text-[var(--color-muted)]">
                سلام! بگو دنبال چه چیزی هستی (مثلاً «یه بلوز مشکی زیر ۵۰۰ تومان») تا برات از بین محصولات بگردم.
              </p>
            )}
            {entries.map((e, idx) => (
              <div key={idx} className={e.role === "user" ? "text-left" : ""}>
                <p
                  className={`text-sm inline-block rounded-lg px-3 py-2 max-w-[85%] whitespace-pre-line ${
                    e.role === "user" ? "bg-[var(--color-wine)] text-white" : "bg-[var(--color-linen-dim)]"
                  }`}
                >
                  {e.text}
                </p>
                {e.role === "assistant" && e.orders.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {e.orders.map((o) => (
                      <Link
                        key={o.id}
                        href={o.href}
                        className="text-xs border cut-line rounded-full px-3 py-1.5 bg-white hover:border-[var(--color-wine)]"
                      >
                        مشاهده‌ی سفارش {o.label}
                      </Link>
                    ))}
                  </div>
                )}
                {e.role === "assistant" && e.products.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {e.products.map((p) => (
                      <Link
                        key={p.slug}
                        href={`/products/mazon/${p.slug}`}
                        className="w-24 border cut-line rounded-lg overflow-hidden bg-white hover:border-[var(--color-wine)]"
                      >
                        <div className="relative w-full h-16 bg-[var(--color-linen-dim)]">
                          {p.image && <Image src={p.image} alt={p.title} fill className="object-cover" unoptimized />}
                        </div>
                        <p className="text-[10px] px-1 py-1 truncate">{p.title}</p>
                        <p className="text-[10px] px-1 pb-1 font-bold text-[var(--color-wine)]">
                          {p.basePrice.toLocaleString("fa-IR")} ت
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {sending && <p className="text-xs text-[var(--color-muted)]">در حال جست‌وجو...</p>}
          </div>
          <div className="border-t cut-line p-2 flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="مثلاً یه شومیز سفید..."
              className="flex-1 border cut-line rounded-full px-3 py-1.5 text-sm min-w-0"
            />
            <button
              onClick={send}
              disabled={sending || !text.trim()}
              className="bg-[var(--color-wine)] text-white rounded-full px-4 py-1.5 text-sm disabled:opacity-50"
            >
              ارسال
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="w-14 h-14 rounded-full bg-gradient-to-tr from-[var(--color-wine)] to-[var(--color-ochre)] text-white shadow-lg flex items-center justify-center text-xl"
        aria-label="دستیار خرید"
      >
        🛍️
      </button>
    </div>
  );
}
