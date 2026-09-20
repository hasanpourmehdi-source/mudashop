// این اسکریپت عمداً بیرون از src/ و به‌صورت یه پروسه‌ی Node.js کاملاً جدا اجرا
// می‌شه (نه import شده توی کد اپ) -- چون playwright-extra + پلاگین stealth
// زیر باندلر Turbopack نکست‌جی‌اس می‌شکنن (`utils.typeOf is not a function`،
// احتمالاً یه ناسازگاری CJS/ESM interop مخصوص باندلر). با اجرای این منطق توی
// یه پروسه‌ی Node ساده (بدون هیچ باندلری، دقیقاً مثل یه اسکریپت مستقل)، این
// مشکل کامل دور زده می‌شه.
const { chromium } = require("playwright-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

chromium.use(StealthPlugin());

const CHALLENGE_TITLE_RE = /just a moment/i;
const NAV_TIMEOUT_MS = 20000;
const CHALLENGE_WAIT_MS = 15000;

// روی محیطِ سرورلس (Vercel/AWS Lambda) هیچ کرومیومِ از-قبل-نصب‌شده‌ای نیست --
// playwright معمولی فقط رو ماشینِ خودمون (که npx playwright install روش زده
// شده) کار می‌کنه. @sparticuz/chromium یه بایلدِ فشرده‌ی مخصوصِ همین محیط‌هاست
// که در لحظه استخراج می‌شه؛ فقط وقتی واقعاً روی Vercel/Lambda هستیم بهش نیاز
// داریم -- رو ماشینِ خودمون همون کرومیومِ محلیِ playwright ساده‌تر و سریع‌تره
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

async function resolveLaunchOptions() {
  if (!isServerless) return { headless: true };
  // @sparticuz/chromium فقط ESM هست (package.json#type=module) -- require از یه
  // CJS، خودِ کلاس رو زیرِ .default برمی‌گردونه (نه مستقیم)، دقیقاً همون رفتارِ
  // استانداردِ interop برای require(esm) توی Node
  const sparticuzChromium = require("@sparticuz/chromium").default;
  return {
    headless: true,
    executablePath: await sparticuzChromium.executablePath(),
    args: sparticuzChromium.args,
  };
}

async function main() {
  const url = process.argv[2];
  if (!url) {
    process.stderr.write("آدرس به‌عنوان آرگومان لازم است\n");
    process.exit(1);
  }

  const launchOptions = await resolveLaunchOptions();
  const browser = await chromium.launch(launchOptions);
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });

    const title = await page.title().catch(() => "");
    if (CHALLENGE_TITLE_RE.test(title)) {
      await page
        .waitForFunction(() => !/just a moment/i.test(document.title), { timeout: CHALLENGE_WAIT_MS })
        .catch(() => {});
    }

    const body = await page.content();
    const statusCode = response ? response.status() : 200;
    process.stdout.write(JSON.stringify({ statusCode, body }));
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  process.stderr.write(String((err && err.stack) || err) + "\n");
  process.exit(1);
});
