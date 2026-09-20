"use client";

import { useEffect, useState } from "react";

type FormulaRow = {
  id: string;
  patternTr: string;
  templateFa: string;
  priority: number;
};

export default function AdminTrendyolCampaignFormulasPage() {
  const [rows, setRows] = useState<FormulaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newPatternTr, setNewPatternTr] = useState("");
  const [newTemplateFa, setNewTemplateFa] = useState("");
  const [newPriority, setNewPriority] = useState(0);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  function load() {
    setLoading(true);
    fetch("/api/admin/trendyol-campaign-formulas")
      .then((res) => (res.ok ? res.json() : { results: [] }))
      .then((data) => setRows(data.results ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError("");
    setAdding(true);
    const res = await fetch("/api/admin/trendyol-campaign-formulas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patternTr: newPatternTr, templateFa: newTemplateFa, priority: newPriority }),
    });
    const data = await res.json();
    setAdding(false);
    if (!res.ok) {
      setAddError(data.error ?? "خطا در ذخیره‌سازی");
      return;
    }
    setNewPatternTr("");
    setNewTemplateFa("");
    setNewPriority(0);
    load();
  }

  async function saveField(id: string, field: "templateFa" | "priority" | "patternTr", value: string | number) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    await fetch(`/api/admin/trendyol-campaign-formulas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
  }

  async function removeRow(id: string) {
    if (!confirm("این الگو حذف بشه؟")) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/admin/trendyol-campaign-formulas/${id}`, { method: "DELETE" });
  }

  if (loading) return <p className="text-sm text-[var(--color-muted)]">در حال بارگذاری...</p>;

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold mb-2">فرمول‌های اسمِ کمپینِ سایت‌های خارجی</h1>
        <p className="text-sm text-[var(--color-muted)] mb-4 leading-relaxed">
          بعضی اسم‌کمپین‌های ترندیول (مثلِ «2 Ürün %30 İndirim» یا «Sepette %30 İndirim») شاملِ عدد/درصدن و
          دیکشنریِ کلمه‌به‌کلمه‌ی معمولی براشون مناسب نیست. اینجا می‌تونی برای این جور الگوها، یه ترجمه‌ی دقیق
          تعریف کنی: توی الگوی ترکی، هرجا عددِ دلخواه میاد رو با <span dir="ltr">{"{1}"}</span>،{" "}
          <span dir="ltr">{"{2}"}</span> و... مشخص کن، و توی قالبِ فارسی هم همون شماره‌ها رو دقیقاً همون‌جایی که
          می‌خوای عدد بشینه بذار.
        </p>
        <div className="border cut-line rounded-lg p-3 bg-[var(--color-linen-dim)]/40 text-xs mb-4" dir="ltr">
          <p>Pattern: {"{1} Ürün %{2} İndirim"}</p>
          <p dir="rtl">قالب: خرید {"{1}"}م ٪{"{2}"} تخفیف</p>
        </div>

        <form onSubmit={handleAdd} className="grid sm:grid-cols-2 gap-3">
          <input
            value={newPatternTr}
            onChange={(e) => setNewPatternTr(e.target.value)}
            placeholder="الگوی ترکی -- مثلاً {1} Ürün %{2} İndirim"
            dir="ltr"
            required
            className="border cut-line rounded-lg px-3 py-2 text-sm font-mono sm:col-span-2"
          />
          <input
            value={newTemplateFa}
            onChange={(e) => setNewTemplateFa(e.target.value)}
            placeholder="قالبِ فارسی -- مثلاً خرید {1}م ٪{2} تخفیف"
            required
            className="border cut-line rounded-lg px-3 py-2 text-sm sm:col-span-2"
          />
          <input
            type="number"
            value={newPriority}
            onChange={(e) => setNewPriority(Number(e.target.value))}
            placeholder="اولویت (اختیاری)"
            className="border cut-line rounded-lg px-3 py-2 text-sm"
          />
          {addError && <p className="text-sm text-red-600 sm:col-span-2">{addError}</p>}
          <button
            type="submit"
            disabled={adding}
            className="sm:col-span-2 bg-[var(--color-wine)] text-white py-2.5 rounded-full font-medium disabled:opacity-50"
          >
            {adding ? "در حال ذخیره..." : "افزودنِ الگو"}
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-lg font-bold mb-4">الگوهای ثبت‌شده ({rows.length})</h2>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">هنوز الگویی ثبت نشده.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="border cut-line rounded-lg p-3 bg-white text-sm space-y-2">
                <p dir="ltr" className="text-left font-mono text-xs text-[var(--color-muted)]">
                  {r.patternTr}
                </p>
                <div className="flex items-center gap-2">
                  <input
                    defaultValue={r.templateFa}
                    onBlur={(e) => {
                      if (e.target.value !== r.templateFa) saveField(r.id, "templateFa", e.target.value);
                    }}
                    className="flex-1 border cut-line rounded-lg px-3 py-1.5 text-sm"
                  />
                  <input
                    type="number"
                    defaultValue={r.priority}
                    onBlur={(e) => {
                      const value = Number(e.target.value);
                      if (value !== r.priority) saveField(r.id, "priority", value);
                    }}
                    className="w-20 border cut-line rounded-lg px-2 py-1.5 text-sm"
                  />
                  <button onClick={() => removeRow(r.id)} className="text-red-600 text-xs shrink-0">
                    حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
