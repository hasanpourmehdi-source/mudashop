// ================= امکانات نقد: آمار و فیلتر نظرات =================
// توزیع امتیاز (هیستوگرام مثل آمازون) + فیلتر حداقل امتیاز + مرتب‌سازی.
// خالص و بدون DB -- برای تست.

export type RatingBreakdownItem = { star: number; count: number; pct: number };

// توزیع امتیاز از ۵ به ۱، با درصد از کل نظراتِ تاییدشده. نظراتِ تاییدنشده
// (فقط برای خود کاربر دیده می‌شوند) در آمار عمومی شرکت نمی‌کنند.
export function buildRatingBreakdown(reviews: { rating: number; isApproved?: boolean }[]): RatingBreakdownItem[] {
  const approved = reviews.filter((r) => r.isApproved !== false);
  const total = approved.length;
  const counts = new Map<number, number>();
  for (const r of approved) counts.set(r.rating, (counts.get(r.rating) ?? 0) + 1);

  const out: RatingBreakdownItem[] = [];
  for (let star = 5; star >= 1; star--) {
    const count = counts.get(star) ?? 0;
    out.push({ star, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 });
  }
  return out;
}

export type ReviewSort = "newest" | "oldest" | "highest" | "lowest";

// فیلتر حداقل امتیاز (minRating=0 یعنی همه) + مرتب‌سازی. بدون تغییر آرایه‌ی
// ورودی (غیردستوری).
export function filterAndSortReviews<T extends { rating: number; createdAt: string; helpfulCount?: number }>(
  reviews: T[],
  opts: { minRating: number; sort: ReviewSort }
): T[] {
  const filtered = reviews.filter((r) => r.rating >= opts.minRating);
  const sorted = [...filtered];
  switch (opts.sort) {
    case "newest":
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    case "oldest":
      sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      break;
    case "highest":
      sorted.sort((a, b) => b.rating - a.rating);
      break;
    case "lowest":
      sorted.sort((a, b) => a.rating - b.rating);
      break;
  }
  return sorted;
}

// محاسبه‌ی «مفید بود» -- تعداد رأی‌ها + اینکه کاربر فعلی رأی داده یا نه. خالص.
export function computeHelpfulStats(votes: { userId: string }[], currentUserId: string | null | undefined): {
  helpfulCount: number;
  votedByMe: boolean;
} {
  return {
    helpfulCount: votes.length,
    votedByMe: currentUserId ? votes.some((v) => v.userId === currentUserId) : false,
  };
}