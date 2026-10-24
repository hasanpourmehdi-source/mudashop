"use client";

import { prepareUpload, appendUpload, discardUploads, discardPrepared } from "@/lib/directUpload";
import { useDiscardUnsubmittedUploads } from "@/hooks/useDiscardUnsubmittedUploads";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  buildRatingBreakdown,
  filterAndSortReviews,
  type ReviewSort,
} from "@/lib/reviewStats";

type Review = {
  id: string;
  rating: number;
  comment: string;
  images: string; // JSON آرایه به صورت string
  verifiedPurchase: boolean;
  variantLabel: string | null;
  isApproved: boolean;
  createdAt: string;
  helpfulCount: number;
  votedByMe: boolean;
  adminReply: string | null;
  repliedAt: string | null;
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

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov"];
function isVideoUrl(url: string): boolean {
  return VIDEO_EXTENSIONS.some((ext) => url.toLowerCase().endsWith(ext));
}

function Stars({ value, onChange, size = "text-lg" }: { value: number; onChange?: (v: number) => void; size?: string }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={`${size} ${n <= value ? "text-[var(--color-ochre)]" : "text-[var(--color-line)]"} ${
            onChange ? "cursor-pointer" : ""
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

const INITIAL_VISIBLE_COUNT = 6;
const COMMENT_CLAMP_LENGTH = 160;

// یک کارتِ نظر -- ستاره + اسم/تاریخ + متن (با «ادامه مطلب» اگر بلند بود) +
// عکس/ویدیو + پاسخ ادمین + دکمه‌ی مفید بود؛ چیدمانِ کارتی (نه ردیفِ تمام‌عرض)
function ReviewCard({ r, onToggleHelpful }: { r: Review; onToggleHelpful: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = r.comment.length > COMMENT_CLAMP_LENGTH;
  const images = parseImages(r.images);

  return (
    <div className="border cut-line rounded-lg p-4 bg-white flex flex-col h-full">
      <div className="flex items-center justify-between mb-1.5">
        <Stars value={r.rating} size="text-sm" />
        <span className="text-[11px] text-[var(--color-muted)]">
          {new Date(r.createdAt).toLocaleDateString("fa-IR")}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <span className="text-xs font-medium">{r.user.name ?? "کاربر مُداشاپ"}</span>
        {r.verifiedPurchase && (
          <span className="text-[10px] font-bold text-green-700 bg-green-100 rounded-full px-2 py-0.5">
            خرید تأییدشده
          </span>
        )}
        {!r.isApproved && (
          <span className="text-[10px] font-bold text-[var(--color-ochre)] bg-[var(--color-linen-dim)] rounded-full px-2 py-0.5">
            در انتظار تایید (فقط برای شما)
          </span>
        )}
      </div>
      {r.variantLabel && (
        <p className="text-[11px] text-[var(--color-muted)] mb-2">خریداری‌شده: {r.variantLabel}</p>
      )}

      <p className={`text-sm text-[var(--color-muted)] flex-1 ${!expanded && isLong ? "line-clamp-4" : ""}`}>
        {r.comment}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-medium text-[var(--color-wine)] mt-1 self-start hover:underline"
        >
          {expanded ? "بستن ‹" : "ادامه مطلب ›"}
        </button>
      )}

      {images.length > 0 && (
        <div className="flex gap-2 mt-2 flex-wrap">
          {images.map((url) =>
            isVideoUrl(url) ? (
              <video key={url} src={url} controls className="w-16 h-16 rounded-lg object-cover border cut-line" />
            ) : (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="w-16 h-16 rounded-lg object-cover border cut-line hover:opacity-90"
                />
              </a>
            )
          )}
        </div>
      )}

      {r.adminReply && (
        <div className="mt-3 border-r-4 border-[var(--color-wine)] bg-[var(--color-linen-dim)] rounded-lg px-3 py-2 text-xs">
          <p className="font-bold mb-0.5">پاسخ مُداشاپ</p>
          <p className="text-[var(--color-muted)]">{r.adminReply}</p>
        </div>
      )}

      <div className="mt-3">
        <button
          onClick={() => onToggleHelpful(r.id)}
          className={`inline-flex items-center gap-1.5 text-xs rounded-full px-3 py-1 border transition-colors ${
            r.votedByMe
              ? "bg-[var(--color-wine)] text-white border-[var(--color-wine)]"
              : "bg-white border cut-line hover:bg-[var(--color-linen-dim)]"
          }`}
        >
          👍 {r.helpfulCount.toLocaleString("fa-IR")}
        </button>
      </div>
    </div>
  );
}

export function ReviewsSection({
  productId,
  externalId,
  externalSiteId,
  productTitle,
  productImage,
}: {
  productId?: string;
  externalId?: string;
  // ترندیول/میلا زیرِ یه source مشترک‌ان -- بدونش externalId ممکنه بینِ دو
  // سایت تصادفاً برخورد کنه
  externalSiteId?: string;
  // برای دیوارِ ویدیوی صفحه‌ی اصلی -- اسنپ‌شاتِ نمایشیِ عنوان/عکس، نه منبعِ واقعی
  productTitle?: string;
  productImage?: string;
}) {
  const { status } = useSession();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [count, setCount] = useState(0);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const pendingUploads = useDiscardUnsubmittedUploads(images, () => setImages([]));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState<ReviewSort>("newest");
  const [showAll, setShowAll] = useState(false);
  const MAX_IMAGES = 4;

  function load() {
    const query = productId ? `productId=${productId}` : `externalId=${externalId}`;
    const siteQuery = externalSiteId ? `&externalSiteId=${externalSiteId}` : "";
    fetch(`/api/reviews?${query}${siteQuery}`)
      .then((res) => res.json())
      .then((data) => {
        setReviews(data.reviews);
        setAvgRating(data.avgRating);
        setCount(data.count);
      });
  }

  useEffect(load, [productId, externalId, externalSiteId]);

  // توزیع امتیاز فقط از نظرات تاییدشده -- نظراتِ در انتظارِ خود کاربر مستثنی‌اند
  const breakdown = useMemo(() => {
    const approved = reviews.filter((r) => r.isApproved);
    return buildRatingBreakdown(approved);
  }, [reviews]);

  const photoReviewCount = useMemo(
    () => reviews.filter((r) => r.isApproved && parseImages(r.images).length > 0).length,
    [reviews]
  );

  const visibleReviews = useMemo(
    () => filterAndSortReviews(reviews, { minRating, sort }),
    [reviews, minRating, sort]
  );

  const shownReviews = showAll ? visibleReviews : visibleReviews.slice(0, INITIAL_VISIBLE_COUNT);

  async function toggleHelpful(reviewId: string) {
    if (status !== "authenticated") {
      setError("برای ثبت «مفید بود» وارد حساب کاربری خود شوید");
      return;
    }
    const res = await fetch(`/api/reviews/${reviewId}/helpful`, { method: "POST" });
    if (!res.ok) return;
    const data = await res.json();
    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId
          ? { ...r, helpfulCount: data.helpfulCount, votedByMe: data.votedByMe }
          : r
      )
    );
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // یکبار انتخاب رو ریست کن تا بشه دوباره همون فایل رو انتخاب کرد
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
      let prepared: Awaited<ReturnType<typeof prepareUpload>>;
      try {
        prepared = await prepareUpload(file, "review");
        appendUpload(formData, prepared);
      } catch (err) {
        setError(err instanceof Error ? err.message : "خطا در آپلود فایل");
        continue;
      }
      const res = await fetch("/api/reviews/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        discardPrepared(prepared);
        setError(data.error ?? "خطا در آپلود فایل");
        continue;
      }
      setImages((prev) => [...prev, data.url]);
    }
    setUploading(false);
  }

  function removeImage(url: string) {
    setImages((prev) => prev.filter((u) => u !== url));
    discardUploads([url]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    pendingUploads.setSubmitting(true);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, externalId, externalSiteId, productTitle, productImage, rating, comment, images }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      pendingUploads.setSubmitting(false);
      setError(data.error ?? "خطا در ثبت نظر");
      return;
    }
    setComment("");
    setRating(5);
    setImages([]);
    pendingUploads.setSubmitting(false);
    setJustSubmitted(true);
    load();
  }

  return (
    <section id="reviews" className="mt-10 pt-8 border-t cut-line">
      <h2 className="font-bold text-lg mb-4">نظرات کاربران</h2>

      {/* نوارِ خلاصه -- عددِ میانگین + ستاره + تعدادِ نظر/عکس، مثل چیدمانِ ترندیول */}
      {count > 0 && (
        <div className="mb-6 border cut-line rounded-lg p-4 bg-white">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <Stars value={Math.round(avgRating)} />
            <span className="text-xl font-extrabold">{avgRating.toFixed(1)}</span>
            <span className="text-sm text-[var(--color-muted)]">{count.toLocaleString("fa-IR")} نظر</span>
            {photoReviewCount > 0 && (
              <span className="text-sm text-[var(--color-muted)] flex items-center gap-1">
                📷 {photoReviewCount.toLocaleString("fa-IR")} نظرِ عکس‌دار
              </span>
            )}
          </div>

          {/* توزیعِ امتیاز -- کلیک روی هر ستاره = فیلتر همان امتیاز */}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {breakdown.map((b) => {
              const active = minRating === b.star;
              return (
                <button
                  key={b.star}
                  onClick={() => setMinRating(active ? 0 : b.star)}
                  className={`flex items-center gap-2 text-sm rounded-full px-2.5 py-1 transition-colors ${
                    active
                      ? "bg-[var(--color-wine)] text-white"
                      : "hover:bg-[var(--color-linen-dim)]"
                  }`}
                >
                  <span className="font-medium">{b.star}★</span>
                  <span className="w-16 h-1.5 rounded-full bg-[var(--color-linen-dim)] overflow-hidden">
                    <span
                      className={`block h-full rounded-full ${active ? "bg-white/80" : "bg-[var(--color-ochre)]"}`}
                      style={{ width: `${b.pct}%` }}
                    />
                  </span>
                  <span className="text-[11px] opacity-80">{b.count.toLocaleString("fa-IR")}</span>
                </button>
              );
            })}
            {minRating > 0 && (
              <button onClick={() => setMinRating(0)} className="text-[11px] text-[var(--color-muted)] underline">
                حذف فیلتر
              </button>
            )}
          </div>
        </div>
      )}

      {status === "authenticated" ? (
        <form onSubmit={handleSubmit} noValidate className="mb-8 border cut-line rounded-lg p-4 bg-white space-y-3">
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
                  {isVideoUrl(url) ? (
                    <video src={url} className="w-full h-full object-cover" muted />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(url)}
                    className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center"
                    aria-label="حذف"
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
                    accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                    multiple
                    onChange={handleImageSelect}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <p className="text-[11px] text-[var(--color-muted)]">
              می‌توانید تا {MAX_IMAGES} عکس یا ویدیوی کوتاه از محصول ضمیمه‌ی نظرتان کنید (اختیاری)
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
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-[var(--color-muted)]">
              {visibleReviews.length.toLocaleString("fa-IR")} نظر
              {minRating > 0 && ` با امتیاز ${minRating}★ به بالا`}
            </p>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as ReviewSort)}
              className="border cut-line rounded-lg px-3 py-1.5 text-xs bg-white"
            >
              <option value="newest">جدیدترین</option>
              <option value="oldest">قدیمی‌ترین</option>
              <option value="highest">بیشترین امتیاز</option>
              <option value="lowest">کمترین امتیاز</option>
            </select>
          </div>

          {/* چیدمانِ کارتی (نه ردیفِ تمام‌عرض) -- مثل کارت‌های نظرِ ترندیول */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {shownReviews.map((r) => (
              <ReviewCard key={r.id} r={r} onToggleHelpful={toggleHelpful} />
            ))}
            {visibleReviews.length === 0 && (
              <p className="text-sm text-[var(--color-muted)]">نظری با این فیلتر پیدا نشد.</p>
            )}
          </div>

          {!showAll && visibleReviews.length > INITIAL_VISIBLE_COUNT && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="w-full mt-4 border cut-line rounded-full py-2.5 text-sm font-medium bg-white hover:bg-[var(--color-linen-dim)] transition-colors"
            >
              نمایش همه‌ی نظرات ({visibleReviews.length.toLocaleString("fa-IR")}) ‹
            </button>
          )}
        </>
      )}
    </section>
  );
}
