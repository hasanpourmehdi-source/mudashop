"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { isWordSelected, subscribeComboSelection, toggleComboWord } from "@/lib/translationComboSelection";
import { getOpenPopoverId, setOpenPopover, subscribeOpenPopover } from "@/lib/adminPopoverState";

// وقتی پاپ‌آپ بازه، کلیک/لمس روی هرجای صفحه‌ی «بیرونِ» دکمه و خودِ پاپ‌آپ باید
// ببندتش -- چون پاپ‌آپ با پورتال به body می‌ره، «بیرون» رو با دو تا ref (دکمه +
// خودِ پاپ‌آپ) چک می‌کنیم، نه با فرزندِ DOMِ واقعی
function useClosePopoverOnOutsideClick(
  isOpen: boolean,
  close: () => void,
  refs: React.RefObject<HTMLElement | null>[]
) {
  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (refs.some((r) => r.current?.contains(target))) return;
      close();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, close]);
}

// پاپ‌آپِ زیرِ کلمه اگه داخلِ عنصری با overflow-hidden باشه (مثلاً h3ِ
// line-clamp-2ِ کارتِ گرید که خودِ line-clamp اجباراً overflow:hidden داره)
// کاملاً مخفی/بریده می‌شد -- چون position:absolute فقط از جریانِ عادی خارج
// می‌شه، نه از قطع‌شدنِ توسطِ overflowِ اجداد. برای همین موقعیتِ دکمه رو با
// getBoundingClientRect می‌گیریم و پاپ‌آپ رو با پورتال مستقیم به body (با
// position:fixed) می‌فرستیم -- این‌طوری نه هیچ overflowِ نیایی می‌تونه مخفیش
// کنه، نه (چون دیگه اصلاً داخلِ چیدمانِ کارت/گرید نیست) باعثِ جابه‌جاییِ عکس/
// بقیه‌ی محتوای کارت می‌شه (گزارشِ دیگری که همزمان با همین مشکل بود)
// عرضِ تقریبیِ پاپ‌آپ -- فقط برای کلمپ‌کردنِ موقعیت لازمه، نیازی به اندازه‌ی
// دقیق نیست (هر دو پاپ‌آپِ TranslatableRun/EditableTranslationRun تقریباً
// همین حدودن: min-w-[190px] یا عرضِ اینپوت+دکمه+padding)
const POPOVER_WIDTH_ESTIMATE = 220;
const POPOVER_EDGE_MARGIN = 8;

function usePopoverPosition(
  triggerRef: React.RefObject<HTMLElement | null>,
  open: boolean
): { top: number; right: number } | null {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPos(null);
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    // فقط بر اساسِ موقعیتِ خودِ کلمه حساب کردنِ right، توی صفحه‌های باریکِ
    // موبایل می‌تونست پاپ‌آپ رو کاملاً از لبه‌ی چپِ صفحه بیرون ببره (چون عرضِ
    // پاپ‌آپ از فاصله‌ی خالیِ سمتِ چپ بیشتر بود) -- مرورگرِ موبایل هم برای
        // آوردنِ اینپوتِ autoFocus به دیدرس، کلِ صفحه رو (افقی) اسکرول می‌کرد
        // (همون گزارشِ «صفحه جابه‌جا می‌شه»). این‌جا right رو کلمپ می‌کنیم تا
        // پاپ‌آپ همیشه کاملاً داخلِ صفحه بمونه
    const rawRight = window.innerWidth - rect.right;
    const maxRight = window.innerWidth - POPOVER_WIDTH_ESTIMATE - POPOVER_EDGE_MARGIN;
    const right = Math.min(Math.max(rawRight, POPOVER_EDGE_MARGIN), Math.max(maxRight, POPOVER_EDGE_MARGIN));
    const top = Math.min(rect.bottom + 4, window.innerHeight - 8);
    setPos({ top, right });
  }, [open, triggerRef]);
  return pos;
}

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

function isPersianWord(s: string): boolean {
  return new RegExp(`^${PERSIAN_RUN}$`).test(s);
}

