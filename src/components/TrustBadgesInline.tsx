// نسخه‌ی جمع‌وجورِ همون بج‌های اعتمادِ فوتر (🛡️/🚚/↩️/💰) -- طبقِ درخواستِ صریح،
// نزدیکِ دکمه‌ی خرید (صفحه‌ی محصول/چک‌اوت) هم نشون داده می‌شه، چون فوتر
// معمولاً اسکرول‌نشده می‌مونه و مشتریِ اولین‌بار ممکنه اصلاً نبینتش
export function TrustBadgesInline({ badges }: { badges: { icon: string; text: string }[] }) {
  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-[var(--color-muted)] mb-3">
      {badges.map((badge, i) => (
        <span key={i} className="flex items-center gap-1">
          <span>{badge.icon}</span>
          <span>{badge.text}</span>
        </span>
      ))}
    </div>
  );
}
