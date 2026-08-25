"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// دو نوع «رشته‌ی خالصِ حرفی» که ممکنه توی متنِ ویژگی‌ها ظاهر شه:
//  - لاتین/ترکی: احتمالاً ترجمه نشده (translateTrendyolAttributeText کلماتِ
//    ناشناخته رو با املای اصلی عیناً برمی‌گردونه)
//  - فارسی: یعنی از دیکشنری ترجمه شده -- قابل ویرایش/حذف
// اعداد/علامت‌ها بینِ این دو نوع، بدون تغییر نمایش داده می‌شن (نه بخشی از
// هیچ‌کدوم) -- مثلاً «%۶۰Polyester,%۴۰Pamuk» باید Polyester و Pamuk رو جدا
// به‌عنوان کلمه تشخیص بده، نه کل رشته رو یک توکن حساب کنه
const LATIN_RUN = "[A-Za-zÇŞĞİÖÜçşğıöü]+";
const PERSIAN_RUN = "[\\u0600-\\u06FF\\u200C]+";
const WORD_RUN_REGEX = new RegExp(`(${LATIN_RUN}|${PERSIAN_RUN})`, "g");

function isLatinWord(s: string): boolean {
  return new RegExp(`^${LATIN_RUN}$`).test(s);
}

// یک دنباله‌ی متوالیِ کلماتِ لاتین/ترکیِ ناشناخته رو یکجا نشون می‌ده -- به‌جای
// این‌که ادمین مجبور باشه کلمه‌به‌کلمه کلیک کند و هرکدوم رو جدا ترجمه کند، کل
// عبارت با یک کلیک/یک ورودی/یک ذخیره، به‌عنوان یک ردیفِ دیکشنریِ چندکلمه‌ای
// ثبت می‌شود -- tokenizeAndTranslate از قبل عبارت‌های چندکلمه‌ای رو با
// اولویتِ بالاتر از تک‌کلمه‌ای‌ها چک می‌کند، پس نیازی به تغییر دیگری نیست
function TranslatableRun({ displayText, coreWords }: { displayText: string; coreWords: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const isPhrase = coreWords.length > 1;
  const termTr = coreWords.join(" ");

  if (saved) {
    return <span className="text-emerald-700">✓</span>;
  }

  async function save() {
    if (!value.trim()) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/trendyol-title-dictionary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ termTr, termFa: value.trim() }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("ذخیره نشد");
      return;
    }
    setSaved(true);
    setOpen(false);
    router.refresh();
  }

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="border-b border-dashed border-[var(--color-wine)] text-[var(--color-wine)] hover:bg-[var(--color-wine)]/10"
        title={
          isPhrase
            ? `کلیک کن تا ترجمه‌ی فارسیِ یکجای «${termTr}» رو به دیکشنری اضافه کنی`
            : "کلیک کن تا ترجمه‌ی فارسی این کلمه رو به دیکشنری اضافه کنی"
        }
      >
        {displayText}
      </button>
      {open && (
        <span
          className="absolute z-20 top-full right-0 mt-1 flex items-center gap-1 bg-white border cut-line rounded-lg p-1.5 shadow-lg whitespace-nowrap"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder={isPhrase ? "ترجمه‌ی فارسیِ همه‌ی این عبارت" : "ترجمه‌ی فارسی"}
            className="border cut-line rounded px-2 py-1 text-xs w-28"
          />
          <button
            type="button"
            onClick={save}
            disabled={saving || !value.trim()}
            className="bg-[var(--color-wine)] text-white rounded px-2 py-1 text-xs disabled:opacity-50"
          >
            {saving ? "..." : "ذخیره"}
          </button>
          {error && <span className="text-[10px] text-red-600">{error}</span>}
        </span>
      )}
    </span>
  );
}

type DictRow = { id: string; termTr: string; termFa: string };

