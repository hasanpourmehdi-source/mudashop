"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Review = {
  id: string;
  rating: number;
  comment: string;
  images: string; // JSON array به صورت string
  verifiedPurchase: boolean;
  isApproved: boolean;
  createdAt: string;
  user: { name: string | null };
};

function parseImages(images: string): string[] {
  try {
    const parsed = JSON.parse(images);
    return Array.isArray(parsed) ? parsed.filter((u) => typeof u === "string") : [];
  } catch {
    return [];
  }
}

function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={`text-lg ${n <= value ? "text-[var(--color-ochre)]" : "text-[var(--color-line)]"} ${
            onChange ? "cursor-pointer" : ""
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function ReviewsSection({
  productId,
  externalId,
}: {
  productId?: string;
  externalId?: string;
}) {
  const { status } = useSession();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [count, setCount] = useState(0);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const MAX_IMAGES = 4;

  function load() {
    const query = productId ? `productId=${productId}` : `externalId=${externalId}`;
    fetch(`/api/reviews?${query}`)
      .then((res) => res.json())
      .then((data) => {
        setReviews(data.reviews);
        setAvgRating(data.avgRating);
        setCount(data.count);
      });
  }

  useEffect(load, [productId, externalId]);

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // یکبار انتخاب رو ریست کن تا بشه دوباره همون فایل رو انتخاب کرد
    if (files.length === 0) return;

    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      setError(`حداکثر ${MAX_IMAGES} عکس می‌توانید ضمیمه کنید`);
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
        setError(data.error ?? "خطا در آپلود عکس");
        continue;
      }
      setImages((prev) => [...prev, data.url]);
    }
    setUploading(false);
  }

  function removeImage(url: string) {
    setImages((prev) => prev.filter((u) => u !== url));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, externalId, rating, comment, images }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "خطا در ثبت نظر");
      return;
    }
    setComment("");
    setRating(5);
    setImages([]);
    setJustSubmitted(true);
    load();
  }

  return (
    <section id="reviews" className="mt-10 pt-8 border-t cut-line">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="font-bold text-lg">نظرات کاربران</h2>
        {count > 0 && (
          <span className="flex items-center gap-1 text-sm text-[var(--color-muted)]">
            <Stars value={Math.round(avgRating)} />
            {avgRating.toFixed(1)} ({count} نظر)
          </span>
        )}
      </div>

      {status === "authenticated" ? (
        <form onSubmit={handleSubmit} className="mb-8 border cut-line rounded-lg p-4 bg-white space-y-3">
          {justSubmitted && (
            <p className="text-xs text-[var(--color-ochre)] bg-[var(--color-linen-dim)] rounded-lg px-3 py-2">
              نظر شما ثبت شد و بعد از تایید توسط تیم مُداشاپ، زیر محصول نمایش داده می‌شه.
            </p>
          )}
          <div>
            <p className="text-sm font-medium mb-1">امتیاز شما</p>
            <Stars value={rating} onChange={setRating} />
          </div>
          <textarea
            placeholder="نظر خود را بنویسید..."
            required
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full border cut-line rounded-lg px-3 py-2 text-sm min-h-20"
          />
          <div>
            <div className="flex flex-wrap gap-2 mb-2">
              {images.map((url) => (
                <div key={url} className="relative w-16 h-16 rounded-lg overflow-hidden border cut-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(url)}
                    className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center"
                    aria-label="حذف عکس"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <label className="w-16 h-16 rounded-lg border cut-line border-dashed flex items-center justify-center text-xs text-[var(--color-muted)] cursor-pointer hover:border-[var(--color-wine)]">
                  {uploading ? "..." : "📷 افزودن"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    onChange={handleImageSelect}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <p className="text-[11px] text-[var(--color-muted)]">
              می‌توانید تا {MAX_IMAGES} عکس از محصول ضمیمه‌ی نظرتان کنید (اختیاری)
            </p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50"
          >
            {submitting ? "در حال ثبت..." : "ثبت نظر"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-[var(--color-muted)] mb-8">
          برای ثبت نظر ابتدا وارد حساب کاربری خود شوید.
        </p>
      )}

      {reviews.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">هنوز نظری ثبت نشده. اولین نفر باشید!</p>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={r.id} className="border cut-line rounded-lg p-4 bg-white">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{r.user.name ?? "کاربر مُداشاپ"}</span>
                <Stars value={r.rating} />
              </div>
              {r.verifiedPurchase && (
                <span className="text-[10px] font-bold text-green-700 bg-green-100 rounded-full px-2 py-0.5">
                  خرید تأییدشده
                </span>
              )}
              {!r.isApproved && (
                <span className="text-[10px] font-bold text-[var(--color-ochre)] bg-[var(--color-linen-dim)] rounded-full px-2 py-0.5 mr-1.5">
                  در انتظار تایید (فقط برای شما نمایش داده می‌شه)
                </span>
              )}
              <p className="text-sm text-[var(--color-muted)] mt-2">{r.comment}</p>
              {parseImages(r.images).length > 0 && (
                <div className="flex gap-2 mt-2">
                  {parseImages(r.images).map((url) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt=""
                        className="w-16 h-16 rounded-lg object-cover border cut-line hover:opacity-90"
                      />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
