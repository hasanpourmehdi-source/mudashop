"use client";

import { useEffect, useState, useCallback } from "react";

type TermRow = {
  id: string;
  termTr: string;
  termFa: string;
  priority: number;
  noTranslationNeeded: boolean;
};

type UnknownTerm = {
  term: string;
  count: number;
  examples: string[];
};

export default function TrendyolTitleDictionaryAdminPage() {
  const [rows, setRows] = useState<TermRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const [unknownTerms, setUnknownTerms] = useState<UnknownTerm[]>([]);
  const [unknownLoading, setUnknownLoading] = useState(false);

  // فرم افزودن اصطلاح جدید -- یا از صفر تایپ می‌شه، یا با کلیک روی یه کلمه‌ی
  // ناشناخته‌ی پرتکرار پر می‌شه (پایین همین صفحه)
  const [newTermTr, setNewTermTr] = useState("");
  const [newTermFa, setNewTermFa] = useState("");
  const [newPriority, setNewPriority] = useState(0);
  const [adding, setAdding] = useState(false);
  const [addMessage, setAddMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      params.set("limit", "500");
      const res = await fetch(`/api/admin/trendyol-title-dictionary?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "خطا در دریافت لیست");
        return;
      }
      setRows(data.results ?? []);
    } catch {
      setError("خطا در ارتباط با سرور");
    } finally {
      setLoading(false);
    }
  }, [query]);

  const loadUnknownTerms = useCallback(async (): Promise<UnknownTerm[]> => {
    setUnknownLoading(true);
    try {
      const res = await fetch("/api/admin/trendyol-title-dictionary/unknown-terms");
      const data = await res.json();
      const terms: UnknownTerm[] = res.ok ? data.terms ?? [] : [];
      setUnknownTerms(terms);
      return terms;
    } finally {
      setUnknownLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    loadUnknownTerms();
  }, [loadUnknownTerms]);

  async function saveTranslation(id: string, termFa: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, termFa } : r)));
    await fetch(`/api/admin/trendyol-title-dictionary/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ termFa }),
    });
  }

  async function savePriority(id: string, priority: number) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, priority } : r)));
    await fetch(`/api/admin/trendyol-title-dictionary/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority }),
    });
  }

  async function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/admin/trendyol-title-dictionary/${id}`, { method: "DELETE" });
  }

  // ادمین دستی می‌گه «این کلمه نیاز به ترجمه نداره» (مثلاً برند یا اسم خاص) --
  // از این لیست برمی‌گردونه به نیاز-به-ترجمه، دوباره توی لیست کلمات ناشناخته ظاهر می‌شه
  async function toggleNoTranslationNeeded(id: string, value: boolean) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, noTranslationNeeded: value } : r)));
    await fetch(`/api/admin/trendyol-title-dictionary/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noTranslationNeeded: value }),
    });
    if (value) await loadUnknownTerms();
  }

  // یه کلمه‌ی ناشناخته رو مستقیم «بدون نیاز به ترجمه» علامت می‌زنه (بدون نیاز
  // به تایپ معادل فارسی) -- چون این کلمه لزومی به ترجمه نداره، دیگه نباید هربار
  // توی لیست کلمات ناشناخته برگرده
  async function markNoTranslationNeeded(term: string) {
    if (!term) return;
    setAdding(true);
    setAddMessage("");
    try {
      const res = await fetch("/api/admin/trendyol-title-dictionary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termTr: term, noTranslationNeeded: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddMessage(data.error ?? "خطا در ثبت");
        return;
      }
      setAddMessage(`«${term}» به‌عنوان «بدون نیاز به ترجمه» علامت خورد.`);
      await load();
      const refreshedUnknown = await loadUnknownTerms();
      const next = refreshedUnknown[0];
      if (next) {
        prefillFromUnknown(next.term);
      } else {
        setNewTermTr("");
        setNewTermFa("");
        setNewPriority(0);
      }
    } finally {
      setAdding(false);
    }
  }

  async function addTerm(e: React.FormEvent) {
    e.preventDefault();
    if (!newTermTr.trim() || !newTermFa.trim()) {
      setAddMessage("هر دو فیلد الزامی‌اند.");
      return;
    }
    setAdding(true);
    setAddMessage("");
    try {
      const res = await fetch("/api/admin/trendyol-title-dictionary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termTr: newTermTr.trim(), termFa: newTermFa.trim(), priority: newPriority }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddMessage(data.error ?? "خطا در افزودن");
        return;
      }
      setAddMessage(`«${newTermTr}» اضافه شد.`);
      await load();
      const refreshedUnknown = await loadUnknownTerms();
      // به‌جای خالی‌کردن فرم، خودکار کلمه‌ی بعدی (از اول لیست ناشناخته‌ها --
      // چون کلمه‌ی همین الان اضافه‌شده دیگه توی این لیست نیست) رو آماده‌ی
      // ترجمه می‌کنیم تا ادمین بدون کلیک اضافه، پشت‌سرهم ترجمه کنه
      const next = refreshedUnknown[0];
      if (next) {
        prefillFromUnknown(next.term);
      } else {
        setNewTermTr("");
        setNewTermFa("");
        setNewPriority(0);
      }
    } finally {
      setAdding(false);
    }
  }

  // کلیک روی یه کلمه‌ی ناشناخته -- فرم افزودن رو با اون کلمه پر می‌کنه تا ادمین
  // فقط معادل فارسی رو بنویسه
  function prefillFromUnknown(term: string) {
    setNewTermTr(term);
    setNewTermFa("");
    setNewPriority(term.includes(" ") ? 5 : 0);
    document.getElementById("add-term-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // نمونه عنوان‌های همون کلمه‌ای که الان توی فرم افزودن پر شده -- تا وقتی ادمین
  // می‌خواد معادل فارسی بنویسه، بافتِ واقعیِ کلمه رو هم ببینه (نه فقط خودِ کلمه)
  const selectedExamples = unknownTerms.find((t) => t.term === newTermTr.trim())?.examples ?? [];

  // متنی که مستقیم برای هوش مصنوعی (مثلا ChatGPT) کاربردیه -- کلمه + جمله‌هایی
  // که توشون دیده شده، تا معنیش رو با توجه به بافت واقعی پیشنهاد بده. کپی
  // ممکنه شکست بخوره (مرورگر غیرامن، اجازه‌ی کلیپ‌بورد رد شده و...) -- باید
  // به ادمین خبر بدیم، نه این‌که دکمه بی‌صدا هیچ کاری نکنه
  async function copyExamplesForAI() {
    const term = newTermTr.trim();
    const text = `کلمه‌ی «${term}» توی جمله‌های زیر چه معنی می‌تونه داشته باشه؟\n\n${selectedExamples.join("\n")}`;
    setCopyError("");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback قدیمی‌تر برای مرورگرهایی که Clipboard API رو رد می‌کنن
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (!ok) throw new Error("execCommand failed");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setCopyError("کپی خودکار ممکن نشد -- متن رو دستی انتخاب و کپی کن.");
      }
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold">دیکشنری ترجمه‌ی عنوانِ محصولاتِ سایت‌های خارجی</h1>
        <p className="text-xs text-[var(--color-muted)] mt-1">
          هر اصطلاح ترکی که اینجا اضافه/ویرایش بشه، توی ترجمه‌ی عنوان محصولات جدید فوراً اعمال می‌شه (محصولاتی
          که قبلاً ترجمه و کش شدن، دست‌نخورده می‌مونن مگر این‌که کش‌شون پاک بشه).
        </p>
      </div>

      {/* کلمات ناشناخته‌ی پرتکرار -- همون چیزی که باعث می‌شه عنوان کامل فارسی نشه */}
      <div className="border cut-line rounded-lg p-3 space-y-2 bg-amber-50">
        <p className="text-xs font-bold">کلمات ناشناخته‌ی پرتکرار (نیاز فوری به ترجمه)</p>
        <p className="text-xs text-[var(--color-muted)]">
          این کلمات توی عنوان محصولات دیده شدن ولی توی دیکشنری معادل ندارن -- برای همین اون عنوان‌ها هنوز
          نیمه‌ترکی نمایش داده می‌شن. هرچی عدد جلوش بزرگ‌تر، روی تعداد بیشتری عنوان اثر می‌ذاره.
        </p>
        {unknownLoading ? (
          <p className="text-xs text-[var(--color-muted)]">در حال بارگذاری...</p>
        ) : unknownTerms.length === 0 ? (
          <p className="text-xs text-emerald-700">هیچ کلمه‌ی ناشناخته‌ای نمونده -- عالیه!</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {unknownTerms.slice(0, 60).map(({ term, count }) => (
              <button
                key={term}
                onClick={() => prefillFromUnknown(term)}
                title="برای افزودن به دیکشنری کلیک کن"
                dir="ltr"
                className="text-xs border cut-line rounded-full px-2 py-1 bg-white hover:border-[var(--color-wine)] flex items-center gap-1"
              >
                {term}
                <span className="font-bold text-[var(--color-wine)]">×{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* فرم افزودن اصطلاح جدید */}
      <form
        id="add-term-form"
        onSubmit={addTerm}
        className="border cut-line rounded-lg p-3 space-y-2"
      >
        <p className="text-xs font-bold">افزودن اصطلاح جدید</p>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={newTermTr}
            onChange={(e) => setNewTermTr(e.target.value)}
            placeholder="اصطلاح ترکی (مثلا oversize)"
            dir="ltr"
            className="border cut-line rounded-lg px-3 py-1.5 text-sm w-48"
          />
          <span className="text-xs text-[var(--color-muted)]">→</span>
          <input
            type="text"
            value={newTermFa}
            onChange={(e) => setNewTermFa(e.target.value)}
            placeholder="معادل فارسی"
            className="border cut-line rounded-lg px-3 py-1.5 text-sm w-48"
          />
          <input
            type="number"
            value={newPriority}
            onChange={(e) => setNewPriority(Number(e.target.value) || 0)}
            title="اولویت -- برای عبارت‌های چندکلمه‌ای عدد بالاتر بذار تا قبل از تک‌کلمه‌ای‌های داخلش امتحان بشه"
            className="border cut-line rounded-lg px-3 py-1.5 text-sm w-20"
          />
          <button
            type="submit"
            disabled={adding}
            className="bg-[var(--color-wine)] text-white rounded-lg px-4 py-1.5 text-sm font-bold disabled:opacity-60"
          >
            {adding ? "در حال افزودن..." : "افزودن"}
          </button>
          <button
            type="button"
            onClick={() => markNoTranslationNeeded(newTermTr.trim())}
            disabled={adding || !newTermTr.trim()}
            title="این کلمه (مثلاً برند یا اسم خاص) لزومی به ترجمه ندارد -- دیگه توی لیست کلمات ناشناخته نشون داده نمی‌شه"
            className="border cut-line rounded-lg px-4 py-1.5 text-sm font-bold disabled:opacity-60 hover:border-[var(--color-wine)]"
          >
            نیاز به ترجمه ندارد
          </button>
        </div>
        <p className="text-[10px] text-[var(--color-muted)]">
          برای عبارت‌های چندکلمه‌ای (مثلا «uzun kol») اولویت رو ۵ یا بالاتر بذار تا قبل از تک‌کلمه‌ای‌های
          داخلش (مثلا «kol») تشخیص داده بشه.
        </p>
        {selectedExamples.length > 0 && (
          <div className="border cut-line rounded-lg p-2 bg-[var(--color-linen-dim)] space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold text-[var(--color-muted)]">
                نمونه عنوان‌هایی که «{newTermTr.trim()}» توشون دیده شده -- برای ترجمه‌ی دقیق‌تر، بافتش رو ببین:
              </p>
              <button
                type="button"
                onClick={copyExamplesForAI}
                className="shrink-0 text-[10px] border cut-line rounded-full px-2 py-1 bg-white hover:border-[var(--color-wine)] whitespace-nowrap"
              >
                {copied ? "کپی شد ✓" : "کپی برای هوش مصنوعی"}
              </button>
            </div>
            <ul className="space-y-0.5">
              {selectedExamples.map((title, i) => (
                <li key={i} className="text-xs" dir="ltr">
                  {title}
                </li>
              ))}
            </ul>
            {copyError && <p className="text-[10px] text-red-600">{copyError}</p>}
          </div>
        )}
        {addMessage && <p className="text-xs text-green-700">{addMessage}</p>}
      </form>

      {error && <p className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex items-center gap-3 flex-wrap text-xs">
        <span className="text-[var(--color-muted)]">{rows.length} اصطلاح در دیکشنری</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جست‌وجو..."
          className="border cut-line rounded-lg px-3 py-1.5 flex-1 min-w-[160px]"
        />
      </div>

      <div className="border cut-line rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr,1fr,80px,auto] gap-2 px-3 py-2 text-xs font-bold bg-[var(--color-linen-dim)]">
          <span>اصطلاح ترکی</span>
          <span>معادل فارسی</span>
          <span>اولویت</span>
          <span></span>
        </div>
        {loading ? (
          <p className="text-sm text-[var(--color-muted)] p-3">در حال بارگذاری...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)] p-3">چیزی پیدا نشد.</p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[1fr,1fr,80px,auto] gap-2 px-3 py-1.5 border-t cut-line items-center"
            >
              <span className="text-sm flex items-center gap-1.5" dir="ltr">
                {row.termTr}
                {row.noTranslationNeeded && (
                  <span
                    dir="rtl"
                    className="text-[10px] font-bold text-[var(--color-muted)] bg-[var(--color-linen-dim)] rounded-full px-1.5 py-0.5 shrink-0"
                  >
                    بدون نیاز
                  </span>
                )}
              </span>
              <input
                key={`${row.id}:${row.termFa}`}
                type="text"
                defaultValue={row.termFa}
                onBlur={(e) => {
                  if (e.target.value !== row.termFa) saveTranslation(row.id, e.target.value);
                }}
                className="border cut-line rounded-lg px-2 py-1 text-sm"
              />
              <input
                key={`${row.id}:${row.priority}`}
                type="number"
                defaultValue={row.priority}
                onBlur={(e) => {
                  const v = Number(e.target.value) || 0;
                  if (v !== row.priority) savePriority(row.id, v);
                }}
                className="border cut-line rounded-lg px-2 py-1 text-sm"
              />
              <div className="flex items-center gap-2 whitespace-nowrap">
                {row.noTranslationNeeded ? (
                  <button
                    onClick={() => toggleNoTranslationNeeded(row.id, false)}
                    className="text-[10px] text-[var(--color-muted)] underline"
                  >
                    برگردون به نیاز-به-ترجمه
                  </button>
                ) : (
                  <button
                    onClick={() => toggleNoTranslationNeeded(row.id, true)}
                    className="text-[10px] text-[var(--color-muted)] underline"
                  >
                    بدون نیاز به ترجمه
                  </button>
                )}
                <button
                  onClick={() => removeRow(row.id)}
                  className="text-[10px] text-red-600 underline"
                >
                  حذف
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
