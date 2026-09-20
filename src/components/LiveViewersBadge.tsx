// نشانه‌ی اجتماعیِ لحظه‌ای -- «N نفر همین چند دقیقه‌ی اخیر این محصول رو دیدن».
// دیتای واقعیه (نه عددِ ساختگی)، برای همین عمداً می‌گیم «چند دقیقه‌ی اخیر»، نه
// «همین الان» -- تا چیزی که راست نیست ادعا نشده باشه. زیرِ آستانه‌ی حداقلِ
// تعداد (تنظیم‌پذیر از ادمین) اصلاً چیزی نشون داده نمی‌شه، وگرنه «۰ یا ۱ نفر»
// به‌جای اعتمادسازی، برعکسِ اثرش رو می‌ذاره
export function LiveViewersBadge({
  count,
  minCount,
  windowMinutes,
}: {
  count: number;
  minCount: number;
  windowMinutes: number;
}) {
  if (count < minCount) return null;

  return (
    <p className="text-xs font-bold text-[var(--color-wine)] bg-[var(--color-wine)]/10 rounded-lg px-3 py-2 mb-3 flex items-center gap-1.5">
      <span>🔥</span>
      <span>
        {count.toLocaleString("fa-IR")} نفر توی {windowMinutes.toLocaleString("fa-IR")} دقیقه‌ی اخیر این محصول رو
        دیده‌اند
      </span>
    </p>
  );
}
