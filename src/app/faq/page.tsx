import type { Metadata } from "next";
import { getSiteSetting, SITE_SETTING_KEYS } from "@/lib/siteSettings";

export const metadata: Metadata = {
  title: "سوالات پرتکرار",
  alternates: { canonical: "/faq" },
};

export default async function FaqPage() {
  const text = await getSiteSetting(SITE_SETTING_KEYS.FAQ_TEXT);
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-xl font-bold mb-6">سوالات پرتکرار</h1>
      <p className="text-sm leading-loose whitespace-pre-line text-[var(--color-ink)]">{text}</p>
    </div>
  );
}
