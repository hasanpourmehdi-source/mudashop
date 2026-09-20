"use client";

import { useEffect, useState } from "react";

// این صفحه فقط متن‌های واقعیِ سایته (درباره‌ما/قوانین/...) -- طبقِ خواسته‌ی
// صریح، باقیِ تنظیمات (تیک‌ها، آستانه‌های عددی، ...) رفتن توی
// admin/other-settings/page.tsx
const RETURN_POLICY_KEY = "returnPolicyText";
const POSTER_CURRENCY_KEY = "posterCurrencyText";
const ABOUT_KEY = "aboutText";
const TERMS_KEY = "termsText";
const PRIVACY_KEY = "privacyText";
const FAQ_KEY = "faqText";

export default function AdminSettingsPage() {
  const [returnPolicy, setReturnPolicy] = useState("");
  const [posterCurrencyText, setPosterCurrencyText] = useState("");
  const [aboutText, setAboutText] = useState("");
  const [termsText, setTermsText] = useState("");
  const [privacyText, setPrivacyText] = useState("");
  const [faqText, setFaqText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => (res.ok ? res.json() : Promise.resolve({} as Record<string, string>)))
      .then((data: Record<string, string>) => {
        setReturnPolicy(data[RETURN_POLICY_KEY] ?? "");
        setPosterCurrencyText(data[POSTER_CURRENCY_KEY] ?? "");
        setAboutText(data[ABOUT_KEY] ?? "");
        setTermsText(data[TERMS_KEY] ?? "");
        setPrivacyText(data[PRIVACY_KEY] ?? "");
        setFaqText(data[FAQ_KEY] ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveKey(key: string, value: string) {
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `خطا در ذخیره (کد ${res.status})`);
    }
  }

  async function handleSave() {
    setError("");
    setSuccess(false);
    setSaving(true);
    try {
      await saveKey(RETURN_POLICY_KEY, returnPolicy);
      await saveKey(POSTER_CURRENCY_KEY, posterCurrencyText);
      await saveKey(ABOUT_KEY, aboutText);
      await saveKey(TERMS_KEY, termsText);
      await saveKey(PRIVACY_KEY, privacyText);
      await saveKey(FAQ_KEY, faqText);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در ذخیره");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-[var(--color-muted)]">در حال بارگذاری...</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-bold">متن‌های سایت</h1>

      <div className="border cut-line rounded-lg p-4 bg-white space-y-3">
        <div>
          <p className="text-sm font-bold mb-1">شرایط مرجوع کردن کالا</p>
          <p className="text-[10px] text-[var(--color-muted)] mb-2">
            همین متن دقیقاً زیر دکمه‌ی «افزودن به سبد» توی صفحه‌ی هر محصول مزون نشون داده می‌شه.
          </p>
          <textarea
            value={returnPolicy}
            onChange={(e) => setReturnPolicy(e.target.value)}
            rows={4}
            className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
          />
        </div>

        <div>
          <p className="text-sm font-bold mb-1">متنِ باکسِ بنفشِ پوسترِ اینستاگرام</p>
          <p className="text-[10px] text-[var(--color-muted)] mb-2">
            هر خط رو جدا بنویس (Enter بین خط‌ها) -- توی «پوستر اینستاگرام» بالای ستونِ اطلاعات نشون داده می‌شه.
          </p>
          <textarea
            value={posterCurrencyText}
            onChange={(e) => setPosterCurrencyText(e.target.value)}
            rows={2}
            className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
          />
        </div>

        <div>
          <p className="text-sm font-bold mb-1">درباره ما (صفحه‌ی /about)</p>
          <textarea
            value={aboutText}
            onChange={(e) => setAboutText(e.target.value)}
            rows={4}
            className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
          />
        </div>

        <div>
          <p className="text-sm font-bold mb-1">قوانین و مقررات (صفحه‌ی /terms)</p>
          <textarea
            value={termsText}
            onChange={(e) => setTermsText(e.target.value)}
            rows={6}
            className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
          />
        </div>

        <div>
          <p className="text-sm font-bold mb-1">حریم خصوصی (صفحه‌ی /privacy)</p>
          <textarea
            value={privacyText}
            onChange={(e) => setPrivacyText(e.target.value)}
            rows={4}
            className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
          />
        </div>

        <div>
          <p className="text-sm font-bold mb-1">سوالات پرتکرار (صفحه‌ی /faq)</p>
          <textarea
            value={faqText}
            onChange={(e) => setFaqText(e.target.value)}
            rows={6}
            className="w-full border cut-line rounded-lg px-3 py-2 text-sm bg-white"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-700">ذخیره شد.</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50"
        >
          {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
        </button>
      </div>
    </div>
  );
}
