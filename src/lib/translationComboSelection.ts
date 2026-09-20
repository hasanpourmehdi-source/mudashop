"use client";

// انتخابِ چندتایی برای ترکیب‌کردنِ چندتا کلمه‌ی جدا (که تک‌تک معنی ندارن، مثلاً
// یه کدِ کمپین که به‌اشتباه به چندتا تکه‌ی لاتین/عددی شکسته شده) و ثبتِ یکجای
// ترجمه‌شون به‌عنوان یک ردیفِ چندکلمه‌ای توی دیکشنری -- ادمین با نگه‌داشتنِ
// Ctrl (یا ⌘ روی مک) و کلیک روی چندتا کلمه‌ی جداگانه، اون‌ها رو به این انتخابِ
// مشترک اضافه می‌کنه؛ یه نوارِ شناور (TranslationComboBar) همیشه یه‌جا (لایوت
// اصلی) مانیتور می‌کنه و فرمِ ترجمه‌ی یکجا رو نشون می‌ده. چون این چندتا کامپوننتِ
// کاملاً مستقلِ TranslatableRun باید همه به یه state مشترک دسترسی داشته باشن،
// از یه external store سبک (بدونِ نیاز به Context/Provider دورِ صفحه) استفاده
// می‌کنیم -- با useSyncExternalStore هر جزء فقط با تغییرِ واقعی ری‌رندر می‌شه

export type ComboWord = {
  // شناسه‌ی یکتا برای تشخیصِ همین occurrence خاص (نه فقط خودِ کلمه -- چون یه
  // کلمه ممکنه چندجای صفحه تکرار شده باشه و ادمین دقیقاً همینی که کلیک کرده
  // رو می‌خواد انتخاب/لغو کنه، نه همه‌ی occurrenceهای مشابه)
  id: string;
  termTr: string;
  display: string;
};

let selected: ComboWord[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function subscribeComboSelection(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getComboSelectionSnapshot(): ComboWord[] {
  return selected;
}

export function isWordSelected(id: string): boolean {
  return selected.some((w) => w.id === id);
}

// کلیک با Ctrl روی یه کلمه -- اگه از قبل انتخاب شده بود حذفش کن، وگرنه به
// انتهای لیست (به ترتیبِ کلیک، نه ترتیبِ سندی) اضافه‌ش کن
export function toggleComboWord(word: ComboWord) {
  const exists = selected.some((w) => w.id === word.id);
  selected = exists ? selected.filter((w) => w.id !== word.id) : [...selected, word];
  emit();
}

export function clearComboSelection() {
  selected = [];
  emit();
}
