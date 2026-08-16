"use client";

import { useEffect, useState, useCallback } from "react";
import { foldTurkish } from "@/lib/turkishText";

type FilterRow = {
  id: string;
  filterKey: string;
  valueId: string;
  nameTr: string;
  nameFa: string | null;
  nameFaSuggested: boolean;
  noTranslationNeeded: boolean;
  groupTitleTr: string | null;
};

const SITES = [
  { slug: "trendyol", label: "ترندیول" },
  { slug: "trendyol-milla", label: "میلا" },
];

export default function TrendyolFiltersAdminPage() {
  const [rows, setRows] = useState<FilterRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // ترندیول و میلا کاتالوگ کاملاً جدا دارن -- هر برند/فیلتر باید جدا sync/بازبینی بشه
  const [site, setSite] = useState("trendyol");
  const [query, setQuery] = useState("");
  const [untranslatedOnly, setUntranslatedOnly] = useState(false);
  const [suggestedOnly, setSuggestedOnly] = useState(false);
  const [groupsOnly, setGroupsOnly] = useState(false);
  // مواردی که اصلاً نیازی به ترجمه ندارن (بازه‌های عددی، برندها، یا خودِ ادمین
  // دستی علامت‌شون زده) رو از لیست پنهون می‌کنه
  const [hideNonTranslatable, setHideNonTranslatable] = useState(true);
  // برعکسِ بالا -- فقط همون‌هایی که خودِ ادمین دستی «بدون نیاز به ترجمه» زده
  // رو نشون می‌ده، برای بازبینی/برگردوندن اشتباهی‌ها
  const [showManuallyMarkedOnly, setShowManuallyMarkedOnly] = useState(false);

  const [syncWc, setSyncWc] = useState("");
  const [syncWg, setSyncWg] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  // قالب ترجمه‌ی گروهی -- مثلاً "Yaş" -> "سال"، تا رو همه‌ی مواردی که این
  // کلمه رو دارن (مثل "10-11 Yaş") یهو اعمال بشه، به‌جای تایپ تک‌تکشون
  const [bulkFind, setBulkFind] = useState("");
  const [bulkReplace, setBulkReplace] = useState("");
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (untranslatedOnly) params.set("untranslatedOnly", "1");
      if (suggestedOnly) params.set("suggestedOnly", "1");
      if (groupsOnly) params.set("groupsOnly", "1");
      params.set("site", site);
      params.set("limit", "300");
      const res = await fetch(`/api/admin/external-sites/trendyol-filters?${params.toString()}`);
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
  }, [query, untranslatedOnly, suggestedOnly, groupsOnly, site]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  async function handleSync() {
    if (!syncWc.trim() && !syncWg.trim()) {
      setSyncMessage("");
      setError("حداقل یکی از wc یا wg رو وارد کن");
      return;
    }
    setSyncing(true);
    setSyncMessage("");
    setError("");
    try {
      const res = await fetch("/api/admin/external-sites/trendyol-filters/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wc: syncWc.trim() || undefined, wg: syncWg.trim() || undefined, siteSlug: site }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "خطا در همگام‌سازی");
        return;
      }
      setSyncMessage(
        `از ${data.total} ردیف: ${data.inserted} مورد جدید (${data.autoSuggested} تاش با ترجمه‌ی پیشنهادی)، ${data.updated} مورد به‌روز شد.`
      );
      await load();
    } catch {
      setError("خطا در ارتباط با سرور");
    } finally {
      setSyncing(false);
    }
  }

  async function saveTranslation(id: string, nameFa: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, nameFa, nameFaSuggested: false } : r)));
    await fetch(`/api/admin/external-sites/trendyol-filters/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nameFa }),
    });
  }

  // ادمین دستی می‌گه «این نیاز به ترجمه نداره» (مثلاً کدهای سایز عجیبی که
  // تشخیص خودکار نگرفته)، یا برعکس، از لیستِ بدون‌نیاز برش می‌گردونه
  async function setNoTranslationNeeded(id: string, value: boolean) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, noTranslationNeeded: value } : r)));
    await fetch(`/api/admin/external-sites/trendyol-filters/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noTranslationNeeded: value }),
    });
  }

  // یه پیدا/جایگزین ساده رو روی همه‌ی مواردی که هنوز ترجمه ندارن و اون کلمه
  // رو توی اسم ترکی‌شون دارن اعمال می‌کنه -- مثلاً "Yaş" -> "سال" باعث می‌شه
  // "10-11 Yaş" خودکار بشه "10-11 سال"، بدون اینکه اعداد دست‌کاری بشن.
  // هم پیداکردن هم جایگزینی حروف خاص ترکی رو نادیده می‌گیرن -- یعنی تایپ
  // "Yas" هم دقیقاً همون موردهایی که "Yaş" دارن رو پیدا می‌کنه
  const matches = rows.filter(
    (r) => r.valueId !== "" && !r.nameFa && foldTurkish(r.nameTr).includes(foldTurkish(bulkFind.trim()))
  );

  // چون foldTurkish همیشه یه‌به‌یک روی طول رشته عمل می‌کنه (هر حرف خاص ترکی
  // دقیقاً با یه حرف ساده جایگزین می‌شه، نه بیشتر/کمتر)، می‌شه موقعیت تطبیق
  // رو روی نسخه‌ی فولدشده پیدا کرد و همون بازه رو روی متن اصلی جایگزین کرد --
  // بدون اینکه بقیه‌ی متن (که ممکنه حروف خاص ترکی داشته باشه) خراب بشه
  function foldAwareReplace(original: string, find: string, replace: string): string {
    const foldedOriginal = foldTurkish(original);
    const foldedFind = foldTurkish(find);
    if (!foldedFind) return original;
    let result = "";
    let i = 0;
    while (i < original.length) {
      if (foldedOriginal.slice(i, i + foldedFind.length) === foldedFind) {
        result += replace;
        i += foldedFind.length;
      } else {
        result += original[i];
        i++;
      }
    }
    return result;
  }

  async function applyBulkTemplate() {
    const find = bulkFind.trim();
    if (!find) {
      setBulkMessage("اول یه کلمه برای پیدا کردن بنویس.");
      return;
    }
    if (matches.length === 0) {
      setBulkMessage("هیچ موردِ ترجمه‌نشده‌ای با این کلمه پیدا نشد.");
      return;
    }
    setBulkApplying(true);
    setBulkMessage("");
    const updates = matches.map((r) => ({ id: r.id, nameFa: foldAwareReplace(r.nameTr, find, bulkReplace) }));
    setRows((prev) => {
      const byId = new Map(updates.map((u) => [u.id, u.nameFa]));
      return prev.map((r) => (byId.has(r.id) ? { ...r, nameFa: byId.get(r.id)!, nameFaSuggested: false } : r));
    });
    await Promise.all(
      updates.map((u) =>
        fetch(`/api/admin/external-sites/trendyol-filters/${u.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nameFa: u.nameFa }),
        })
      )
    );
    setBulkMessage(`${updates.length} مورد ترجمه شد.`);
    setBulkApplying(false);
  }

  // هر مقداری که توش عدد باشه (چه خالص عددی مثل "0-500"، چه بازه‌ی
  // اندازه/سایز مثل "2XL-3XL" یا "28/32")، ترجمه‌اش خودشه -- نیازی به دست‌کاری
  // انسانی نداره، پس با این تیک از لیست پنهون می‌شه
  function isPureNumericOrRange(text: string): boolean {
    return /\d/.test(text);
  }

  // ردیف‌ها رو بر اساس filterKey دسته‌بندی می‌کنه -- سرگروه (valueId="") و
  // همه‌ی زیرگروه‌هاش (که همون filterKey رو دارن) با هم میان، نه پخش‌وپلا
  // توی یه لیست الفبایی که ربطشون به هم گم بشه
  const grouped = (() => {
    const byKey = new Map<string, { header: FilterRow | null; values: FilterRow[] }>();
    for (const row of rows) {
      if (!byKey.has(row.filterKey)) byKey.set(row.filterKey, { header: null, values: [] });
      const entry = byKey.get(row.filterKey)!;
      if (row.valueId === "") entry.header = row;
      else entry.values.push(row);
    }
    if (showManuallyMarkedOnly) {
      // حالت بازبینی -- فقط همون‌هایی که خودِ ادمین دستی زده رو نشون بده
      for (const entry of byKey.values()) {
        entry.values = entry.values.filter((v) => v.noTranslationNeeded);
      }
    } else if (hideNonTranslatable) {
      // حالت عادی -- هم علامت دستی، هم تشخیص خودکار (بازه‌ی عددی/برند) رو پنهون کن
      for (const entry of byKey.values()) {
        entry.values = entry.values.filter(
          (v) => !v.noTranslationNeeded && v.filterKey !== "WebBrand" && !isPureNumericOrRange(v.nameTr)
        );
      }
    }
    const groups = Array.from(byKey.entries());
    // اگه یه گروه بعد از پاکسازی، نه سرگروهی داره نه مقداری، نشونش نده
    const nonEmpty = groups.filter(([, entry]) =>
      showManuallyMarkedOnly ? entry.values.length > 0 : entry.header || entry.values.length > 0
    );
    return nonEmpty.sort(([, a], [, b]) => {
      const nameA = a.header?.nameTr ?? a.values[0]?.groupTitleTr ?? "";
      const nameB = b.header?.nameTr ?? b.values[0]?.groupTitleTr ?? "";
      return nameA.localeCompare(nameB);
    });
  })();

  function renderRow(row: FilterRow, indented: boolean) {
    return (
      <div
        key={row.id}
        className={`grid grid-cols-[1fr,1fr,auto,auto] gap-2 px-3 py-2 border-t cut-line items-center ${
          indented ? "bg-white" : "bg-[var(--color-linen-dim)]"
        }`}
      >
        <div className={indented ? "pr-4" : ""}>
          {!indented && (
            <span className="font-bold text-[10px] bg-white rounded px-1.5 py-0.5 ml-1">سرگروه</span>
          )}
          <span className={`text-sm ${!indented ? "font-bold" : ""}`} dir="ltr">
            {row.nameTr}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <input
            key={`${row.id}:${row.nameFa ?? ""}`}
            type="text"
            defaultValue={row.nameFa ?? ""}
            onBlur={(e) => {
              if (e.target.value !== (row.nameFa ?? "")) saveTranslation(row.id, e.target.value);
            }}
            placeholder="ترجمه‌ی فارسی..."
            className={`border cut-line rounded-lg px-2 py-1 text-sm flex-1 ${
              !row.nameFa ? "border-amber-400" : row.nameFaSuggested ? "border-dashed border-amber-400" : ""
            }`}
          />
          {row.nameFaSuggested && (
            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 rounded-full px-1.5 py-0.5 shrink-0">
              پیشنهادی
            </span>
          )}
        </div>
        <span className="text-xs font-mono text-[var(--color-muted)]" dir="ltr">
          {row.filterKey}
        </span>
        <span className="shrink-0">
          {indented &&
            (row.noTranslationNeeded ? (
              <button
                onClick={() => setNoTranslationNeeded(row.id, false)}
                className="text-[10px] text-[var(--color-muted)] underline"
              >
                برگردون به لیست
              </button>
            ) : (
              <button
                onClick={() => setNoTranslationNeeded(row.id, true)}
                className="text-[10px] border cut-line rounded-lg px-2 py-1 hover:border-[var(--color-wine)] whitespace-nowrap"
              >
                نیاز به ترجمه نداره
              </button>
            ))}
        </span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold">ترجمه‌ی فیلترهای ترندیول</h1>
        <p className="text-xs text-[var(--color-muted)] mt-1">
          گروه‌های فیلتر واقعی ترندیول (رنگ، برند، نوع کیف، سوییچ‌ها، ...) و مقادیرشون -- برای
          همگام‌سازی، یه wc (دسته‌بندی) یا wg (جنسیت) نمونه بده، همه‌ی ~۳۰ گروه با تمام مقادیرشون
          گرفته می‌شن.
        </p>
      </div>

      {/* ترندیول و میلا کاتالوگ جدا دارن -- انتخاب سایت هم روی لیستِ زیر هم
          روی sync اثر می‌ذاره (که برای کدوم سایت ذخیره بشه) */}
      <div className="flex items-center gap-1.5">
        {SITES.map((s) => (
          <button
            key={s.slug}
            onClick={() => setSite(s.slug)}
            className={`text-xs font-bold rounded-full px-3 py-1.5 border cut-line ${
              site === s.slug ? "bg-[var(--color-wine)] text-white" : "hover:border-[var(--color-wine)]"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={syncWc}
          onChange={(e) => setSyncWc(e.target.value)}
          placeholder="wc (مثلا 75)"
          dir="ltr"
          className="border cut-line rounded-lg px-3 py-2 text-sm w-32"
        />
        <input
          type="text"
          value={syncWg}
          onChange={(e) => setSyncWg(e.target.value)}
          placeholder="wg (1 یا 2)"
          dir="ltr"
          className="border cut-line rounded-lg px-3 py-2 text-sm w-28"
        />
        <button
          onClick={handleSync}
          disabled={syncing}
          className="bg-[var(--color-wine)] text-white rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-60"
        >
          {syncing ? "در حال همگام‌سازی..." : "🔄 همگام‌سازی از این wc/wg"}
        </button>
      </div>
      {syncMessage && <p className="text-xs text-green-700">{syncMessage}</p>}

      <div className="border cut-line rounded-lg p-3 space-y-2">
        <p className="text-xs font-bold">قالب ترجمه‌ی گروهی</p>
        <p className="text-xs text-[var(--color-muted)]">
          مثلاً پیدا کن «Yaş»، جایگزین کن با «سال» -- روی همه‌ی مواردِ ترجمه‌نشده‌ای که این کلمه رو دارن
          (مثل «10-11 Yaş») یهو اعمال می‌شه، اعداد دست‌نخورده می‌مونن.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={bulkFind}
            onChange={(e) => setBulkFind(e.target.value)}
            placeholder="پیدا کن (مثلا Yaş)"
            dir="ltr"
            className="border cut-line rounded-lg px-3 py-1.5 text-sm w-40"
          />
          <span className="text-xs text-[var(--color-muted)]">→</span>
          <input
            type="text"
            value={bulkReplace}
            onChange={(e) => setBulkReplace(e.target.value)}
            placeholder="جایگزین کن با (مثلا سال)"
            className="border cut-line rounded-lg px-3 py-1.5 text-sm w-40"
          />
          <button
            onClick={applyBulkTemplate}
            disabled={bulkApplying}
            className="bg-[var(--color-wine)] text-white rounded-lg px-4 py-1.5 text-sm font-bold disabled:opacity-60"
          >
            {bulkApplying ? "در حال اعمال..." : "اعمال روی همه‌ی موارد مشابه"}
          </button>
        </div>
        {bulkMessage && <p className="text-xs text-green-700">{bulkMessage}</p>}
      </div>

      {error && <p className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex items-center gap-3 flex-wrap text-xs">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={untranslatedOnly} onChange={(e) => setUntranslatedOnly(e.target.checked)} />
          فقط ترجمه‌نشده‌ها
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={suggestedOnly} onChange={(e) => setSuggestedOnly(e.target.checked)} />
          فقط پیشنهادی (تأییدنشده)
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={groupsOnly} onChange={(e) => setGroupsOnly(e.target.checked)} />
          فقط عنوان گروه‌ها
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={hideNonTranslatable}
            disabled={showManuallyMarkedOnly}
            onChange={(e) => setHideNonTranslatable(e.target.checked)}
          />
          پنهان‌کردن مواردی که نیازی به ترجمه ندارن (بازه‌های عددی، برندها، یا خودم زدم)
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={showManuallyMarkedOnly}
            onChange={(e) => setShowManuallyMarkedOnly(e.target.checked)}
          />
          فقط همون‌هایی که خودم «نیاز به ترجمه نداره» زدم رو نشون بده (بازبینی)
        </label>
        <span className="text-[var(--color-muted)]">
          {grouped.reduce((sum, [, entry]) => sum + (entry.header ? 1 : 0) + entry.values.length, 0)} مورد
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جست‌وجو..."
          className="border cut-line rounded-lg px-3 py-1.5 flex-1 min-w-[160px]"
        />
      </div>

      <div className="border cut-line rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr,1fr,auto,auto] gap-2 px-3 py-2 text-xs font-bold bg-[var(--color-linen-dim)]">
          <span>گروه / اسم ترکی</span>
          <span>ترجمه‌ی فارسی</span>
          <span>filterKey</span>
          <span></span>
        </div>
        {loading ? (
          <p className="text-sm text-[var(--color-muted)] p-3">در حال بارگذاری...</p>
        ) : grouped.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)] p-3">چیزی پیدا نشد.</p>
        ) : (
          grouped.map(([filterKey, entry]) => {
            const groupLabel = entry.header?.nameTr ?? entry.values[0]?.groupTitleTr;
            return (
              <div key={filterKey}>
                {!entry.header && groupLabel && (
                  <div className="grid grid-cols-[1fr,1fr,auto,auto] gap-2 px-3 py-1.5 border-t cut-line bg-[var(--color-linen-dim)]">
                    <span className="text-xs text-[var(--color-muted)]" dir="ltr">
                      {groupLabel}
                    </span>
                  </div>
                )}
                {entry.header && renderRow(entry.header, false)}
                {entry.values.map((v) => renderRow(v, true))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
