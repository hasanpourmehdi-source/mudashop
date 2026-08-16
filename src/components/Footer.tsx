import Link from "next/link";

const socialLinks = [
  { href: "https://instagram.com", label: "اینستاگرام", icon: "📷" },
  { href: "https://t.me", label: "تلگرام", icon: "✈️" },
  { href: "https://wa.me", label: "واتساپ", icon: "💬" },
];

export function Footer({
  externalSites = [],
}: {
  externalSites?: { id: string; name: string; slug: string }[];
}) {
  return (
    <footer className="border-t cut-line mt-16 bg-[var(--color-linen-dim)]">
      <div className="max-w-[1600px] mx-auto px-4 py-12 grid sm:grid-cols-2 md:grid-cols-4 gap-10">
        {/* لوگو و شعار */}
        <div>
          <div className="text-2xl font-extrabold text-[var(--color-wine)] mb-2">مُداشاپ</div>
          <p className="text-sm text-[var(--color-muted)]">مد ایرانی، دوخته‌شده با دقت.</p>
        </div>

        {/* درباره مُداشاپ */}
        <div>
          <h3 className="font-bold mb-3 pb-2 border-b-2 border-[var(--color-wine)] inline-block">
            درباره مُداشاپ
          </h3>
          <ul className="space-y-2 text-sm text-[var(--color-muted)]">
            <li>
              <Link href="/" className="hover:text-[var(--color-wine)]">
                محصولات مزون
              </Link>
            </li>
            {externalSites.map((site) => (
              <li key={site.id}>
                <Link href={`/marketplaces/${site.slug}`} className="hover:text-[var(--color-wine)]">
                  {site.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/products?flashSaleOnly=true" className="hover:text-[var(--color-wine)]">
                حراج فلش
              </Link>
            </li>
          </ul>
        </div>

        {/* حساب کاربری */}
        <div>
          <h3 className="font-bold mb-3 pb-2 border-b-2 border-[var(--color-wine)] inline-block">
            حساب کاربری
          </h3>
          <ul className="space-y-2 text-sm text-[var(--color-muted)]">
            <li>
              <Link href="/profile" className="hover:text-[var(--color-wine)]">
                پروفایل من
              </Link>
            </li>
            <li>
              <Link href="/orders" className="hover:text-[var(--color-wine)]">
                سفارش‌های من
              </Link>
            </li>
            <li>
              <Link href="/wallet" className="hover:text-[var(--color-wine)]">
                کیف پول
              </Link>
            </li>
            <li>
              <Link href="/wishlist" className="hover:text-[var(--color-wine)]">
                علاقه‌مندی‌ها
              </Link>
            </li>
          </ul>
        </div>

        {/* ارتباط با ما */}
        <div>
          <h3 className="font-bold mb-3 pb-2 border-b-2 border-[var(--color-wine)] inline-block">
            ارتباط با مُداشاپ
          </h3>
          <ul className="space-y-2.5 text-sm text-[var(--color-muted)]">
            <li className="flex items-center gap-2">
              <span>📞</span> ۰۲۱-۴۵۸۹۸۰۰۰
            </li>
            <li className="flex items-center gap-2">
              <span>✉️</span> support@mudashop.ir
            </li>
            <li className="flex items-start gap-2">
              <span>🕒</span> شنبه تا چهارشنبه، ۹ الی ۱۸
            </li>
            <li className="flex items-start gap-2">
              <span>📍</span> تهران، ایران
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t cut-line">
        <div className="max-w-[1600px] mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">شبکه‌های اجتماعی</span>
            {socialLinks.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="w-9 h-9 rounded-full border cut-line bg-white flex items-center justify-center hover:border-[var(--color-wine)] transition-colors"
              >
                {s.icon}
              </a>
            ))}
          </div>
          <p className="text-xs text-[var(--color-muted)]">
            © {new Date().getFullYear()} مُداشاپ — همه حقوق محفوظ است.
          </p>
        </div>
      </div>
    </footer>
  );
}