// یک عبارتِ فارسیِ از قبل ترجمه‌شده -- کلیک روش دیکشنری رو با همین متن جست‌وجو
// می‌کند (endpoint موجودِ GET که هم termTr هم termFa رو می‌گردد) و اگه ردیفی
// پیدا شد، همون‌جا قابل ویرایش (PATCH) یا حذف (DELETE) است -- بدون رفتن به
// صفحه‌ی جدا، دقیقاً هم‌ارزِ TranslatableRun ولی برای اصلاح/حذفِ ترجمه‌ی موجود
function EditableTranslationRun({ text }: { text: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [matches, setMatches] = useState<DictRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen((v) => !v);
    if (matches === null) {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/trendyol-title-dictionary?q=${encodeURIComponent(text)}&limit=8`);
        const data = await res.json();
        const results: DictRow[] = Array.isArray(data.results) ? data.results : [];
        setMatches(results.filter((r) => r.termFa === text || text.includes(r.termFa) || r.termFa.includes(text)));
      } catch {
        setMatches([]);
      }
      setLoading(false);
    }
  }

  async function saveEdit(id: string) {
    if (!editValue.trim()) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/admin/trendyol-title-dictionary/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ termFa: editValue.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("ذخیره نشد");
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/admin/trendyol-title-dictionary/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError("حذف نشد");
      return;
    }
    setRemovedIds((prev) => new Set(prev).add(id));
    router.refresh();
  }

  const visibleMatches = matches?.filter((m) => !removedIds.has(m.id)) ?? null;

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={toggle}
        className="border-b border-dotted border-[var(--color-muted)] hover:border-[var(--color-wine)] hover:text-[var(--color-wine)]"
        title="کلیک کن تا ترجمه‌ی این کلمه رو ویرایش یا حذف کنی"
      >
        {text}
      </button>
      {open && (
        <span
          className="absolute z-20 top-full right-0 mt-1 flex flex-col gap-1.5 bg-white border cut-line rounded-lg p-2 shadow-lg whitespace-nowrap min-w-[190px]"
          onClick={(e) => e.stopPropagation()}
        >
          {loading && <span className="text-[11px] text-[var(--color-muted)]">در حال جستجو...</span>}
          {!loading && visibleMatches?.length === 0 && (
            <span className="text-[11px] text-[var(--color-muted)]">
              این کلمه از دیکشنری نیامده (احتمالاً بخشی از متنِ ثابت است)
            </span>
          )}
          {visibleMatches?.map((m) => (
            <span key={m.id} className="flex items-center gap-1.5">
              {editingId === m.id ? (
                <>
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(m.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="border cut-line rounded px-1.5 py-0.5 text-xs w-20"
                  />
                  <button
                    type="button"
                    onClick={() => saveEdit(m.id)}
                    disabled={busy}
                    className="text-xs bg-[var(--color-wine)] text-white rounded px-1.5 py-0.5 disabled:opacity-50"
                  >
                    ✓
                  </button>
                </>
              ) : (
                <>
                  <span className="text-[11px] text-[var(--color-muted)]" dir="ltr">
                    {m.termTr}
                  </span>
                  <span className="text-[11px] text-[var(--color-muted)]">←</span>
                  <span className="text-[11px] font-medium">{m.termFa}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(m.id);
                      setEditValue(m.termFa);
                    }}
                    title="ویرایش"
                    className="text-[10px] text-[var(--color-muted)] hover:text-[var(--color-wine)]"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(m.id)}
                    disabled={busy}
                    title="حذف از دیکشنری"
                    className="text-[10px] text-red-600 hover:underline disabled:opacity-50"
                  >
                    حذف
                  </button>
                </>
              )}
            </span>
          ))}
          {error && <span className="text-[10px] text-red-600">{error}</span>}
        </span>
      )}
    </span>
  );
}

// عمداً به‌جای این‌که یه رشته‌ی خام رو مستقیم چاپ کند، دنبالِ رشته‌های خالصِ
// حرفی می‌گردد (نه فقط توکن‌های جداشده با فاصله) -- بخش‌های عدد/علامت عادی
// نمایش داده می‌شن. دنباله‌های متوالیِ کلمه‌ی لاتین/ترکیِ ناشناخته یکجا برای
// افزودنِ ترجمه‌ی جدید کلیک‌پذیرند؛ دنباله‌های متوالیِ کلمه‌ی فارسی (یعنی از
// قبل ترجمه شده) یکجا برای ویرایش/حذفِ همون ترجمه کلیک‌پذیرند -- هردو بدون
// رفتن به صفحه‌ی جدا
export function AdminClickToTranslate({ text, isAdmin }: { text: string; isAdmin: boolean }) {
  if (!isAdmin) return <>{text}</>;

  // split با یه گروهِ capturing، پشتِ‌سرهم [غیرحرفی, حرفی, غیرحرفی, حرفی, ...]
  // برمی‌گردونه -- ایندکسِ فرد همیشه یه رشته‌ی خالصِ حرفی (لاتین یا فارسی) است
  const pieces = text.split(WORD_RUN_REGEX);

  const nodes: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < pieces.length) {
    const piece = pieces[i];
    const isWordPiece = i % 2 === 1;
    if (!isWordPiece || !piece || piece.length < 2) {
      if (piece) nodes.push(<span key={key++}>{piece}</span>);
      i++;
      continue;
    }

    const pieceIsLatin = isLatinWord(piece);

    // جمع‌کردن دنباله‌ی متوالیِ کلماتِ هم‌نوع (فقط وقتی قطعه‌ی غیرحرفیِ بینشون
    // صرفاً فاصله‌ی خالی باشه، نه عدد/علامت -- یعنی دو مقدارِ چسبیده‌به‌هم مثل
    // «Polyester,%40Pamuk» جدا حساب می‌شن، نه یکی)
    const runWords: string[] = [piece];
    const runDisplayParts: string[] = [piece];
    let j = i + 2;
    while (
      j + 1 < pieces.length &&
      j % 2 === 0 &&
      /^\s+$/.test(pieces[j]) &&
      pieces[j + 1]?.length >= 2 &&
      isLatinWord(pieces[j + 1]) === pieceIsLatin
    ) {
      runDisplayParts.push(pieces[j], pieces[j + 1]);
      runWords.push(pieces[j + 1]);
      j += 2;
    }
    const displayText = runDisplayParts.join("");
    nodes.push(
      pieceIsLatin ? (
        <TranslatableRun key={key++} displayText={displayText} coreWords={runWords} />
      ) : (
        <EditableTranslationRun key={key++} text={displayText} />
      )
    );
    i = j;
  }

  return <>{nodes}</>;
}