// دنباله‌ی متوالیِ نودهایی که persian=false تگ شدن (کلمه‌ی لاتین یا عدد/علامتِ
// بینِ آن‌ها) رو توی یه <bdi dir="ltr"> ایزوله می‌کنه -- بدونِ این، الگوریتمِ
// دوجهتیِ یونیکد وسطِ یه جمله‌ی فارسی (راست‌به‌چپ) می‌تونه ترتیبِ بصریِ یه
// دنباله‌ی «عددِ+نشانه+لاتینِ» چسبیده‌به‌هم رو به‌هم بریزه -- مثلاً متنِ واقعیِ
// «۵۰ TL'ye %۴۰ تخفیف» بدونِ ایزوله‌سازی می‌تونه به شکلِ «۵۰ ye'TL ۴۰% تخفیف»
// نمایش داده بشه (فقط بصری -- خودِ دیتا درست بوده). عمداً <bdi> نه یه
// <span dir="ltr"> ساده: چون <bdi> استانداردِ خودِ HTML برای دقیقاً همین کاره
function groupBidiIsolatedNodes(tagged: { node: React.ReactNode; persian: boolean }[]): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let buffer: React.ReactNode[] = [];
  let bufferKey = 0;
  function flush() {
    if (buffer.length === 0) return;
    out.push(
      <bdi dir="ltr" key={`bidi-${bufferKey++}`}>
        {buffer}
      </bdi>
    );
    buffer = [];
  }
  for (const { node, persian } of tagged) {
    if (persian) {
      flush();
      out.push(node);
    } else {
      buffer.push(node);
    }
  }
  flush();
  return out;
}

// نسخه‌ی ساده‌ی همون گروه‌بندی -- برای وقتی که خودِ متن (نه ادمین، بدون
// دکمه‌های کلیک‌پذیر) مستقیم نمایش داده می‌شه
function wrapBidiIsolatedRuns(text: string): React.ReactNode[] {
  const pieces = text.split(WORD_RUN_REGEX);
  const tagged = pieces
    .filter((p) => p)
    .map((p, idx) => ({ node: <span key={idx}>{p}</span>, persian: isPersianWord(p) }));
  return groupBidiIsolatedNodes(tagged);
}

// همون استخراجِ کلمه‌ی بالا (لاتین/فارسی، جدا از عدد/علامت)، ولی به‌عنوانِ یه
// لیستِ یکتا -- برای جاهایی مثلِ PosterUntranslatedTerms.tsx که می‌خوان قبل از
// نمایش، کلماتِ تکراری (مثلاً یه مقدارِ مشترک بینِ چندتا ویژگی) رو یکبار نشون بدن،
// نه به‌ازای هر بار تکرار یه دکمه‌ی جدا
export function extractUniqueWords(text: string): string[] {
  const matches = text.match(WORD_RUN_REGEX) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of matches) {
    if (raw.length < 2) continue;
    // لاتین رو lowercase یکتا می‌کنیم (چون دیکشنری هم termTr رو lowercase ذخیره
    // می‌کنه)؛ فارسی رو دست‌نخورده -- حروفِ فارسی حالتِ بزرگ/کوچیک ندارن
    const key = isLatinWord(raw) ? raw.toLowerCase() : raw;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
  }
  return out;
}

