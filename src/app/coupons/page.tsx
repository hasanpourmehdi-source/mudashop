import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { fetchAvailableCouponsForUser, type AvailableCoupon } from "@/lib/coupons";
import { CopyCouponCodeButton } from "@/components/CopyCouponCodeButton";

// توضیحِ فارسیِ خودِ تخفیف، مستقل از مبلغ/حداقل سفارش (که جدا زیرش نشون داده می‌شه)
function describeCoupon(c: AvailableCoupon): string {
  switch (c.type) {
    case "PERCENT":
      return `٪${c.value.toLocaleString("fa-IR")} تخفیف`;
    case "FIXED":
      return `${c.value.toLocaleString("fa-IR")} تومان تخفیف`;
    case "FREE_SHIP":
      return "ارسال رایگان";
    case "FIRST_BUY":
      return `٪${c.value.toLocaleString("fa-IR")} تخفیفِ اولین خرید`;
  }
}

// «کوپن‌های من» -- برخلافِ اسمش، این کدها به‌طورِ خصوصی به این کاربر تخصیص
// داده نشدن (سیستمِ کوپنِ فعلی چنین مفهومی نداره)؛ این صفحه فقط همه‌ی کدهای
// فعال+عمومی+معتبر-برای-همین-کاربر رو (با فیلترِ FIRST_BUY هم لحاظ‌شده) یکجا
// و قابل‌کپی نشون می‌ده -- دقیقاً همون چیزی که موقعِ چک‌اوت قابلِ استفاده‌ست
export default async function MyCouponsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const coupons = await fetchAvailableCouponsForUser(session.user.id);

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
      <header>
        <h1 className="text-xl font-bold">🎟️ کوپن‌های من</h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          این‌ها کدهای تخفیفی‌ان که همین الان می‌تونی موقعِ ثبتِ سفارش استفاده کنی.
        </p>
      </header>

      {coupons.length === 0 ? (
        <p className="border cut-line rounded-xl p-5 bg-white text-sm text-[var(--color-muted)]">
          فعلاً هیچ کدِ تخفیفِ فعالی برات نیست.
        </p>
      ) : (
        <div className="space-y-3">
          {coupons.map((c) => (
            <div
              key={c.id}
              className="border cut-line rounded-xl p-4 bg-white flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <p className="font-bold">{describeCoupon(c)}</p>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  {c.minOrderAmount > 0 &&
                    `حداقلِ سفارش: ${c.minOrderAmount.toLocaleString("fa-IR")} تومان`}
                  {c.minOrderAmount > 0 && c.expiresAt && " — "}
                  {c.expiresAt && `تا ${new Date(c.expiresAt).toLocaleDateString("fa-IR")} معتبر`}
                </p>
              </div>
              <CopyCouponCodeButton code={c.code} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
