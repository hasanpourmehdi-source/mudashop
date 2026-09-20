#!/usr/bin/env node
// طبقِ درخواستِ صریحِ کاربر: بعدِ هر دیپلویِ جدید، فقط N تای اخیر (پیش‌فرض ۵)
// نگه داشته بشه و بقیه حذف بشن -- تا سهمیه‌ی Function Storage توی Vercel
// (که قبلاً به‌خاطرِ ده‌ها دیپلویِ قدیمیِ نگه‌داشته‌شده پُر شده بود) دوباره پر
// نشه. همیشه با --safe اجرا می‌شه تا دیپلویی که الان alias شده (پروداکشنِ
// زنده) هرگز حذف نشه، حتی اگه به‌اشتباه توی لیستِ حذف قرار بگیره.
import { execFileSync } from "node:child_process";

const KEEP = Number(process.argv[2] ?? 5);

function run(cmd, args) {
  // shell:true لازمه چون روی ویندوز npx خودش یه فایلِ .cmd هست، نه یه
  // اجرایی مستقیم -- execFileSync بدونِ shell نمی‌تونه پیداش کنه (ENOENT)
  return execFileSync(cmd, args, { encoding: "utf-8", maxBuffer: 20 * 1024 * 1024, shell: true });
}

const raw = run("npx", ["vercel", "list", "--limit", "100", "--json"]);
const data = JSON.parse(raw);
const deployments = (data.deployments ?? []).filter((d) => d.state === "READY");
deployments.sort((a, b) => b.createdAt - a.createdAt);

// اعتبارسنجیِ دفاعی -- چون این مقادیر مستقیم به یه shell پاس داده می‌شن
// (execFileSync با shell:true، برای حلِ مشکلِ npx.cmd روی ویندوز)، قبل از
// اجرا مطمئن می‌شیم هرکدوم دقیقاً یه هاست‌نیمِ ساده‌ی *.vercel.app هست، نه
// هر متنِ دیگه‌ای که از خروجیِ API اومده
const SAFE_HOST = /^[a-z0-9-]+\.vercel\.app$/i;
for (const d of deployments) {
  if (!SAFE_HOST.test(d.url)) {
    throw new Error(`آدرسِ دیپلوی غیرمنتظره -- برای امنیت متوقف شد: ${d.url}`);
  }
}

const toRemove = deployments.slice(KEEP);
if (toRemove.length === 0) {
  console.log(`چیزی برای حذف نیست -- فقط ${deployments.length} دیپلوی هست (سقف: ${KEEP}).`);
  process.exit(0);
}

console.log(`نگه‌داشتنِ ${Math.min(KEEP, deployments.length)} تای اخیر، حذفِ ${toRemove.length} تای قدیمی...`);

const CHUNK = 20;
for (let i = 0; i < toRemove.length; i += CHUNK) {
  const chunk = toRemove.slice(i, i + CHUNK).map((d) => d.url);
  try {
    const out = run("npx", ["vercel", "remove", ...chunk, "--safe", "--yes"]);
    console.log(out);
  } catch (err) {
    // یه chunk گاهی به‌خاطرِ محدودیتِ rate-limit شکست می‌خوره -- یه بار دیگه امتحان کن
    console.warn("یه بار دیگه امتحان می‌کنم این دسته رو...");
    const out = run("npx", ["vercel", "remove", ...chunk, "--safe", "--yes"]);
    console.log(out);
  }
}

console.log("تمیزکاریِ دیپلوی‌ها انجام شد.");
