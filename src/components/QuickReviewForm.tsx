"use client";

import { useState } from "react";

const MAX_IMAGES = 4;

// فرمِ فشرده‌ی ثبتِ نظر -- برخلافِ فرمِ اصلیِ توی ReviewsSection (که روی صفحه‌ی
// خودِ محصوله و productId/externalId رو از URL می‌گیره)، این یکی از یه زمینه‌ی
// دیگه (دکمه‌ی «نظر بده» کنار هر قلمِ سفارش، یا پاپ‌آپِ یادآوری) صدا زده می‌شه؛
// چون از همون‌جا می‌دونیم دقیقاً کدوم قلمِ سفارش (با کدوم سایز/رنگ) مقصوده، نیازی
// به حدسِ سمتِ سرور نیست -- productId/externalId مستقیم پاس داده می‌شه
export function QuickReviewForm({
  productId,
  externalId,
  orderItemId,
  title,
  variantLabel,
  image,
  onSubmitted,
  onCancel,
}: {
  productId?: string;
  externalId?: string;
  orderItemId?: string;
  title: string;
  variantLabel?: string | null;
  image?: string | null;
  onSubmitted: () => void;
  onCancel?: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      setError(`حداکثر ${MAX_IMAGES} عکس/ویدیو می‌توانید ضمیمه کنید`);
      return;
    }
    setError("");
    setUploading(true);
    for (const file of files.slice(0, remaining)) {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/reviews/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "خطا در آپلود فایل");
        continue;
      }
      setImages((prev) => [...prev, data.url]);
    }
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        externalId,
        orderItemId,
        productTitle: title,
        productImage: image ?? undefined,
        rating,
        comment,
        images,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "خطا در ثبت نظر");
      return;
    }
    onSubmitted();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="border cut-line rounded-lg p-3 bg-white space-y-2.5">
      <div className="flex items-center gap-2">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={title} className="w-10 h-10 rounded-lg object-cover border cut-line shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{title}</p>
          {variantLabel && <p className="text-[11px] text-[var(--color-muted)]">{variantLabel}</p>}
        </div>
      </div>

      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            className={`text-xl ${n <= rating ? "text-[var(--color-ochre)]" : "text-[var(--color-line)]"}`}
          >
            ★
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="نظرت درباره‌ی این کالا چیه؟"
        rows={3}
        className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
        required
        minLength={3}
      />

      <div className="flex items-center gap-2 flex-wrap">
        {images.map((url) => (
          <div key={url} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="w-12 h-12 rounded-lg object-cover border cut-line" />
            <button
              type="button"
              onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
              className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        ))}
        {images.length < MAX_IMAGES && (
          <label className="text-xs border cut-line rounded-lg px-2 py-1.5 cursor-pointer hover:border-[var(--color-wine)]">
            {uploading ? "در حال آپلود..." : "📷 افزودن عکس"}
            <input type="file" accept="image/*,video/mp4,video/webm,video/quicktime" multiple hidden onChange={handleImageSelect} disabled={uploading} />
          </label>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || uploading}
          className="text-xs bg-[var(--color-wine)] text-white px-4 py-1.5 rounded-full font-medium disabled:opacity-50"
        >
          {submitting ? "در حال ثبت..." : "ثبت نظر"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-xs text-[var(--color-muted)]">
            انصراف
          </button>
        )}
      </div>
    </form>
  );
}