// یک دنباله‌ی متوالیِ کلماتِ لاتین/ترکیِ ناشناخته رو یکجا نشون می‌ده -- به‌جای
// این‌که ادمین مجبور باشه کلمه‌به‌کلمه کلیک کند و هرکدوم رو جدا ترجمه کند، کل
// عبارت با یک کلیک/یک ورودی/یک ذخیره، به‌عنوان یک ردیفِ دیکشنریِ چندکلمه‌ای
// ثبت می‌شود -- tokenizeAndTranslate از قبل عبارت‌های چندکلمه‌ای رو با
// اولویتِ بالاتر از تک‌کلمه‌ای‌ها چک می‌کند، پس نیازی به تغییر دیگری نیست
export function TranslatableRun({
  displayText,
  coreWords,
  onSaved,
}: {
  displayText: string;
  coreWords: string[];
  // فقط وقتی از بیرونِ خودِ عنوان استفاده می‌شه (مثلاً AdminOriginalTitleCopy)،
  // برای این‌که همون‌جا از لیستِ کلماتِ ناشناخته حذفش کنه -- بدونِ این کال‌بک،
  // تنها راهِ به‌روزرسانی رفرشِ کاملِ صفحه بود
  onSaved?: () => void;
}) {
  const router = useRouter();
  const id = useId();
  const openPopoverId = useSyncExternalStore(subscribeOpenPopover, getOpenPopoverId, () => null);
  const open = openPopoverId === id;
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const isPhrase = coreWords.length > 1;
  const termTr = coreWords.join(" ");
  const isComboSelected = useSyncExternalStore(
    subscribeComboSelection,
    () => isWordSelected(id),
    () => isWordSelected(id)
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLSpanElement>(null);
  const pos = usePopoverPosition(triggerRef, open);
  useClosePopoverOnOutsideClick(open, () => setOpenPopover(null), [triggerRef, popupRef]);
  // روی موبایل کلیدِ Ctrl/⌘ وجود نداره -- معادلش لمسِ نگه‌داشته‌شده (long-press)
  // است: نگه‌داشتن یعنی «به انتخابِ ترکیبی اضافه/حذف کن»، لمسِ کوتاه (تپ) یعنی
  // «فرمِ ترجمه‌ی تکی رو باز کن»، دقیقاً هم‌ارزِ کلیکِ عادی/Ctrl+کلیک
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  function clearLongPressTimer() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }
  function handleTouchStart() {
    longPressFiredRef.current = false;
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      toggleComboWord({ id, termTr, display: displayText });
    }, 500);
  }

  // طبقِ گزارشِ صریح: قبلاً فقط یه تیکِ سبز (✓) نشون داده می‌شد و خودِ متنِ
  // ترجمه‌شده محو می‌شد -- ادمین نمی‌تونست همون‌جا مطمئن بشه که ترجمه‌ای که
  // تایپ کرده درست/خواناست. حالا همون متنِ فارسیِ تازه‌ذخیره‌شده رو نشون می‌دیم
  if (saved) {
    return <span className="text-emerald-700 font-medium">{value} ✓</span>;
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
    setOpenPopover(null);
    onSaved?.();
    router.refresh();
  }

  // inline نه inline-block -- وگرنه مرورگر بینِ این عنصر و همسایه‌ی چسبیده‌بهش
  // (بدون فاصله، مثلاً «%» قبلِ «۱۰۰») یه نقطه‌ی شکستِ خط مجاز می‌ذاره، چون
  // inline-block یه جعبه‌ی مستقل حساب می‌شه؛ inline باعث می‌شه دقیقاً مثلِ
  // متنِ معمولی فقط سرِ فاصله‌های واقعی خط بشکنه (باگِ گزارش‌شده: «%» ته خط
  // اول می‌موند، «۱۰۰» می‌رفت خط دوم)
  return (
    <span className="relative inline">
      <button
        ref={triggerRef}
        type="button"
        onTouchStart={handleTouchStart}
        onTouchEnd={clearLongPressTimer}
        onTouchMove={clearLongPressTimer}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          // لمسِ نگه‌داشته‌شده (long-press روی موبایل) از همین رویدادِ click هم
          // رد می‌شه (کلیکِ synthetic بعدِ touchend) -- چون خودِ نگه‌داشتن قبلاً
          // toggleComboWord رو صدا زده، این کلیکِ اضافه نباید دوباره فرم رو باز کنه
          if (longPressFiredRef.current) {
            longPressFiredRef.current = false;
            return;
          }
          // با Ctrl/⌘+کلیک (دسکتاپ)، به‌جای بازکردنِ فرمِ خودش، این کلمه به
          // انتخابِ مشترکِ TranslationComboBar اضافه/حذف می‌شه -- برای وقتی
          // چندتا کلمه‌ی جدا (که تک‌تک معنی ندارن، مثلاً یه کدِ کمپینِ
          // شکسته‌شده) باید یکجا ترجمه بشن
          if (e.ctrlKey || e.metaKey) {
            toggleComboWord({ id, termTr, display: displayText });
            return;
          }
          setOpenPopover(open ? null : id);
        }}
        className={`border-b border-dashed border-[var(--color-wine)] text-[var(--color-wine)] hover:bg-[var(--color-wine)]/10 ${
          isComboSelected ? "bg-[var(--color-wine)]/20 rounded px-0.5" : ""
        }`}
        title={
          isPhrase
            ? `کلیک کن تا ترجمه‌ی فارسیِ یکجای «${termTr}» رو به دیکشنری اضافه کنی`
            : "کلیک کن تا ترجمه‌ی فارسی این کلمه رو به دیکشنری اضافه کنی -- یا Ctrl+کلیک (موبایل: نگه‌داشتنِ لمس) برای ترکیب با کلمات دیگه"
        }
      >
        {displayText}
      </button>
      {open &&
        pos &&
        createPortal(
          <span
            ref={popupRef}
            style={{ position: "fixed", top: pos.top, right: pos.right }}
            className="z-40 flex items-center gap-1 bg-white border cut-line rounded-lg p-1.5 shadow-lg whitespace-nowrap"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") setOpenPopover(null);
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
          </span>,
          document.body
        )}
    </span>
  );
}

