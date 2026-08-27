"use client";

import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";
import { InstallAppButton } from "@/components/InstallAppButton";
import { t } from "@/lib/i18n";

const socialLinks = [
  { href: "https://instagram.com", label: "اینستاگرام", icon: "📷" },
  { href: "https://t.me", label: "تلگرام", icon: "✈️" },
  { href: "https://wa.me", label: "واتساپ", icon: "💬" },
];

export function Footer({
  externalSites = [],
  trustBadges = [],
}: {
  externalSites?: { id: string; name: string; slug: string }[];
  trustBadges?: { icon: string; text: string }[];
}) {
  const { lang } = useLang();

  return (
    <footer className="border-t cut-line mt-16 bg-[var(--color-linen-dim)]">
      {trustBadges.length > 0 && (
        <div className="border-b cut-line">
          <div className="max-w-[1600px] mx-auto px-4 py-5 flex flex-wrap justify-center gap-x-8 gap-y-3">
            {trustBadges.map((badge, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-lg">{badge.icon}</span>
                <span className="font-medium">{badge.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="max-w-[1600px] mx-auto px-4 py-12 grid sm:grid-cols-2 md:grid-cols-4 gap-10">
        {/* لوگو و شعار */}
        <div>
          <div className="text-2xl font-extrabold text-[var(--color-wine)] mb-2">مُداشاپ</div>
          <p className="text-sm text-[var(--color-muted)]">مد ایرانی، دوخته‌شده با دقت.</p>
        </div>

        {/* درباره مُداشاپ */}
        <div>
          <h3 className="font-bold mb-3 pb-2 border-b-2 border-[var(--color-wine)] inline-block">
            {t(lang, "aboutUs")}
          </h3>
          <ul className="space-y-2 text-sm text-[var(--color-muted)]">
            <li>
              <Link href="/" className="hover:text-[var(--color-wine)]">
                {t(lang, "mazonProducts")}
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
                {t(lang, "flashSale")}
              </Link>
            </li>
            <li>
              <Link href="/about" className="hover:text-[var(--color-wine)]">
                درباره ما
              </Link>
            </li>
            <li>
              <Link href="/blog" className="hover:text-[var(--color-wine)]">
                مجله مُداشاپ
              </Link>
            </li>
            <li>
              <Link href="/faq" className="hover:text-[var(--color-wine)]">
                سوالات پرتکرار
              </Link>
            </li>
          </ul>
        </div>

        {/* حساب کاربری */}
        <div>
          <h3 className="font-bold mb-3 pb-2 border-b-2 border-[var(--color-wine)] inline-block">
            {t(lang, "account")}
          </h3>
          <ul className="space-y-2 text-sm text-[var(--color-muted)]">
            <li>
              <Link href="/profile" className="hover:text-[var(--color-wine)]">
                {t(lang, "myProfile")}
              </Link>
            </li>
            <li>
              <Link href="/orders" className="hover:text-[var(--color-wine)]">
                {t(lang, "myOrders")}
              </Link>
            </li>
            <li>
              <Link href="/track-order" className="hover:text-[var(--color-wine)]">
                پیگیری سفارش
              </Link>
            </li>
            <li>
              <Link href="/wallet" className="hover:text-[var(--color-wine)]">
                {t(lang, "wallet")}
              </Link>
            </li>
            <li>
              <Link href="/wishlist" className="hover:text-[var(--color-wine)]">
                {t(lang, "wishlist")}
              </Link>
            </li>
          </ul>
        </div>

        {/* ارتباط با ما */}
        <div>
          <h3 className="font-bold mb-3 pb-2 border-b-2 border-[var(--color-wine)] inline-block">
            {t(lang, "contactUs")}
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
            <span className="text-sm font-medium">{t(lang, "social")}</span>
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
            <InstallAppButton className="text-xs border cut-line rounded-full px-3 py-1.5 text-[var(--color-wine)]" />
          </div>
          <div className="flex flex-col sm:items-end gap-1.5">
            <div className="flex items-center gap-3 text-xs text-[var(--color-muted)]">
              <Link href="/terms" className="hover:text-[var(--color-wine)]">
                قوانین و مقررات
              </Link>
              <Link href="/privacy" className="hover:text-[var(--color-wine)]">
                حریم خصوصی
              </Link>
            </div>
            <p className="text-xs text-[var(--color-muted)]">
              © {new Date().getFullYear()} مُداشاپ — {t(lang, "copyright")}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
