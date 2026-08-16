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
                <button
                  onClick={() => handleReject(r.id)}
                  disabled={busyId === r.id}
                  className="text-red-600 text-xs mt-2 hover:underline disabled:opacity-50"
                >
                  حذف
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