type DictRow = { id: string; termTr: string; termFa: string };

// یک عبارتِ فارسیِ از قبل ترجمه‌شده -- کلیک روش دیکشنری رو با همین متن جست‌وجو
// می‌کند (endpoint موجودِ GET که هم termTr هم termFa رو می‌گردد) و اگه ردیفی
// پیدا شد، همون‌جا قابل ویرایش (PATCH) یا حذف (DELETE) است -- بدون رفتن به
// صفحه‌ی جدا، دقیقاً هم‌ارزِ TranslatableRun ولی برای اصلاح/حذفِ ترجمه‌ی موجود
function EditableTranslationRun({ text, onSaved }: { text: string; onSaved?: () => void }) {
  const router = useRouter();
  const id = useId();
  const openPopoverId = useSyncExternalStore(subscribeOpenPopover, getOpenPopoverId, () => null);
  const open = openPopoverId === id;
  const [matches, setMatches] = useState<DictRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [comboBusy, setComboBusy] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLSpanElement>(null);
  const pos = usePopoverPosition(triggerRef, open);
  useClosePopoverOnOutsideClick(open, () => setOpenPopover(null), [triggerRef, popupRef]);
  const isComboSelected = useSyncExternalStore(
    subscribeComboSelection,
    () => isWordSelected(id),
    () => isWordSelected(id)
  );
  // طبقِ درخواستِ صریح: کلمه‌ی از قبل‌ترجمه‌شده هم باید بشه با کلماتِ دیگه
  // (ترجمه‌شده یا نشده، هرجای صفحه) ترکیب کرد -- دقیقاً همون مکانیزمِ
  // TranslatableRun (Ctrl+کلیک/نگه‌داشتنِ لمس)، فقط چون اینجا termTrِ خامش رو
  // از قبل نداریم (فقط ترجمه‌ی فارسیِ نمایش‌داده‌شده رو داریم)، قبل از افزودن
  // به انتخاب باید یه‌بار دیکشنری رو با همین متن جست‌وجو کنیم
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  function clearLongPressTimer() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }
  async function addToCombo() {
    if (comboBusy) return;
    if (isComboSelected) {
      toggleComboWord({ id, termTr: "", display: text });
      return;
    }
    setComboBusy(true);
    try {
      const res = await fetch(`/api/admin/trendyol-title-dictionary?q=${encodeURIComponent(text)}&exact=true&limit=1`);
      const data = await res.json();
      const match: DictRow | undefined = Array.isArray(data.results) ? data.results[0] : undefined;
      if (match) toggleComboWord({ id, termTr: match.termTr, display: text });
    } finally {
      setComboBusy(false);
    }
  }
  function handleTouchStart() {
    longPressFiredRef.current = false;
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      addToCombo();
    }, 500);
  }

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      addToCombo();
      return;
    }
    setOpenPopover(open ? null : id);
    if (matches === null) {
      setLoading(true);
      try {
        // exact=true: دقیقاً همون ردیف(های)ی که termFaشون *برابرِ* همین متنه --
        // نه یه جست‌وجوی fuzzy، چون contains برای کلماتِ کوتاه (مثلِ «نوع») با
        // زیررشته‌ی هر ترجمه‌ی طولانی‌تری که این حروف رو داخلش داره (مثلاً
        // «مصنوعی») هم مچ می‌شد و نتیجه‌ی واقعی رو زیرِ کلی نتیجه‌ی بی‌ربط گم می‌کرد
        const res = await fetch(
          `/api/admin/trendyol-title-dictionary?q=${encodeURIComponent(text)}&exact=true&limit=8`
        );
        const data = await res.json();
        const results: DictRow[] = Array.isArray(data.results) ? data.results : [];
        setMatches(results);
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
    // طبقِ گزارشِ صریح: بعدِ ذخیره، خودِ همین پاپ‌آپ هنوز مقدارِ *قدیمی* رو
    // نشون می‌داد -- چون matches فقط یه‌بار (موقعِ بازکردنِ پاپ‌آپ) fetch شده
    // بود و router.refresh() صرفاً دیتای *سرور* رو تازه می‌کنه، نه این state
    // محلی رو. اینجا دستی به‌روزش می‌کنیم تا همون لحظه (بدونِ نیاز به
    // بسته‌وبازکردنِ دوباره‌ی پاپ‌آپ) ترجمه‌ی تازه رو ببیند
    const savedValue = editValue.trim();
    setMatches((prev) => prev?.map((m) => (m.id === id ? { ...m, termFa: savedValue } : m)) ?? null);
    setEditingId(null);
    router.refresh();
    onSaved?.();
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
    onSaved?.();
  }

  const visibleMatches = matches?.filter((m) => !removedIds.has(m.id)) ?? null;

  // inline نه inline-block -- وگرنه مرورگر بینِ این عنصر و همسایه‌ی چسبیده‌بهش
  // (بدون فاصله، مثلاً «%» قبلِ «۱۰۰») یه نقطه‌ی شکستِ خط مجاز می‌ذاره، چون
  // inline-block یه جعبه‌ی مستقل حساب می‌شه؛ inline باعث می‌شه دقیقاً مثلِ
  // متنِ معمولی فقط سرِ فاصله‌های واقعی خط بشکنه (باگِ گزارش‌شده: «%» ته خط
  // اول می‌موند، «۱۰۰» می‌رفت خط دوم)
  return (
    <span className="relative inline">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        onTouchStart={handleTouchStart}
        onTouchEnd={clearLongPressTimer}
        onTouchMove={clearLongPressTimer}
        className={`border-b border-dotted border-[var(--color-muted)] hover:border-[var(--color-wine)] hover:text-[var(--color-wine)] ${
          isComboSelected ? "bg-[var(--color-wine)]/20 rounded px-0.5" : ""
        } ${comboBusy ? "opacity-50" : ""}`}
        title="کلیک کن تا ترجمه‌ی این کلمه رو ویرایش یا حذف کنی -- یا Ctrl+کلیک (موبایل: نگه‌داشتنِ لمس) برای ترکیب با کلماتِ دیگه"
      >
        {text}
      </button>
      {open &&
        pos &&
        createPortal(
        <span
          ref={popupRef}
          style={{ position: "fixed", top: pos.top, right: pos.right }}
          className="z-40 flex flex-col gap-1.5 bg-white border cut-line rounded-lg p-2 shadow-lg whitespace-nowrap min-w-[190px]"
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
        </span>,
        document.body
      )}
    </span>
  );
}

