"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Review = {
  id: string;
  source: "MAZON" | "TRENDYOL";
  externalId: string | null;
  rating: number;
  comment: string;
  images: string;
  verifiedPurchase: boolean;
  isApproved: boolean;
  createdAt: string;
  adminReply: string | null;
  repliedAt: string | null;
  user: { name: string | null; email: string };
  product: { title: string; slug: string } | null;
};

function ProductLink({ review }: { review: Review }) {
  if (review.source === "MAZON" && review.product) {
    return (
      <Link href={`/products/mazon/${review.product.slug}`} className="text-xs text-[var(--color-wine)]" target="_blank">
        {review.product.title}
      </Link>
    );
  }
  return (
    <span className="text-xs text-[var(--color-muted)]">
      محصول ترندیول (شناسه: {review.externalId})
    </span>
  );
}

function parseImages(images: string): string[] {
  try {
    const parsed = JSON.parse(images);
    return Array.isArray(parsed) ? parsed.filter((u) => typeof u === "string") : [];
  } catch {
    return [];
  }
}

function Stars({ value }: { value: number }) {
  return (
    <span className="text-[var(--color-ochre)] text-sm">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n}>{n <= value ? "★" : "☆"}</span>
      ))}
    </span>
  );
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [replyOpen, setReplyOpen] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/reviews")
      .then((res) => (res.ok ? res.json() : []))
      .then(setReviews)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleApprove(id: string) {
    setError("");
    setBusyId(id);
    const res = await fetch(`/api/admin/reviews/${id}`, { method: "PATCH" });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? `خطا در تایید (کد ${res.status})`);
      return;
    }
    load();
  }

  async function handleReject(id: string) {
    if (!confirm("این نظر برای همیشه حذف بشه؟")) return;
    setError("");
    setBusyId(id);
    const res = await fetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? `خطا در حذف (کد ${res.status})`);
      return;
    }
    load();
  }

  async function handleReply(id: string) {
    setError("");
    setBusyId(id);
    const res = await fetch(`/api/admin/reviews/${id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply: replyDraft[id] ?? "" }),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? `خطا در ثبت پاسخ (کد ${res.status})`);
      return;
    }
    setReplyOpen(null);
    setReplyDraft((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
    load();
  }

  if (loading) return <p className="text-sm text-[var(--color-muted)]">در حال بارگذاری...</p>;

  const pending = reviews.filter((r) => !r.isApproved);
  const approved = reviews.filter((r) => r.isApproved);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-bold mb-6">در انتظار تایید ({pending.length})</h1>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>
        )}
        {pending.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">نظر جدیدی در انتظار تایید نیست.</p>
        ) : (
          <div className="space-y-3">
            {pending.map((r) => (
              <div key={r.id} className="border-2 cut-line rounded-lg p-4 bg-white text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{r.user.name ?? r.user.email}</span>
                  <Stars value={r.rating} />
                </div>
                <ProductLink review={r} />
                {r.verifiedPurchase && (
                  <span className="text-[10px] font-bold text-green-700 bg-green-100 rounded-full px-2 py-0.5 mr-2">
                    خرید تأییدشده
                  </span>
                )}
                <p className="text-[var(--color-muted)] mt-2">{r.comment}</p>
                {parseImages(r.images).length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {parseImages(r.images).map((url) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="w-14 h-14 rounded-lg object-cover border cut-line" />
                      </a>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleApprove(r.id)}
                    disabled={busyId === r.id}
                    className="bg-[var(--color-wine)] text-white px-3 py-1.5 rounded-full text-xs font-medium disabled:opacity-50"
                  >
                    تایید و نمایش
                  </button>
                  <button
                    onClick={() => handleReject(r.id)}
                    disabled={busyId === r.id}
                    className="text-red-600 px-3 py-1.5 rounded-full text-xs font-medium border cut-line disabled:opacity-50"
                  >
                    رد و حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-bold mb-4">نظرات تاییدشده ({approved.length})</h2>
        {approved.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">هنوز نظر تاییدشده‌ای نیست.</p>
        ) : (
          <div className="space-y-2">
            {approved.map((r) => (
              <div key={r.id} className="border cut-line rounded-lg p-3 bg-white text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{r.user.name ?? r.user.email}</span>
                  <Stars value={r.rating} />
                </div>
                <ProductLink review={r} />
                <p className="text-[var(--color-muted)] mt-1">{r.comment}</p>
                {parseImages(r.images).length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {parseImages(r.images).map((url) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="w-14 h-14 rounded-lg object-cover border cut-line" />
                      </a>
                    ))}
                  </div>
                )}
                {r.adminReply && (
                  <div className="mt-2 bg-[var(--color-linen-dim)] rounded-lg px-3 py-2 text-xs">
                    <p className="font-bold mb-0.5">پاسخ مُداشاپ {r.repliedAt ? `(${new Date(r.repliedAt).toLocaleDateString("fa-IR")})` : ""}</p>
                    <p className="text-[var(--color-muted)]">{r.adminReply}</p>
                  </div>
                )}
                {replyOpen === r.id ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={replyDraft[r.id] ?? ""}
                      onChange={(e) => setReplyDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                      placeholder="پاسخ تیم مُداشاپ به این نظر..."
                      className="w-full border cut-line rounded-lg px-3 py-2 text-xs min-h-16"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReply(r.id)}
                        disabled={busyId === r.id}
                        className="bg-[var(--color-wine)] text-white px-3 py-1.5 rounded-full text-xs font-medium disabled:opacity-50"
                      >
                        {busyId === r.id ? "..." : "ثبت پاسخ"}
                      </button>
                      <button
                        onClick={() => setReplyOpen(null)}
                        disabled={busyId === r.id}
                        className="text-xs text-[var(--color-muted)] px-2 disabled:opacity-50"
                      >
                        انصراف
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3 mt-2">
                    <button
                      onClick={() => setReplyOpen(r.id)}
                      disabled={busyId === r.id}
                      className="text-xs text-[var(--color-wine)] hover:underline disabled:opacity-50"
                    >
                      {r.adminReply ? "ویرایش پاسخ" : "پاسخ به نظر"}
                    </button>
                    <button
                      onClick={() => handleReject(r.id)}
                      disabled={busyId === r.id}
                      className="text-red-600 text-xs hover:underline disabled:opacity-50"
                    >
                      حذف
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
