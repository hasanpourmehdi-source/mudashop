// اجرا: node prisma/seedTrendyolCategoryParams.js
//
// برای هر دسته‌بندی مزون (والد و فرزند، هر ۱۸ تاش)، به‌ازای هر ExternalSite
// فعلی (ترندیول، ترندیول‌میلا) یه ردیف ExternalSiteCategoryParam می‌سازه، با
// یه مقدار جای‌گیر (placeholder) "wc=0" چون کد واقعی هنوز مشخص نیست.
//
// این کار دو تا فایده داره:
// ۱. بخش «دسته‌بندی» توی فیلترهای سایت خارجی (که الان خالیه چون
//    ExternalSiteCategoryParam توش هیچی نداشت) از همین حالا پر می‌شه و
//    قابل‌تیک‌زدنه.
// ۲. مهدی می‌تونه بعداً کد واقعی هر دسته رو (که از
//    /integration/product/product-categories ترندیول می‌کشه بیرون) جایگزین
//    همین placeholder کنه -- یا از پنل ادمین، یا مستقیم توی دیتابیس.
//
// این اسکریپت idempotent (بی‌خطر برای اجرای چندباره) هست: اگه یه ردیف از قبل
// مقدار واقعی (غیر از "wc=0") داشته باشه، دست‌نخورده می‌مونه -- فقط ردیف‌های
// نبود یا هنوز-placeholder آپدیت/ساخته می‌شن.

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const PLACEHOLDER_PARAM = "wc=0";

async function main() {
  const sites = await prisma.externalSite.findMany();
  if (sites.length === 0) {
    console.log("⚠️  هیچ ExternalSite ثبت نشده -- اول prisma/seedExternalSites.js رو اجرا کن.");
    return;
  }

  const categories = await prisma.category.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });
  if (categories.length === 0) {
    console.log("⚠️  هیچ دسته‌بندی‌ای توی دیتابیس نیست.");
    return;
  }

  for (const site of sites) {
    console.log(`\n== ${site.name} (${site.slug}) ==`);
    for (const category of categories) {
      const existing = await prisma.externalSiteCategoryParam.findUnique({
        where: { siteId_categoryId: { siteId: site.id, categoryId: category.id } },
      });

      if (existing && existing.param !== PLACEHOLDER_PARAM) {
        console.log(`  ↳ ${category.name} (${category.slug}) -- از قبل مقدار واقعی داره (${existing.param})، دست نمی‌زنیم`);
        continue;
      }

      await prisma.externalSiteCategoryParam.upsert({
        where: { siteId_categoryId: { siteId: site.id, categoryId: category.id } },
        update: { param: PLACEHOLDER_PARAM },
        create: { siteId: site.id, categoryId: category.id, param: PLACEHOLDER_PARAM },
      });
      console.log(`  ↳ ${category.name} (${category.slug}) -> ${PLACEHOLDER_PARAM} [placeholder]`);
    }
  }

  console.log(
    "\nانجام شد. الان بخش «دسته‌بندی» توی فیلترهای هر سایت خارجی پر شده -- ولی همه‌شون هنوز placeholder (wc=0) دارن و باعث 404 می‌شن تا وقتی کد واقعی هر دسته رو جایگزین کنی."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
