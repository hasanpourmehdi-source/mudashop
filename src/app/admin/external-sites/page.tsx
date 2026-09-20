"use client";

import { useEffect, useState } from "react";

type CategoryOption = { id: string; name: string; slug: string };
type AttributeOption = {
  id: string;
  name: string;
  values: { id: string; value: string }[];
  group: { name: string } | null;
};

type CategoryParam = {
  id: string;
  param: string;
  isDefault: boolean;
  category: { id: string; name: string; slug: string };
};

type AttributeParam = {
  id: string;
  value: string | null;
  paramTemplate: string;
  sharedKey: string | null;
  isDefault: boolean;
  attribute: { id: string; name: string };
};

type ExternalSite = {
  id: string;
  name: string;
  slug: string;
  baseUrl: string;
  isActive: boolean;
  isReturnable: boolean;
  showOtherSellers: boolean;
  categoryParams: CategoryParam[];
  attributeParams: AttributeParam[];
};

export default function ExternalSitesAdminPage() {
  const [sites, setSites] = useState<ExternalSite[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [attributes, setAttributes] = useState<AttributeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newSite, setNewSite] = useState({ name: "", slug: "", baseUrl: "" });

  async function load() {
    setLoading(true);
    const [sitesRes, categoriesRes, attributesRes] = await Promise.all([
      fetch("/api/admin/external-sites"),
      fetch("/api/admin/categories"),
      fetch("/api/admin/attributes"),
    ]);
    setSites(await sitesRes.json());
    const categoriesData = await categoriesRes.json();
    setCategories(
      (Array.isArray(categoriesData) ? categoriesData : []).map((c: CategoryOption) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
      }))
    );
    setAttributes(await attributesRes.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreateSite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/external-sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSite),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "خطا در ساخت سایت");
      return;
    }
    setNewSite({ name: "", slug: "", baseUrl: "" });
    load();
  }

  async function handleDeleteSite(id: string) {
    if (!confirm("این سایت و همه‌ی نگاشت‌هاش حذف بشه؟")) return;
    await fetch(`/api/admin/external-sites/${id}`, { method: "DELETE" });
    load();
  }

  async function handleUpdateSite(
    id: string,
    patch: Partial<Pick<ExternalSite, "name" | "baseUrl" | "isActive" | "isReturnable" | "showOtherSellers">>
  ) {
    const res = await fetch(`/api/admin/external-sites/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "خطا در ذخیره‌سازی");
      return;
    }
    load();
  }

  if (loading) return <p className="text-sm text-[var(--color-muted)]">در حال بارگذاری...</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold mb-1">سایت‌های خارجی</h1>
        <p className="text-sm text-[var(--color-muted)] mb-6">
          هر سایتی که بشه محصولاتش رو مستقیم از HTML واکشی کرد. برای تغییر اسم، لینک پایه، یا مقدار
          و پیش‌فرض‌بودنِ هر پارامتر، اول دکمه‌ی «ویرایش» رو بزن، تغییرات رو بده، بعد «ذخیره».
        </p>

        <form onSubmit={handleCreateSite} className="grid sm:grid-cols-4 gap-2 mb-6">
          <input
            type="text"
            placeholder="نام (مثلاً ترندیول)"
            value={newSite.name}
            onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
            className="border cut-line rounded-lg px-3 py-2 text-sm"
            required
          />
          <input
            type="text"
            placeholder="شناسه (مثلاً trendyol)"
            value={newSite.slug}
            onChange={(e) => setNewSite({ ...newSite, slug: e.target.value })}
            dir="ltr"
            className="border cut-line rounded-lg px-3 py-2 text-sm"
            required
          />
          <input
            type="text"
            placeholder="https://www.trendyol.com/sr?"
            value={newSite.baseUrl}
            onChange={(e) => setNewSite({ ...newSite, baseUrl: e.target.value })}
            dir="ltr"
            className="border cut-line rounded-lg px-3 py-2 text-sm sm:col-span-2"
            required
          />
          <button
            type="submit"
            className="sm:col-span-4 bg-[var(--color-wine)] text-white rounded-lg py-2 text-sm font-bold w-fit px-6"
          >
            + سایت جدید
          </button>
        </form>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      </div>

      {sites.map((site) => (
        <SiteCard
          key={site.id}
          site={site}
          categories={categories}
          attributes={attributes}
          onDeleteSite={() => handleDeleteSite(site.id)}
          onUpdateSite={(patch) => handleUpdateSite(site.id, patch)}
          onChanged={load}
        />
      ))}
    </div>
  );
}

type CategoryDraft = { id: string; categoryId: string; categoryName: string; param: string; isDefault: boolean };
type AttributeDraft = {
  id: string;
  attributeId: string;
  attributeName: string;
  value: string | null;
  paramTemplate: string;
  sharedKey: string | null;
  isDefault: boolean;
};

// اگه هیچ ردیفی توی این گروه isDefault نداشته باشه، خودکار اولی رو پیش‌فرض می‌کنه
function ensureOneDefault<T extends { isDefault: boolean }>(rows: T[]): T[] {
  if (rows.length === 0) return rows;
  if (rows.some((r) => r.isDefault)) return rows;
  return rows.map((r, i) => ({ ...r, isDefault: i === 0 }));
}

type TrendyolCategoryResult = {
  id: string;
  param: string;
  nameTr: string;
  nameFa: string | null;
  path: string;
};

// جست‌وجوی دسته‌بندی‌های ترندیول از جدول محلی TrendyolCategoryCache (که با
// دکمه‌ی «به‌روزرسانی همه» توی صفحه‌ی /admin/trendyol-categories پر می‌شه) --
// این بار منبع درسته: منوی ناوبری واقعی خودِ سایت ترندیول، با کد wc= واقعی،
// نه اون API یکپارچه‌سازی محصول قبلی. برای همین کلیک روی هر نتیجه، دوباره
// می‌تونه مستقیم فیلد پارامتر رو پر کنه
function TrendyolCategoryPicker({
  onPick,
  autoFocus = false,
}: {
  onPick: (param: string, label: string) => void;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<TrendyolCategoryResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function search(q: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/external-sites/trendyol-categories?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "خطا در دریافت دسته‌بندی‌ها");
        setResults([]);
        return;
      }
      setResults(data.results ?? []);
    } catch {
      setError("خطا در ارتباط با سرور");
    } finally {
      setLoading(false);
    }
  }

  // جست‌وجو با یه وقفه‌ی کوتاه (debounce) تا با هر حرف تایپ‌شده درخواست نره
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, open]);

  return (
    <div className="relative">
      <div className="flex gap-1">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          autoFocus={autoFocus}
          placeholder="جست‌وجوی دسته‌بندی ترندیول (فارسی/ترکی)..."
          className="border cut-line rounded-lg px-2 py-1.5 text-sm w-56"
        />
        <a
          href="/admin/trendyol-categories"
          target="_blank"
          rel="noreferrer"
          title="مدیریت و به‌روزرسانی کامل لیست دسته‌بندی‌های ترندیول"
          className="text-xs border cut-line rounded-lg px-2 hover:border-[var(--color-wine)] flex items-center"
        >
          🔄
        </a>
      </div>
      {open && (
        <div className="absolute z-20 top-full right-0 mt-1 w-80 max-h-64 overflow-y-auto bg-white border cut-line rounded-lg shadow-lg text-xs">
          {loading && <p className="px-3 py-2 text-[var(--color-muted)]">در حال جست‌وجو...</p>}
          {error && <p className="px-3 py-2 text-red-600">{error}</p>}
          {!loading && !error && results.length === 0 && (
            <p className="px-3 py-2 text-[var(--color-muted)]">
              چیزی پیدا نشد. اگه هنوز sync نکردی، از دکمه‌ی 🔄 صفحه‌ی مدیریت رو باز کن.
            </p>
          )}
          {!loading &&
            !error &&
            results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  onPick(r.param, r.nameFa ?? r.nameTr);
                  setOpen(false);
                  setQuery(r.nameFa ?? r.nameTr);
                }}
                className="block w-full text-right px-3 py-1.5 hover:bg-[var(--color-linen-dim)] border-b cut-line last:border-b-0"
              >
                <span className="block">
                  {r.nameFa ?? <span className="text-amber-600">⚠️ بدون ترجمه — {r.nameTr}</span>}
                </span>
                <span className="block text-[10px] text-[var(--color-muted)] truncate">{r.path}</span>
                <span className="text-[var(--color-muted)]" dir="ltr">
                  {r.param}
                </span>
              </button>
            ))}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="block w-full text-center px-3 py-1.5 text-[var(--color-muted)] hover:bg-[var(--color-linen-dim)]"
          >
            بستن
          </button>
        </div>
      )}
    </div>
  );
}

function SiteCard({
  site,
  categories,
  attributes,
  onDeleteSite,
  onUpdateSite,
  onChanged,
}: {
  site: ExternalSite;
  categories: CategoryOption[];
  attributes: AttributeOption[];
  onDeleteSite: () => void;
  onUpdateSite: (patch: Partial<Pick<ExternalSite, "name" | "baseUrl" | "isActive" | "isReturnable" | "showOtherSellers">>) => void;
  onChanged: () => void;
}) {
  const [isEditingSite, setIsEditingSite] = useState(false);
  const [nameDraft, setNameDraft] = useState(site.name);
  const [baseUrlDraft, setBaseUrlDraft] = useState(site.baseUrl);
  const [categoryDrafts, setCategoryDrafts] = useState<CategoryDraft[]>([]);
  const [attributeDrafts, setAttributeDrafts] = useState<AttributeDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [busyError, setBusyError] = useState("");

  const [categoryForm, setCategoryForm] = useState({ categoryId: "", param: "" });
  const [openPickerFor, setOpenPickerFor] = useState<string | null>(null);
  const [attrForm, setAttrForm] = useState({ attributeId: "", value: "", paramTemplate: "", sharedKey: "" });
  const selectedAttribute = attributes.find((a) => a.id === attrForm.attributeId);
  // «رنگ» و همه‌ی زیرمجموعه‌های سرگروهِ «سایز» رو این‌جا نگاشت نمی‌کنیم -- این
  // دوتا اصلاً از این مکانیزم (ExternalSiteAttributeParam) رد نمی‌شن؛ رنگ و
  // سایز (دقیقاً مثل برند/دسته‌بندی) به‌صورت زنده از فیلترهای واقعیِ خودِ سایتِ
  // خارجی (TrendyolFilterCache، همون «ترجمه‌ی فیلترهای سایت‌های خارجی») میان --
  // برای هر دو سایت (ترندیول و میلا). فقط «جنسیت» واقعاً از این مکانیزم استفاده
  // می‌کنه (چون جنسیت روی ترندیول یه فیلترِ زنده‌ی مجزا نیست). نگاشتِ اینجا
  // برای رنگ/سایز هیچ اثری روی فیلترِ واقعیِ مشتری نداره -- فقط گیج‌کننده‌ست
  const assignableAttributes = attributes.filter((a) => a.name !== "رنگ" && a.group?.name !== "سایز");

  function startEdit() {
    setNameDraft(site.name);
    setBaseUrlDraft(site.baseUrl);
    setCategoryDrafts(
      site.categoryParams.map((cp) => ({
        id: cp.id,
        categoryId: cp.category.id,
        categoryName: cp.category.name,
        param: cp.param,
        isDefault: Boolean(cp.isDefault),
      }))
    );
    setAttributeDrafts(
      site.attributeParams.map((ap) => ({
        id: ap.id,
        attributeId: ap.attribute.id,
        attributeName: ap.attribute.name,
        value: ap.value,
        paramTemplate: ap.paramTemplate,
        sharedKey: ap.sharedKey,
        isDefault: Boolean(ap.isDefault),
      }))
    );
    setBusyError("");
    setIsEditingSite(true);
  }

  function setCategoryDefault(paramId: string) {
    setCategoryDrafts((prev) => prev.map((c) => ({ ...c, isDefault: c.id === paramId })));
  }

  function setAttributeDefault(attributeId: string, paramId: string) {
    setAttributeDrafts((prev) =>
      prev.map((a) => (a.attributeId === attributeId ? { ...a, isDefault: a.id === paramId } : a))
    );
  }

  function updateCategoryDraftParam(paramId: string, value: string) {
    setCategoryDrafts((prev) => prev.map((c) => (c.id === paramId ? { ...c, param: value } : c)));
  }

  function updateAttributeDraftTemplate(paramId: string, value: string) {
    setAttributeDrafts((prev) => prev.map((a) => (a.id === paramId ? { ...a, paramTemplate: value } : a)));
  }

  function updateAttributeDraftSharedKey(paramId: string, value: string) {
    setAttributeDrafts((prev) =>
      prev.map((a) => (a.id === paramId ? { ...a, sharedKey: value || null } : a))
    );
  }

  async function saveAll() {
    setSaving(true);
    setBusyError("");

    // تضمین اینکه از هر گروه (خودِ لیست دسته‌بندی، و هر ویژگی جدا) یکی پیش‌فرضه --
    // اگه ادمین هیچی تیک نزده بود، خودمون اولی رو انتخاب می‌کنیم
    const fixedCategoryDrafts = ensureOneDefault(categoryDrafts);
    const attributeGroups = new Map<string, AttributeDraft[]>();
    for (const a of attributeDrafts) {
      if (a.value === null) continue; // قالب عمومی نمی‌تونه پیش‌فرض باشه، از گروه‌بندی کنار می‌مونه
      const list = attributeGroups.get(a.attributeId) ?? [];
      list.push(a);
      attributeGroups.set(a.attributeId, list);
    }
    const fixedIds = new Map<string, boolean>();
    for (const [, group] of attributeGroups) {
      for (const row of ensureOneDefault(group)) {
        fixedIds.set(row.id, row.isDefault);
      }
    }
    const fixedAttributeDrafts = attributeDrafts.map((a) =>
      a.value === null ? a : { ...a, isDefault: fixedIds.get(a.id) ?? false }
    );

    try {
      // اسم/لینک پایه‌ی سایت
      if (nameDraft.trim() !== site.name || baseUrlDraft.trim() !== site.baseUrl) {
        onUpdateSite({ name: nameDraft.trim(), baseUrl: baseUrlDraft.trim() });
      }

      // پارامترهای دسته‌بندی
      for (const c of fixedCategoryDrafts) {
        await fetch(`/api/admin/external-sites/${site.id}/category-params`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryId: c.categoryId, param: c.param }),
        });
        await fetch(`/api/admin/external-sites/${site.id}/category-params/${c.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isDefault: c.isDefault }),
        });
      }

      // پارامترهای ویژگی
      for (const a of fixedAttributeDrafts) {
        await fetch(`/api/admin/external-sites/${site.id}/attribute-params`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attributeId: a.attributeId,
            value: a.value,
            paramTemplate: a.paramTemplate,
            sharedKey: a.sharedKey,
          }),
        });
        if (a.value !== null) {
          await fetch(`/api/admin/external-sites/${site.id}/attribute-params/${a.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isDefault: a.isDefault }),
          });
        }
      }

      setIsEditingSite(false);
      onChanged();
    } catch {
      setBusyError("خطا در ذخیره‌سازی -- دوباره امتحان کن");
    } finally {
      setSaving(false);
    }
  }

  async function addCategoryParam(e: React.FormEvent) {
    e.preventDefault();
    setBusyError("");
    const res = await fetch(`/api/admin/external-sites/${site.id}/category-params`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(categoryForm),
    });
    const data = await res.json();
    if (!res.ok) {
      setBusyError(data.error ?? "خطا");
      return;
    }
    setCategoryForm({ categoryId: "", param: "" });
    onChanged();
  }

  async function deleteCategoryParam(paramId: string) {
    await fetch(`/api/admin/external-sites/${site.id}/category-params/${paramId}`, { method: "DELETE" });
    setCategoryDrafts((prev) => prev.filter((c) => c.id !== paramId));
    onChanged();
  }

  async function addAttributeParam(e: React.FormEvent) {
    e.preventDefault();
    setBusyError("");
    const res = await fetch(`/api/admin/external-sites/${site.id}/attribute-params`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attributeId: attrForm.attributeId,
        value: attrForm.value || null,
        paramTemplate: attrForm.paramTemplate,
        sharedKey: attrForm.sharedKey || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBusyError(data.error ?? "خطا");
      return;
    }
    setAttrForm({ attributeId: "", value: "", paramTemplate: "", sharedKey: "" });
    onChanged();
  }

  async function deleteAttributeParam(paramId: string) {
    await fetch(`/api/admin/external-sites/${site.id}/attribute-params/${paramId}`, { method: "DELETE" });
    setAttributeDrafts((prev) => prev.filter((a) => a.id !== paramId));
    onChanged();
  }

  // برای نمایش گروه‌بندی‌شده‌ی ویژگی‌ها (چه توی حالت ویرایش چه نمایش عادی)
  const attributeGroupsForDisplay = new Map<string, { attributeName: string; rows: AttributeParam[] }>();
  for (const ap of site.attributeParams) {
    const key = ap.attribute.id;
    if (!attributeGroupsForDisplay.has(key)) {
      attributeGroupsForDisplay.set(key, { attributeName: ap.attribute.name, rows: [] });
    }
    attributeGroupsForDisplay.get(key)!.rows.push(ap);
  }

  return (
    <div className="border cut-line rounded-xl p-4 space-y-5">
      {isEditingSite ? (
        <div className="space-y-2">
          <input
            type="text"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            placeholder="نام سایت"
            className="w-full border cut-line rounded-lg px-3 py-2 text-sm font-bold"
          />
          <input
            type="text"
            value={baseUrlDraft}
            onChange={(e) => setBaseUrlDraft(e.target.value)}
            dir="ltr"
            placeholder="https://www.trendyol.com/sr?"
            className="w-full border cut-line rounded-lg px-3 py-2 text-xs"
          />
        </div>
      ) : (
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex-1 min-w-[240px] space-y-1">
            <div className="flex items-center gap-2">
              <p className="font-bold">{site.name}</p>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                  site.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-500"
                }`}
              >
                {site.isActive ? "فعال" : "غیرفعال"}
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                  site.isReturnable ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
                }`}
                title="فقط وقتی از تنظیمات، «محصولات غیرقابل‌بازگشت» روشن باشه اعمال می‌شه"
              >
                {site.isReturnable ? "قابل مرجوع" : "غیرقابل مرجوع"}
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                  site.showOtherSellers ? "bg-purple-100 text-purple-700" : "bg-gray-200 text-gray-500"
                }`}
                title="مقایسه‌ی فروشنده‌ی فعلی با فروشنده‌های دیگرِ همین محصول، روی صفحه‌ی محصولِ این سایت"
              >
                {site.showOtherSellers ? "فروشنده‌های دیگر: روشن" : "فروشنده‌های دیگر: خاموش"}
              </span>
            </div>
            <p className="text-xs text-[var(--color-muted)]" dir="ltr">
              {site.slug} — {site.baseUrl}
            </p>
          </div>
        </div>
      )}

      {busyError && <p className="text-xs text-red-600">{busyError}</p>}

      {/* پارامتر دسته‌بندی‌ها */}
      <div>
        <p className="text-sm font-bold mb-2">پارامتر دسته‌بندی‌ها</p>
        <div className="space-y-1 mb-2">
          {isEditingSite
            ? categoryDrafts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 text-sm bg-[var(--color-linen-dim)] rounded-lg px-3 py-1.5 flex-wrap"
                >
                  <span className="shrink-0">{c.categoryName}</span>
                  <input
                    type="text"
                    value={c.param}
                    onChange={(e) => updateCategoryDraftParam(c.id, e.target.value)}
                    dir="ltr"
                    className={`font-mono text-xs border cut-line rounded-lg px-2 py-1 bg-white flex-1 ${
                      c.param === "wc=0" ? "border-amber-400 text-amber-700" : ""
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setOpenPickerFor((cur) => (cur === c.id ? null : c.id))}
                    title="جست‌وجو توی دسته‌بندی‌های زنده‌ی ترندیول"
                    className="text-xs border cut-line rounded-lg px-2 hover:border-[var(--color-wine)] shrink-0"
                  >
                    🔍
                  </button>
                  {openPickerFor === c.id && (
                    <div className="w-full">
                      <TrendyolCategoryPicker
                        autoFocus
                        onPick={(param) => {
                          updateCategoryDraftParam(c.id, param);
                          setOpenPickerFor(null);
                        }}
                      />
                    </div>
                  )}
                  <label className="flex items-center gap-1 text-[11px] shrink-0 cursor-pointer">
                    <input
                      type="radio"
                      name="categoryDefault"
                      checked={c.isDefault}
                      onChange={() => setCategoryDefault(c.id)}
                    />
                    صفحه‌ی اول
                  </label>
                  <button
                    onClick={() => deleteCategoryParam(c.id)}
                    className="text-red-600 text-xs hover:underline shrink-0"
                  >
                    حذف
                  </button>
                </div>
              ))
            : site.categoryParams.map((cp) => (
                <div
                  key={cp.id}
                  className="flex items-center justify-between gap-2 text-sm bg-[var(--color-linen-dim)] rounded-lg px-3 py-1.5"
                >
                  <span>{cp.category.name}</span>
                  <span className="font-mono text-xs" dir="ltr">
                    {cp.param}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                      cp.isDefault
                        ? "bg-orange-100 text-orange-700"
                        : "bg-transparent text-[var(--color-muted)] border cut-line"
                    }`}
                  >
                    {cp.isDefault ? "⭐ صفحه‌ی اول" : "صفحه‌ی اول نیست"}
                  </span>
                </div>
              ))}
          {site.categoryParams.length === 0 && (
            <p className="text-xs text-[var(--color-muted)]">هنوز هیچ دسته‌بندی‌ای نگاشت نشده.</p>
          )}
        </div>
        {isEditingSite && (
          <form onSubmit={addCategoryParam} className="flex flex-wrap gap-2 items-start">
            <select
              value={categoryForm.categoryId}
              onChange={(e) => setCategoryForm({ ...categoryForm, categoryId: e.target.value })}
              className="border cut-line rounded-lg px-2 py-1.5 text-sm flex-1"
              required
            >
              <option value="">دسته‌بندی را انتخاب کنید</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {/* سرچ روی ترجمه‌های فارسی -- کد wc= واقعی رو مستقیم توی فیلد پارامتر
                پر می‌کنه (منبع درسته: منوی ناوبری خودِ سایت، نه API اشتباه قبلی) */}
            <TrendyolCategoryPicker onPick={(param) => setCategoryForm((f) => ({ ...f, param }))} />
            <input
              type="text"
              placeholder="wc=82"
              value={categoryForm.param}
              onChange={(e) => setCategoryForm({ ...categoryForm, param: e.target.value })}
              dir="ltr"
              className="border cut-line rounded-lg px-2 py-1.5 text-sm w-32"
              required
            />
            <button type="submit" className="text-xs border cut-line rounded-lg px-3 hover:border-[var(--color-wine)]">
              افزودن
            </button>
          </form>
        )}
      </div>

      {/* پارامتر ویژگی‌ها */}
      <div>
        <p className="text-sm font-bold mb-2">پارامتر ویژگی‌ها</p>
        <div className="space-y-3 mb-2">
          {Array.from(attributeGroupsForDisplay.entries()).map(([attributeId, group]) => (
            <div key={attributeId}>
              <p className="text-xs font-bold text-[var(--color-muted)] mb-1">{group.attributeName}</p>
              <div className="space-y-1">
                {isEditingSite
                  ? attributeDrafts
                      .filter((a) => a.attributeId === attributeId)
                      .map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between gap-2 text-sm bg-[var(--color-linen-dim)] rounded-lg px-3 py-1.5"
                        >
                          <span className="shrink-0">{a.value ? a.value : "(قالب عمومی)"}</span>
                          <input
                            type="text"
                            value={a.sharedKey ?? ""}
                            onChange={(e) => updateAttributeDraftSharedKey(a.id, e.target.value)}
                            dir="ltr"
                            placeholder="کلید مشترک (اختیاری، مثل vr=size|)"
                            className="font-mono text-xs border cut-line rounded-lg px-2 py-1 bg-white w-40 shrink-0"
                          />
                          <input
                            type="text"
                            value={a.paramTemplate}
                            onChange={(e) => updateAttributeDraftTemplate(a.id, e.target.value)}
                            dir="ltr"
                            className="font-mono text-xs border cut-line rounded-lg px-2 py-1 bg-white flex-1"
                          />
                          {a.value !== null && (
                            <label className="flex items-center gap-1 text-[11px] shrink-0 cursor-pointer">
                              <input
                                type="radio"
                                name={`attrDefault-${attributeId}`}
                                checked={a.isDefault}
                                onChange={() => setAttributeDefault(attributeId, a.id)}
                              />
                              صفحه‌ی اول
                            </label>
                          )}
                          <button
                            onClick={() => deleteAttributeParam(a.id)}
                            className="text-red-600 text-xs hover:underline shrink-0"
                          >
                            حذف
                          </button>
                        </div>
                      ))
                  : group.rows.map((ap) => (
                      <div
                        key={ap.id}
                        className="flex items-center justify-between gap-2 text-sm bg-[var(--color-linen-dim)] rounded-lg px-3 py-1.5"
                      >
                        <span>{ap.value ? ap.value : "(قالب عمومی)"}</span>
                        {ap.sharedKey && (
                          <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded shrink-0" dir="ltr">
                            {ap.sharedKey}
                          </span>
                        )}
                        <span className="font-mono text-xs" dir="ltr">
                          {ap.paramTemplate}
                        </span>
                        {ap.value !== null && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                              ap.isDefault
                                ? "bg-orange-100 text-orange-700"
                                : "bg-transparent text-[var(--color-muted)] border cut-line"
                            }`}
                          >
                            {ap.isDefault ? "⭐ صفحه‌ی اول" : "صفحه‌ی اول نیست"}
                          </span>
                        )}
                      </div>
                    ))}
              </div>
            </div>
          ))}
          {site.attributeParams.length === 0 && (
            <p className="text-xs text-[var(--color-muted)]">هنوز هیچ ویژگی‌ای نگاشت نشده.</p>
          )}
        </div>
        {isEditingSite && (
          <>
            <form onSubmit={addAttributeParam} className="flex flex-wrap gap-2">
              <select
                value={attrForm.attributeId}
                onChange={(e) => setAttrForm({ ...attrForm, attributeId: e.target.value, value: "" })}
                className="border cut-line rounded-lg px-2 py-1.5 text-sm"
                required
              >
                <option value="">ویژگی را انتخاب کنید</option>
                {assignableAttributes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <select
                value={attrForm.value}
                onChange={(e) => setAttrForm({ ...attrForm, value: e.target.value })}
                className="border cut-line rounded-lg px-2 py-1.5 text-sm"
                disabled={!selectedAttribute}
              >
                <option value="">قالب عمومی (برای همه‌ی مقادیر، مثل سایز)</option>
                {selectedAttribute?.values.map((v) => (
                  <option key={v.id} value={v.value}>
                    فقط برای «{v.value}»
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="کلید مشترک (اختیاری، مثل vr=size|)"
                value={attrForm.sharedKey}
                onChange={(e) => setAttrForm({ ...attrForm, sharedKey: e.target.value })}
                dir="ltr"
                className="border cut-line rounded-lg px-2 py-1.5 text-sm w-44"
              />
              <input
                type="text"
                placeholder={attrForm.sharedKey ? "group-{value}" : attrForm.value ? "wg=2" : "vr=size|group-{value}"}
                value={attrForm.paramTemplate}
                onChange={(e) => setAttrForm({ ...attrForm, paramTemplate: e.target.value })}
                dir="ltr"
                className="border cut-line rounded-lg px-2 py-1.5 text-sm w-48"
                required
              />
              <button type="submit" className="text-xs border cut-line rounded-lg px-3 hover:border-[var(--color-wine)]">
                افزودن
              </button>
            </form>
            <p className="text-[11px] text-[var(--color-muted)] mt-1">
              اگه «قالب عمومی» انتخاب کنی، توی پارامتر از <code dir="ltr">{"{value}"}</code> استفاده کن تا با
              مقدار واقعی (کوچک‌شده) جایگزین بشه. قالب عمومی نمی‌تونه «صفحه‌ی اول» باشه.
              <br />
              اگه چندتا ویژگی (مثلاً چندتا نوع سایز) باید زیر یه پارامتر مشترک ترکیب بشن، برای همه‌شون
              یه «کلید مشترک» یکسان بذار (مثلاً <code dir="ltr">vr=size|</code>) -- مقدار پارامتر هرکدوم
              فقط بخش تبدیل مقداره (مثلاً <code dir="ltr">group-{"{value}"}</code>).
              <br />
              «رنگ» و «سایز» این‌جا نیستن چون از فیلترِ زنده‌ی خودِ سایت (نه این نگاشتِ دستی) میان -- برای
              ترجمه/مدیریتِ مقادیرشون به «ترجمه‌ی فیلترهای سایت‌های خارجی» برو.
        </p>
          </>
        )}
      </div>

      {/* دکمه‌های پایین کارت */}
      <div className="flex gap-2 pt-2 border-t cut-line">
        {isEditingSite ? (
          <>
            <button
              onClick={saveAll}
              disabled={saving}
              className="bg-[var(--color-wine)] text-white rounded-lg px-4 py-1.5 text-xs font-bold disabled:opacity-50"
            >
              {saving ? "در حال ذخیره..." : "ذخیره"}
            </button>
            <button
              onClick={() => setIsEditingSite(false)}
              disabled={saving}
              className="border cut-line rounded-lg px-4 py-1.5 text-xs"
            >
              انصراف
            </button>
          </>
        ) : (
          <>
            <button
              onClick={startEdit}
              className="text-xs border cut-line rounded-full px-3 py-1 hover:border-[var(--color-wine)]"
            >
              ویرایش
            </button>
            <button
              onClick={() => onUpdateSite({ isActive: !site.isActive })}
              className="text-xs border cut-line rounded-full px-3 py-1 hover:border-[var(--color-wine)]"
            >
              {site.isActive ? "غیرفعال کن" : "فعال کن"}
            </button>
            <button
              onClick={() => onUpdateSite({ isReturnable: !site.isReturnable })}
              className="text-xs border cut-line rounded-full px-3 py-1 hover:border-[var(--color-wine)]"
            >
              {site.isReturnable ? "غیرقابل مرجوع کن" : "قابل مرجوع کن"}
            </button>
            <button
              onClick={() => onUpdateSite({ showOtherSellers: !site.showOtherSellers })}
              className="text-xs border cut-line rounded-full px-3 py-1 hover:border-[var(--color-wine)]"
            >
              {site.showOtherSellers ? "فروشنده‌های دیگر رو خاموش کن" : "فروشنده‌های دیگر رو روشن کن"}
            </button>
            <button onClick={onDeleteSite} className="text-xs text-red-600 hover:underline">
              حذف سایت
            </button>
          </>
        )}
      </div>
    </div>
  );
}
