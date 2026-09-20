import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

const execFileAsync = promisify(execFile);

// Cloudflareِ ترندیول گاهی به یه fallback مرورگرِ واقعی (Playwright) نیاز داره که
// خودش می‌تونه ~۱۵-۲۰ ثانیه طول بکشه -- مهلتِ پیش‌فرضِ Vercel (۱۰ ثانیه) کافی نیست
export const maxDuration = 60;

// تنها روتی که واقعاً Playwright+@sparticuz/chromium رو باندل می‌کنه (نگاه کن
// به next.config.ts::TRENDYOL_BROWSER_FETCH_ROUTES). قبلاً src/lib/trendyolBrowserFetch.ts
// این execFile رو مستقیم اجرا می‌کرد و چون هرکسی که (مستقیم/غیرمستقیم) اون
// فایل رو import می‌کرد این باندلِ ~۸۶ مگابایتی رو می‌گرفت، ۶۶ روتِ مختلف
// همین یه باندل رو جدا-جدا حمل می‌کردن -- با ۵ دیپلویِ نگه‌داشته‌شده، سهمیه‌ی
// Function Storage ورسل (۱۰ گیگ) دوباره پُر شد (با اینکه دفعه‌ی قبل از
// ۲۷۹ روت به ۶۶ روت کم شده بود). الان trendyolBrowserFetch.ts فقط یه فچِ
// داخلیِ HTTP به همین‌جا می‌زنه، پس فقط همین یه فانکشن این باندل رو داره --
// ۶۶ روتِ دیگه دیگه هیچ ارجاعی به execFile/اسکریپت/کرومیوم ندارن
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

// این روت هیچ‌جا لینک نمی‌شه، ولی مسیرش عمومیه -- بدونِ این چک، هرکسی که
// مسیر رو حدس بزنه می‌تونه سرور رو مجبور به لانچِ مرورگرِ واقعی کنه (هزینه/DoS).
// رمز فقط بینِ همین روت و src/lib/trendyolBrowserFetch.ts (سرور-به-سرور)
// رد و بدل می‌شه، هیچ‌وقت به کلاینت نمی‌رسه
function isAuthorized(req: Request): boolean {
  const secret = process.env.TRENDYOL_BROWSER_FETCH_SECRET;
  return !!secret && req.headers.get("x-internal-secret") === secret;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است" }, { status: 400 });
  }
  const url = (body.url ?? "").trim();
  if (!url) {
    return NextResponse.json({ error: "url لازم است" }, { status: 400 });
  }

  await acquireSlot();
  try {
    const { stdout } = await execFileAsync(process.execPath, [WORKER_SCRIPT, url], {
      timeout: WORKER_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER_BYTES,
    });
    const result = JSON.parse(stdout) as { statusCode: number; body: string };
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: "اجرای مرورگر ناموفق بود", detail: String(err) },
      { status: 502 },
    );
  } finally {
    releaseSlot();
  }
}
