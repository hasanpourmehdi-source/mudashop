import Link from "next/link";

export function Breadcrumb({
  items,
}: {
  items: { name: string; href?: string }[];
}) {
  return (
    <nav className="flex items-center gap-2 text-xs text-[var(--color-muted)] mb-4 flex-wrap">
      <Link href="/" className="hover:text-[var(--color-wine)]">
        مُداشاپ
      </Link>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          {/* این نماد یه کاراکتر یونیکد با ویژگی Bidi_Mirrored=Yes ه -- یعنی
              اگه بدون جهت صریح توی متن راست‌به‌چپ قرار بگیره، مرورگر خودکار
              آینه‌ش می‌کنه (‹ می‌شه ›، یعنی برعکسِ جهت درست). با dir="ltr"
              جلوی این آینه‌شدن خودکار گرفته می‌شه */}
          <span dir="ltr">‹</span>
          {item.href ? (
            <Link href={item.href} className="hover:text-[var(--color-wine)]">
              {item.name}
            </Link>
          ) : (
            <span className="text-[var(--color-ink)] font-medium">{item.name}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
