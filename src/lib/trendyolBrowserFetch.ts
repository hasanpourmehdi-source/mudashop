import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// وقتی got-scraping (توی trendyol.ts) شکست بخوره -- یعنی کلادفلر یه چالش
// جاوااسکریپتی («Just a moment...») برگردونده که فقط یه مرورگر واقعی می‌تونه
// حلش کنه -- این ماژول به‌عنوان آخرین راه، منطق Playwright+stealth رو (که توی
// scripts/trendyolBrowserFetchWorker.cjs هست) به‌صورت یه پروسه‌ی Node جدا اجرا
// می‌کنه. عمداً import مستقیم نشده چون playwright-extra + پلاگین stealth زیر
// باندلر Turbopack نکست‌جی‌اس می‌شکنن (خطای `utils.typeOf is not a function`)؛
// اجرا در یه پروسه‌ی جدا (بدون باندل شدن) این مشکل رو کامل دور می‌زنه.
const WORKER_SCRIPT = path.join(process.cwd(), "scripts", "trendyolBrowserFetchWorker.cjs");
const WORKER_TIMEOUT_MS = 40000;
const MAX_BUFFER_BYTES = 20 * 1024 * 1024; // صفحات HTML ترندیول می‌تونن چند صد کیلوبایت باشن

// محدودکننده‌ی همزمانی ساده (بدون پکیج جدید) -- اگه چند درخواست هم‌زمان به
// fallback نیاز داشته باشن، حداکثر ۲ تا پروسه/مرورگر هم‌زمان بازه تا منابع
// سرور منفجر نشه
const MAX_CONCURRENT = 2;
let activeCount = 0;
const waitQueue: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (activeCount < MAX_CONCURRENT) {
    activeCount++;
    return;
  }
  await new Promise<void>((resolve) => waitQueue.push(resolve));
  activeCount++;
}

function releaseSlot(): void {
  activeCount--;
  const next = waitQueue.shift();
  if (next) next();
}

// یه صفحه رو با مرورگر واقعی (توی پروسه‌ی جدا) باز می‌کنه و HTML نهایی رو
// برمی‌گردونه -- هر فراخوانی یه Chromium تازه لانچ می‌کنه (سریع نیست، ولی طبق
// تصمیم مهدی کندی مهم نیست) و بعدش کامل بسته می‌شه، پس نیازی به مدیریت عمر
// مرورگر بین درخواست‌ها نیست
export async function fetchTrendyolPageViaBrowser(
  url: string
): Promise<{ statusCode: number; body: string }> {
  await acquireSlot();
  try {
    const { stdout } = await execFileAsync(process.execPath, [WORKER_SCRIPT, url], {
      timeout: WORKER_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER_BYTES,
    });
    return JSON.parse(stdout) as { statusCode: number; body: string };
  } finally {
    releaseSlot();
  }
}
