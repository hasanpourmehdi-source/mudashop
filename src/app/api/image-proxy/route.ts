import { gotScraping } from "got-scraping";
import { HEADER_GENERATOR_OPTIONS } from "@/lib/trendyol";
import { isAllowedImageProxyHost } from "@/lib/imageProxy";

// عکسِ ترندیول/میلا رو سمتِ سرور (نه مرورگرِ کاربر) واکشی می‌کنه و مستقیم
// تحویل می‌ده -- چون خودِ cdn.dsmcdn.com جلوی embedِ عکس از دامنه‌ی خارجی
// (سایتِ ما) رو می‌گیره، ولی درخواستِ سرور-به-سرور این محدودیت رو نداره
// (توضیحِ کامل توی src/lib/imageProxy.ts). فقط همون یه دامنه مجازه -- بدون
// این چک، این روت یه SSRF/پروکسیِ باز می‌شد (واکشیِ هر آدرسِ دلخواه سمتِ سرور)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get("url");
  if (!target) {
    return new Response("پارامتر url لازم است", { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return new Response("آدرس نامعتبر است", { status: 400 });
  }
  if (parsed.protocol !== "https:" || !isAllowedImageProxyHost(parsed.hostname)) {
    return new Response("این دامنه مجاز نیست", { status: 403 });
  }

  try {
    const upstream = await gotScraping({
      url: parsed.toString(),
      headerGeneratorOptions: HEADER_GENERATOR_OPTIONS,
      throwHttpErrors: false,
      responseType: "buffer",
    });

    if (upstream.statusCode < 200 || upstream.statusCode >= 300) {
      return new Response("واکشیِ عکس ناموفق بود", { status: 502 });
    }

    return new Response(new Uint8Array(upstream.body as Buffer), {
      status: 200,
      headers: {
        "Content-Type": (upstream.headers["content-type"] as string) || "image/jpeg",
        // عکس‌های محصول عوض نمی‌شن -- کش طولانی سمتِ مرورگر/CDN بی‌خطره
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });
  } catch {
    return new Response("واکشیِ عکس ناموفق بود", { status: 502 });
  }
}