// طبقِ درخواستِ صریح: وقتی چندتا کلمه‌ی فارسیِ متوالی (هرکدوم از قبل جدا توی
// دیکشنری) با ترتیبِ کلمه‌به‌کلمه‌ی ترکی نشون داده می‌شن (مثلاً «آستین بلندی»
// به‌جای «بلندی آستین»)، این دکمه با یه کلیک یه ردیفِ *جدیدِ چندکلمه‌ای* توی
// دیکشنری ثبت می‌کند: termTr از الحاقِ termTrِ خودِ همون کلمات (به همون ترتیبِ
// اصلیِ ترکی -- برای همینه که باید هرکلمه رو جدا از دیکشنری بخونیم، نه فقط
// حدس بزنیم)، و termFa با ترتیبِ *برعکس*. چون translateTrendyolAttributeText
// همیشه اول دنبالِ ردیف‌های چندکلمه‌ای می‌گرده (اولویتِ بالاتر از تک‌کلمه‌ای‌ها)،
// از دفعه‌ی بعد همین عبارت با ترتیبِ درستِ فارسی نشون داده می‌شه
function ReversePhraseButton({ words, onSaved }: { words: string[]; onSaved?: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    setError("");
    try {
      const termTrParts: string[] = [];
      for (const w of words) {
        const res = await fetch(`/api/admin/trendyol-title-dictionary?q=${encodeURIComponent(w)}&exact=true&limit=1`);
        const data = await res.json();
        const match: DictRow | undefined = Array.isArray(data.results) ? data.results[0] : undefined;
        if (!match) {
          setError(`«${w}» توی دیکشنری پیدا نشد`);
          setBusy(false);
          return;
        }
        termTrParts.push(match.termTr);
      }
      const termTr = termTrParts.join(" ");
      const termFa = [...words].reverse().join(" ");
      const res = await fetch("/api/admin/trendyol-title-dictionary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termTr, termFa }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "ذخیره نشد");
        setBusy(false);
        return;
      }
      setDone(true);
      onSaved?.();
      router.refresh();
    } catch {
      setError("خطا در ذخیره‌سازی");
    }
    setBusy(false);
  }

  // طبقِ گزارشِ صریح: قبلاً فقط یه تیکِ سبز نشون داده می‌شد -- ادمین نمی‌دید
  // عبارتِ برعکس‌شده دقیقاً چی از آب درومده. حالا خودِ عبارتِ جدید رو هم نشون
  // می‌دیم (خودِ متنِ رویِ صفحه تا refresh/بارگذاریِ بعدی هنوز عوض نمی‌شه --
  // چون این فقط یه ردیفِ *جدید* به دیکشنری اضافه کرد، نه این‌که همین لحظه‌ی
  // متنِ فعلی رو دوباره ترجمه کنه -- برای همین توضیح هم اضافه شده)
  if (done) {
    return (
      <span className="text-emerald-700 text-xs">
        ✓ «{[...words].reverse().join(" ")}» ثبت شد -- از دفعه‌ی بعد همین‌جوری نشون داده می‌شه
      </span>
    );
  }

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        title={`ثبتِ ترکیبی با ترتیبِ برعکس: «${[...words].reverse().join(" ")}»`}
        className="text-[var(--color-ochre)] text-xs mx-0.5 disabled:opacity-50"
      >
        {busy ? "..." : "⇄"}
      </button>
      {error && (
        <span className="absolute top-full right-0 z-40 text-[10px] text-red-600 bg-white border cut-line rounded px-1.5 py-0.5 whitespace-nowrap shadow-lg">
          {error}
        </span>
      )}
    </span>
  );
}

