// برای اینکه در آنِ واحد فقط یه پاپ‌آپِ ترجمه/ویرایش (روی کل صفحه، حتی بینِ
// چندتا کارتِ گریدِ مختلف) باز بمونه -- وگرنه هرکدوم state بازبودنِ کاملاً جدا
// و بی‌خبر از بقیه داشتن، پس با کلیک روی چندتا کلمه‌ی مختلف همه‌شون بازِ باز
// می‌موندن و صفحه رو شلوغ می‌کردن (دقیقاً همون گزارش: «تا روی همه کلمه دوباره
// کلیک کنی نمی‌ره»). external store ساده -- مثلِ همون الگوی translationComboSelection
let openPopoverId: string | null = null;
const listeners = new Set<() => void>();

export function getOpenPopoverId(): string | null {
  return openPopoverId;
}

export function setOpenPopover(id: string | null) {
  if (openPopoverId === id) return;
  openPopoverId = id;
  listeners.forEach((l) => l());
}

export function subscribeOpenPopover(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
