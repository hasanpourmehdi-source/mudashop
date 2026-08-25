// فاکتور و پیش‌فاکتور -- توابع خالص: تاریخ شمسی، شماره فاکتور، برچسب‌ها.
// الگوریتم تبدیل میلادی↔جلالی از جالاالی (دامنه‌ی عمومی) با ورودی/خروجی تایپ‌شده.

const JALALI_BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

const div = (a: number, b: number) => ~~(a / b);
const mod = (a: number, b: number) => a - ~~(a / b) * b;

type JalCalResult = { leap: number; gy: number; march: number };

// الگوریتم بورکوفسکی (همان jalaali-js): leap = تعداد سال‌ها از آخرین سال کبیسه (۰ یعنی سال جاری کبیسه)
function jalCal(jy: number): JalCalResult {
  const bl = JALALI_BREAKS.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = JALALI_BREAKS[0];
  let jm = 0;
  let jump = 0;
  for (let i = 1; i < bl; i += 1) {
    jm = JALALI_BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  const n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  let adjusted = n;
  if (jump - n < 6) adjusted = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(adjusted + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function g2d(gy: number, gm: number, gd: number): number {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn: number): [number, number, number] {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return [gy, gm, gd];
}

function d2j(jdn: number): [number, number, number] {
  const gy = d2g(jdn)[0];
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(r.gy, 3, r.march);
  let k = jdn - jdn1f; // فاصله از اول فروردین (بر پایه‌ی صفر)
  if (k >= 0) {
    if (k <= 185) return [jy, 1 + div(k, 31), mod(k, 31) + 1];
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return [jy, 7 + div(k, 30), mod(k, 30) + 1];
}

export type JalaliDate = { jy: number; jm: number; jd: number };

// تبدیل تاریخ میلادی به جلالی (ماه‌ها ۱ تا ۱۲، سال شمسی)
export function toJalali(date: Date): JalaliDate {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();
  const [jy, jm, jd] = d2j(g2d(gy, gm, gd));
  return { jy, jm, jd };
}

const JALALI_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

// ارقام فارسی بدون جداکننده‌ی هزارگان
const faDigits = (n: number) => n.toLocaleString("fa-IR", { useGrouping: false });
const FA_NUM = "۰۱۲۳۴۵۶۷۸۹";
const faDigitsStr = (s: string) => s.replace(/\d/g, (d) => FA_NUM[Number(d)]);

// فرمت عددی: ۱۴۰۴/۰۵/۳۰
export function formatJalaliDate(date: Date): string {
  const { jy, jm, jd } = toJalali(date);
  return `${faDigits(jy)}/${faDigitsStr(String(jm).padStart(2, "0"))}/${faDigitsStr(String(jd).padStart(2, "0"))}`;
}

// فرمت بلند: ۳۰ مرداد ۱۴۰۴
export function formatJalaliLong(date: Date): string {
  const { jy, jm, jd } = toJalali(date);
  return `${faDigits(jd)} ${JALALI_MONTHS[jm - 1]} ${faDigits(jy)}`;
}

// شماره فاکتور: MDS-1404-I-3F8A2B (فاکتور) / MDS-1404-P-3F8A2B (پیش‌فاکتور)
export function invoiceNumber(opts: { orderId: string; kind: "invoice" | "proforma"; date?: Date }): string {
  const { jy } = toJalali(opts.date ?? new Date());
  const seq = opts.orderId.slice(-6).toUpperCase();
  return `MDS-${jy}-${opts.kind === "invoice" ? "I" : "P"}-${seq}`;
}

// جمع هر قلم فاکتور
export function lineTotal(price: number, quantity: number): number {
  return price * quantity;
}

// مجموع اقلام از روی آیتم‌ها (بدون گرد کردن؛ ورودی‌ها عدد صحیح تومان‌اند)
export function sumLines(items: Array<{ price: number; quantity: number }>): number {
  return items.reduce((sum, item) => sum + lineTotal(item.price, item.quantity), 0);
}

// وضعیت پرداخت به فارسی برای فاکتور
export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "در انتظار بررسی",
  AWAITING_PAYMENT: "منتظر پرداخت",
  AWAITING_VERIFICATION: "در انتظار تأیید فیش",
  PAID: "پرداخت‌شده",
  FAILED: "پرداخت ناموفق",
};

export function paymentStatusLabel(status: string | null | undefined): string {
  if (!status) return "نامشخص";
  return PAYMENT_STATUS_LABELS[status] ?? status;
}

// آیا این سفارش هنوز پرداخت نشده و بنابراین «پیش‌فاکتور» است؟
export function isProforma(paymentStatus: string | null | undefined): boolean {
  return paymentStatus !== "PAID";
}