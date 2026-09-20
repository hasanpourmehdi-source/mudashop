// اسکلتِ گریدِ نتیجه -- طبقِ درخواستِ صریح، به‌جای اسپینرِ عمومیِ ریشه (که فقط
// وسطِ صفحه یه چرخِ خالی نشون می‌داد)، همون چیدمانِ واقعیِ صفحه (ستونِ فیلتر +
// گریدِ کارت‌ها) رو با جعبه‌های خاکستریِ پالسی از قبل نشون می‌ده -- کاربر حسِ
// آماده‌شدنِ فوریِ صفحه رو می‌گیره، نه صفحه‌ی سفید تا آخرِ fetch زنده‌ی ترندیول
function SkeletonBox({ className = "" }: { className?: string }) {
  return <div className={`bg-[var(--color-linen-dim)] rounded animate-pulse ${className}`} />;
}

export default function MarketplaceLoading() {
  return (
    <div className="max-w-[1600px] mx-auto px-4 pt-3 pb-8 md:pt-8">
      <div className="grid md:grid-cols-[240px_1fr] gap-8">
        {/* ستونِ فیلتر -- فقط دسکتاپ، دقیقاً مثلِ ExternalSiteFilters واقعی */}
        <div className="hidden md:block space-y-3">
          <SkeletonBox className="h-9 w-full" />
          <SkeletonBox className="h-9 w-full" />
          <SkeletonBox className="h-9 w-full" />
        </div>

        <div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <SkeletonBox className="h-6 w-40" />
            <SkeletonBox className="h-9 w-28 rounded-lg" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="border cut-line rounded-lg overflow-hidden">
                <SkeletonBox className="aspect-[3/4] rounded-none" />
                <div className="p-3 space-y-2">
                  <SkeletonBox className="h-3 w-full" />
                  <SkeletonBox className="h-3 w-2/3" />
                  <SkeletonBox className="h-4 w-1/2 mt-2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