// عمداً به‌جای این‌که یه رشته‌ی خام رو مستقیم چاپ کند، دنبالِ رشته‌های خالصِ
// حرفی می‌گردد (نه فقط توکن‌های جداشده با فاصله) -- بخش‌های عدد/علامت عادی
// نمایش داده می‌شن. دنباله‌های متوالیِ کلمه‌ی لاتین/ترکیِ ناشناخته یکجا برای
// افزودنِ *یه* ترجمه‌ی جدیدِ چندکلمه‌ای کلیک‌پذیرند (چون دیکشنری عبارتِ
// چندکلمه‌ای رو هم پشتیبانی می‌کنه). کلماتِ فارسی (یعنی از قبل ترجمه‌شده) اما
// عمداً *تک‌تک* کلیک‌پذیرن، نه ادغام‌شده -- چون ویرایش/حذف دنبالِ ردیفِ دقیقِ
// همون یه کلمه/عبارتِ کوتاه توی دیکشنریه، نه کلِ عبارتِ چندکلمه‌ایِ به‌هم‌چسبیده
// (که هیچ‌وقت با یه ردیفِ دیکشنری یکی نمی‌شه و ادمین نمی‌تونه هیچ‌کدوم از
// کلمات رو ویرایش کنه) -- هردو نوع بدون رفتن به صفحه‌ی جدا
export function AdminClickToTranslate({
  text,
  isAdmin,
  onSaved,
}: {
  text: string;
  isAdmin: boolean;
  // فقط وقتی صفحه‌ی صدازننده خودش دیتای محصول رو client-side کش کرده (نه
  // یه کامپوننتِ سرور که با router.refresh() دوباره فچ می‌شه) لازمه -- مثلاً
  // صفحه‌ی پوستر اینستاگرام، تا بعدِ ذخیره/حذفِ یه ترجمه، جزئیاتِ محصول رو
  // خودش دوباره بارگذاری کنه (وگرنه ترجمه‌ی تازه فقط بعدِ رفرشِ کاملِ صفحه دیده می‌شد)
  onSaved?: () => void;
}) {
  if (!isAdmin) return <>{wrapBidiIsolatedRuns(text)}</>;

  // split با یه گروهِ capturing، پشتِ‌سرهم [غیرحرفی, حرفی, غیرحرفی, حرفی, ...]
  // برمی‌گردونه -- ایندکسِ فرد همیشه یه رشته‌ی خالصِ حرفی (لاتین یا فارسی) است
  const pieces = text.split(WORD_RUN_REGEX);

  // برای جلوگیری از قاطی‌شدنِ بصریِ اعداد/علامت‌ها با کلماتِ لاتین وسطِ یه
  // جمله‌ی فارسی (مثلِ «TL'ye %40» که بدونِ ایزوله‌سازی، الگوریتمِ دوجهتیِ
  // یونیکد ممکنه نمایشش رو به‌هم بریزه -- مثلاً «ye'TL ۴۰%»)، هر تکه (کلمه یا
  // جداکننده) با persian=false/true تگ می‌شه؛ در پایان دنباله‌های متوالیِ
  // persian=false توی یه <bdi dir="ltr"> ایزوله می‌شن
  const taggedNodes: { node: React.ReactNode; persian: boolean }[] = [];
  let i = 0;
  let key = 0;
  while (i < pieces.length) {
    const piece = pieces[i];
    const isWordPiece = i % 2 === 1;
    if (!isWordPiece || !piece || piece.length < 2) {
      if (piece) taggedNodes.push({ node: <span key={key++}>{piece}</span>, persian: false });
      i++;
      continue;
    }

    const pieceIsLatin = isLatinWord(piece);

    // فارسی (یعنی از قبل ترجمه شده) -- عمداً تک‌تک کلمه کلیک‌پذیره، نه ادغام‌شده
    // با همسایه‌هاش. چرا: EditableTranslationRun دنبالِ ردیفی توی دیکشنری
    // می‌گرده که termFaش *دقیقاً* برابرِ متنِ کلیک‌شده باشه؛ دیکشنری هم همیشه
    // کلمه/عبارتِ کوتاه رو جدا نگه می‌داره (نه کلِ عنوانِ ادغام‌شده رو یکجا)،
    // پس اگه چندتا کلمه‌ی فارسیِ متوالی رو یک بلوک حساب کنیم، هیچ‌وقت به هیچ
    // ردیفی نمی‌خوره و ادمین اصلاً نمی‌تونه تک‌تکِ کلمه‌ها رو ویرایش کنه (دقیقاً
    // همون گزارش: «این کلمه از دیکشنری نیامده»، چون کلِ عبارتِ چندکلمه‌ای رو
    // باهم چک می‌کرد نه هرکلمه رو جدا)
    if (!pieceIsLatin) {
      // کلماتِ فارسیِ متوالی (که فقط با فاصله از هم جدا شدن) رو جمع می‌کنیم --
      // نه برای ادغام‌کردنِ خودِ دکمه‌های ویرایش (هر کلمه هنوز جدا و مستقلاً
      // قابلِ ویرایش/حذفه، دقیقاً طبقِ همون منطقِ بالا)، فقط برای این‌که بدونیم
      // بعدِ کدوم کلمه، دکمه‌ی «⇄ ترکیبی با ترتیبِ برعکس» رو نشون بدیم -- طبقِ
      // درخواستِ صریح: وقتی ترجمه‌ی کلمه‌به‌کلمه ترتیبش برعکسِ فارسیِ طبیعیه
      // (مثلاً «آستین بلندی» به‌جای «بلندی آستین»)، ادمین بتونه با یه کلیک یه
      // ردیفِ دیکشنریِ چندکلمه‌ای با ترجمه‌ی برعکس ثبت کنه، بدونِ نیاز به رفتنِ
      // به صفحه‌ی جداگانه‌ی دیکشنری
      const persianRunWords: string[] = [piece];
      let j = i + 1;
      while (j + 1 < pieces.length && j % 2 === 0 && /^\s+$/.test(pieces[j]) && pieces[j + 1]?.length >= 2 && !isLatinWord(pieces[j + 1])) {
        persianRunWords.push(pieces[j + 1]);
        j += 2;
      }
      for (let w = 0; w < persianRunWords.length; w++) {
        taggedNodes.push({
          node: <EditableTranslationRun key={key++} text={persianRunWords[w]} onSaved={onSaved} />,
          persian: true,
        });
        if (w < persianRunWords.length - 1) taggedNodes.push({ node: " ", persian: true });
      }
      if (persianRunWords.length > 1) {
        taggedNodes.push({
          node: <ReversePhraseButton key={key++} words={persianRunWords} onSaved={onSaved} />,
          persian: true,
        });
      }
      i = j;
      continue;
    }

    // لاتین/ترکیِ ناشناخته -- برخلافِ فارسی، اینجا جمع‌کردنِ دنباله‌ی متوالی
    // منطقیه: ادمین معمولاً می‌خواد یه عبارتِ چندکلمه‌ایِ ناشناخته رو یکجا (نه
    // کلمه‌به‌کلمه) به دیکشنری اضافه کنه (فقط وقتی قطعه‌ی غیرحرفیِ بینشون
    // صرفاً فاصله‌ی خالی باشه، نه عدد/علامت -- یعنی دو مقدارِ چسبیده‌به‌هم مثل
    // «Polyester,%40Pamuk» جدا حساب می‌شن، نه یکی)
    const runWords: string[] = [piece];
    const runDisplayParts: string[] = [piece];
    // نکته: باید از i+1 (فاصله‌ی بلافاصله بعدِ همین کلمه) شروع بشه، نه i+2 --
    // با i+2 چک همیشه رویِ یه توکنِ *کلمه* (نه فاصله) انجام می‌شد که چون فردِ
    // ایندکسه هیچ‌وقت با j % 2 === 0 قبول نمی‌شد، پس هیچ ادغامی رخ نمی‌داد و
    // بدتر از اون، همون فاصله‌ی بینِ i و i+2 هم توی حلقه‌ی اصلی رد می‌شد (چون
    // i مستقیم می‌پرید به j=i+2) -- نتیجه‌ش کلماتِ لاتینِ متوالی که بدونِ
    // هیچ فاصله‌ای به‌هم چسبیده نمایش داده می‌شدن (باگِ گزارش‌شده)
    let j = i + 1;
    while (
      j + 1 < pieces.length &&
      j % 2 === 0 &&
      /^\s+$/.test(pieces[j]) &&
      pieces[j + 1]?.length >= 2 &&
      isLatinWord(pieces[j + 1])
    ) {
      runDisplayParts.push(pieces[j], pieces[j + 1]);
      runWords.push(pieces[j + 1]);
      j += 2;
    }
    const displayText = runDisplayParts.join("");
    taggedNodes.push({
      node: <TranslatableRun key={key++} displayText={displayText} coreWords={runWords} onSaved={onSaved} />,
      persian: false,
    });
    i = j;
  }

  return <>{groupBidiIsolatedNodes(taggedNodes)}</>;
}
