// قلابِ سراسریِ Next.js ۱۵ برای خطاهای سمتِ سرور (روت‌های API، Server Component ها،
// میدل‌ور) -- یه بار همین‌جا وصل می‌شه، نیازی به try/catch دستی توی تک‌تکِ
// روت‌ها (که ده‌ها فایل بود) نیست. فقط سمتِ Node اجرا می‌شه (نه Edge)، چون
// errorLog.ts به Prisma نیاز داره.
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string }
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { logServerError } = await import("@/lib/errorLog");
  await logServerError({
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context: {
      path: request.path,
      method: request.method,
      routePath: context.routePath,
      routeType: context.routeType,
    },
    source: "SERVER",
  });
}
