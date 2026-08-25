import type { Metadata } from "next";
import { getSiteSetting, SITE_SETTING_KEYS } from "@/lib/siteSettings";

export const metadata: Metadata = {
  title: "قوانین و مقررات",
  alternates: { canonical: "/terms" },
};

export default async function TermsPage() {
  const text = await getSiteSetting(SITE_SETTING_KEYS.TERMS_TEXT);
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-xl font-bold mb-6">قوانین و مقررات</h1>
      <p className="text-sm leading-loose whitespace-pre-line text-[var(--color-ink)]">{text}</p>
    </div>
  );
}
