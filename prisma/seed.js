// اجرا: node prisma/seed.js
//
// ⚠️ این نسخه با نسخه‌ی قبلی فرق اساسی داره:
// قبلاً «جنسیت» یه Category جدا بود (مثلاً «زنانه» به‌عنوان دسته‌ی ریشه) که باعث
// می‌شد کل درخت دسته‌بندی برای هر جنسیت تکرار بشه و محصولات بدون جنسیت (لوازم برقی و..)
// جایی برای قرار گرفتن نداشته باشن.
//
// حالا (دقیقاً مثل ترندیول): جنسیت یک Attribute معمولیه که فقط به دسته‌بندی‌هایی که
// واقعاً بهش نیاز دارن (پوشاک، کفش، اکسسوری) وصل می‌شه -- بدون fixedValue، یعنی هر
// محصول جداگانه مقدارش رو انتخاب می‌کنه (زنانه/مردانه/یونیسکس). دسته‌بندی‌هایی مثل
// «لوازم برقی» و «لوازم خانه» اصلاً به این ویژگی وصل نیستن و محصولاتشون جنسیت ندارن.
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  // داده‌ی سید کاملاً نمونه/دموست (کاربر با رمز ساده، محصولات Fake، کوپن‌های
  // ابدی، حراج‌ها). هیچ‌وقت نباید روی دیتابیس پروداکشن اجرا بشه -- وگرنه باعث
  // حساب ادمین با رمز شناخته‌شده و کالا/کوپن دموی قابل خرید واقعی می‌شه.
  if (process.env.NODE_ENV === "production") {
    console.error("⚠️ اجرای سید روی دیتابیس پروداکشن ممنوع است. NODE_ENV=production است.");
    process.exit(1);
  }

  console.log("در حال ساخت داده‌های اولیه (ساختار جدید)...");

  // ---------- کاربر ادمین ----------
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@mudashop.ir" },
    update: {},
    create: {
      email: "admin@mudashop.ir",
      name: "مدیر مُداشاپ",
      password: adminPassword,
      role: "ADMIN",
    },
  });
  console.log("کاربر ادمین آماده شد:", admin.email, "| رمز عبور: admin123");

  const customerPassword = await bcrypt.hash("customer123", 10);
  await prisma.user.upsert({
    where: { email: "sara@example.com" },
    update: {},
    create: {
      email: "sara@example.com",
      name: "سارا احمدی",
      password: customerPassword,
      role: "CUSTOMER",
    },
  });

  // ---------- دسته‌بندی‌ها (تک‌درخت -- جنسیت اینجا هیچ نقشی نداره) ----------
  const giyim = await prisma.category.upsert({
    where: { slug: "clothing" },
    update: {},
    create: { name: "پوشاک", slug: "clothing" },
  });

  const childCategoryData = [
    { name: "تیشرت", slug: "tshirt" },
    { name: "پیراهن", slug: "shirt" },
    { name: "شلوار", slug: "pants" },
    { name: "مانتو و شومیز", slug: "manto-shomiz" },
  ];
  const children = {};
  for (const c of childCategoryData) {
    children[c.slug] = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: { ...c, parentId: giyim.id },
    });
  }

  const topLevelData = [
    { name: "کفش", slug: "shoes" },
    { name: "اکسسوری", slug: "accessories" },
    { name: "لوازم برقی", slug: "electronics" },
    { name: "لوازم خانه و آشپزخانه", slug: "home-kitchen" },
  ];
  const topLevel = {};
  for (const c of topLevelData) {
    topLevel[c.slug] = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: c,
    });
  }

  // زیردسته‌های جزئی‌تر (برای نمایش «Giyim/Ayakkabı/Aksesuar & Çanta» با ردیف‌های
  // زیرشون توی مگامنو، دقیقاً مثل ترندیول -- بدون این‌ها، کفش/اکسسوری هیچ زیردسته‌ای
  // برای نمایش زیر ستون‌شون نداشتن)
  const extraChildData = [
    { name: "لباس مجلسی", slug: "dress", parent: giyim },
    { name: "کت و ژاکت", slug: "jacket", parent: giyim },
    { name: "کفش کتانی", slug: "sneakers", parent: topLevel["shoes"] },
    { name: "کفش رسمی", slug: "formal-shoes", parent: topLevel["shoes"] },
    { name: "کفش پاشنه‌دار", slug: "heels", parent: topLevel["shoes"] },
    { name: "صندل", slug: "sandals", parent: topLevel["shoes"] },
    { name: "کیف", slug: "bags", parent: topLevel["accessories"] },
    { name: "ساعت", slug: "watches", parent: topLevel["accessories"] },
    { name: "جواهرات", slug: "jewelry", parent: topLevel["accessories"] },
    { name: "روسری و شال", slug: "scarves", parent: topLevel["accessories"] },
  ];
  const extraChildren = {};
  for (const c of extraChildData) {
    extraChildren[c.slug] = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: { name: c.name, slug: c.slug, parentId: c.parent.id },
    });
  }
  console.log("۱۹ دسته‌بندی (تک‌درخت، با زیردسته‌های جزئی‌تر) آماده شد.");

  // ---------- گروه ویژگی سایز + ویژگی‌ها ----------
  const sizeGroup = await prisma.attributeGroup.upsert({
    where: { name: "سایز" },
    update: {},
    create: { name: "سایز" },
  });

  const sizeClothingAttr = await prisma.attribute.upsert({
    where: { name: "سایز لباس" },
    update: {},
    create: { name: "سایز لباس", groupId: sizeGroup.id },
  });
  const sizeShoesAttr = await prisma.attribute.upsert({
    where: { name: "سایز کفش" },
    update: {},
    create: { name: "سایز کفش", groupId: sizeGroup.id },
  });
  const colorAttr = await prisma.attribute.upsert({
    where: { name: "رنگ" },
    update: {},
    create: { name: "رنگ" },
  });
  // «جنسیت» یک Attribute معمولیه، دقیقاً مثل رنگ و سایز -- نه یک Category
  const genderAttr = await prisma.attribute.upsert({
    where: { name: "جنسیت" },
    update: {},
    create: { name: "جنسیت" },
  });

  // ویژگی‌های واقعی و کاربردی که برای کاتالوگ فعلی مُداشاپ معنی دارن (نه فیلترهای
  // مخصوص مارکت‌پلیس مثل «نوع فروشنده» که برای فروشگاه تک‌فروشنده بی‌ربطن)
  const materialAttr = await prisma.attribute.upsert({
    where: { name: "جنس" },
    update: {},
    create: { name: "جنس" },
  });
  const patternAttr = await prisma.attribute.upsert({
    where: { name: "الگو" },
    update: {},
    create: { name: "الگو" },
  });
  const collarAttr = await prisma.attribute.upsert({
    where: { name: "نوع یقه" },
    update: {},
    create: { name: "نوع یقه" },
  });
  const sleeveAttr = await prisma.attribute.upsert({
    where: { name: "نوع آستین" },
    update: {},
    create: { name: "نوع آستین" },
  });
  const seasonAttr = await prisma.attribute.upsert({
    where: { name: "فصل" },
    update: {},
    create: { name: "فصل" },
  });

  async function ensureValues(attributeId, values) {
    for (let i = 0; i < values.length; i++) {
      await prisma.attributeValue.upsert({
        where: { attributeId_value: { attributeId, value: values[i] } },
        update: { order: i },
        create: { attributeId, value: values[i], order: i },
      });
    }
  }
  await ensureValues(sizeClothingAttr.id, ["S", "M", "L", "XL"]);
  await ensureValues(sizeShoesAttr.id, ["37", "38", "39", "40", "41", "42", "43"]);
  await ensureValues(colorAttr.id, [
    "سفید", "مشکی", "آبی", "قرمز", "بژ", "طوسی", "سرمه‌ای", "صورتی", "قهوه‌ای",
  ]);
  await ensureValues(genderAttr.id, ["زنانه", "مردانه", "یونیسکس"]);
  await ensureValues(materialAttr.id, ["نخ", "کتان", "دنیم", "چرم طبیعی", "حریر", "مش تنفس‌پذیر", "پلی‌استر"]);
  await ensureValues(patternAttr.id, ["ساده", "راه‌راه", "چاپی", "طرح‌دار"]);
  await ensureValues(collarAttr.id, ["یقه گرد", "یقه‌دار", "یقه هفت", "بدون یقه"]);
  await ensureValues(sleeveAttr.id, ["آستین کوتاه", "آستین بلند", "بدون آستین"]);
  await ensureValues(seasonAttr.id, ["تابستانه", "زمستانه", "چهارفصل"]);

  // ---------- اتصال ویژگی به دسته‌بندی (fixedValue همیشه null) ----------
  async function linkCategoryAttr(categoryId, attributeId) {
    await prisma.categoryAttribute.upsert({
      where: { categoryId_attributeId: { categoryId, attributeId } },
      update: {},
      create: { categoryId, attributeId },
    });
  }
  for (const attrId of [genderAttr.id, sizeClothingAttr.id, colorAttr.id, materialAttr.id, patternAttr.id, seasonAttr.id]) {
    await linkCategoryAttr(giyim.id, attrId);
  }
  for (const attrId of [genderAttr.id, sizeShoesAttr.id, colorAttr.id, materialAttr.id, seasonAttr.id]) {
    await linkCategoryAttr(topLevel["shoes"].id, attrId);
  }
  for (const attrId of [genderAttr.id, colorAttr.id, materialAttr.id]) {
    await linkCategoryAttr(topLevel["accessories"].id, attrId);
  }
  await linkCategoryAttr(topLevel["electronics"].id, colorAttr.id);
  // لوازم خانه و آشپزخانه عمداً به هیچ ویژگی‌ای وصل نمی‌شه

  // نوع یقه/آستین فقط برای دسته‌هایی معنی داره که واقعاً یقه/آستین دارن
  // (شلوار/کیف/کفش نه) -- برای همین مستقیم به همون زیردسته‌ها وصل می‌شن، نه به ریشه‌ی پوشاک
  for (const attrId of [collarAttr.id, sleeveAttr.id]) {
    await linkCategoryAttr(children["tshirt"].id, attrId);
    await linkCategoryAttr(children["shirt"].id, attrId);
    await linkCategoryAttr(extraChildren["dress"].id, attrId);
  }
  await linkCategoryAttr(children["manto-shomiz"].id, sleeveAttr.id);

  // ---------- برندها ----------
  const mudaBrand = await prisma.brand.upsert({
    where: { name: "مُداشاپ" },
    update: {},
    create: { name: "مُداشاپ" },
  });
  const parsianBrand = await prisma.brand.upsert({
    where: { name: "پارسیان‌پوش" },
    update: {},
    create: { name: "پارسیان‌پوش" },
  });
  console.log("برندهای نمونه آماده شد.");

  // ---------- محصولات نمونه ----------
  const img = (id) => `https://images.unsplash.com/${id}?w=600`;

  async function ensureProduct({ slug, title, description, brandId, basePrice, discount = 0, categoryId, images, attributeIds, specs = [] }) {
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) return existing;

    const product = await prisma.product.create({
      data: {
        title,
        slug,
        description,
        brandId: brandId ?? null,
        basePrice,
        discount,
        images: JSON.stringify(images),
        categoryId,
      },
    });

    if (attributeIds.length) {
      await prisma.productAttribute.createMany({
        data: attributeIds.map((attributeId) => ({ productId: product.id, attributeId })),
      });
    }
    for (const s of specs) {
      await prisma.productSpecification.create({
        data: { productId: product.id, label: s.label, value: s.value, order: s.order ?? 0 },
      });
    }
    return product;
  }

  async function ensureVariant(productId, sku, stock, values) {
    const existing = await prisma.productVariant.findUnique({ where: { sku } });
    if (existing) return existing;
    return prisma.productVariant.create({
      data: {
        productId,
        sku,
        stock,
        priceDiff: 0,
        values: { create: values.map(([attribute, value]) => ({ attribute, value })) },
      },
    });
  }

  // ۱. تیشرت یقه‌گرد زنانه
  const p1 = await ensureProduct({
    slug: "womens-basic-tshirt",
    title: "تیشرت یقه‌گرد زنانه ساده",
    description: "تیشرت نخی ساده و راحت با بافت نخ پنبه ۱۰۰٪، مناسب پوشیدنی روزمره.",
    brandId: mudaBrand.id,
    basePrice: 320000,
    discount: 15,
    categoryId: children["tshirt"].id,
    images: [img("photo-1521572163474-6864f9cf17ab")],
    attributeIds: [genderAttr.id, sizeClothingAttr.id, colorAttr.id, materialAttr.id, patternAttr.id, collarAttr.id, sleeveAttr.id, seasonAttr.id],
    specs: [{ label: "جنس", value: "نخ پنبه ۱۰۰٪" }, { label: "کشور سازنده", value: "ایران" }],
  });
  for (const [size, color, stock] of [["S", "سفید", 10], ["M", "سفید", 14], ["L", "سفید", 6], ["S", "مشکی", 9], ["M", "مشکی", 0], ["L", "مشکی", 4]]) {
    await ensureVariant(p1.id, `WTSHIRT-${size}-${color}`, stock, [["سایز لباس", size], ["رنگ", color], ["جنسیت", "زنانه"], ["جنس", "نخ"], ["الگو", "ساده"], ["نوع یقه", "یقه گرد"], ["نوع آستین", "آستین کوتاه"], ["فصل", "تابستانه"]]);
  }

  // ۲. تیشرت مردانه کلاسیک
  const p2 = await ensureProduct({
    slug: "mens-classic-tshirt",
    title: "تیشرت مردانه کلاسیک",
    description: "تیشرت کلاسیک آستین‌کوتاه با پارچه‌ی نخی سنگین، دوخت مستحکم برای استفاده روزانه.",
    brandId: parsianBrand.id,
    basePrice: 280000,
    categoryId: children["tshirt"].id,
    images: [img("photo-1521572267360-ee0c2909d518")],
    attributeIds: [genderAttr.id, sizeClothingAttr.id, colorAttr.id, materialAttr.id, patternAttr.id, collarAttr.id, sleeveAttr.id, seasonAttr.id],
  });
  for (const [size, color, stock] of [["M", "سفید", 8], ["L", "سفید", 5], ["XL", "سفید", 0], ["M", "مشکی", 12], ["L", "مشکی", 7], ["XL", "مشکی", 3]]) {
    await ensureVariant(p2.id, `MTSHIRT-${size}-${color}`, stock, [["سایز لباس", size], ["رنگ", color], ["جنسیت", "مردانه"], ["جنس", "نخ"], ["الگو", "ساده"], ["نوع یقه", "یقه گرد"], ["نوع آستین", "آستین کوتاه"], ["فصل", "چهارفصل"]]);
  }

  // ۳. تیشرت اورسایز یونیسکس
  const p3 = await ensureProduct({
    slug: "unisex-oversized-tshirt",
    title: "تیشرت اورسایز یونیسکس",
    description: "تیشرت اورسایز با برش راحت، مناسب هر دو جنسیت، ترند استریت‌ور.",
    brandId: mudaBrand.id,
    basePrice: 350000,
    discount: 20,
    categoryId: children["tshirt"].id,
    images: [img("photo-1503341504253-dff4815485f1")],
    attributeIds: [genderAttr.id, sizeClothingAttr.id, colorAttr.id, materialAttr.id, patternAttr.id, collarAttr.id, sleeveAttr.id, seasonAttr.id],
  });
  for (const [size, color, stock] of [["M", "مشکی", 15], ["L", "مشکی", 10], ["XL", "مشکی", 5], ["M", "سرمه‌ای", 6], ["L", "سرمه‌ای", 0], ["XL", "سرمه‌ای", 4]]) {
    await ensureVariant(p3.id, `UTSHIRT-${size}-${color}`, stock, [["سایز لباس", size], ["رنگ", color], ["جنسیت", "یونیسکس"], ["جنس", "نخ"], ["الگو", "ساده"], ["نوع یقه", "یقه گرد"], ["نوع آستین", "آستین کوتاه"], ["فصل", "چهارفصل"]]);
  }

  // ۴. پیراهن کتان کلاسیک مردانه (همون اسلاگ قبلی حفظ شده)
  const p4 = await ensureProduct({
    slug: "classic-linen-shirt",
    title: "پیراهن کتان کلاسیک مردانه",
    description: "پیراهن کتان با کیفیت بالا، مناسب استفاده روزمره و رسمی. دوخت دست‌ساز مزون مُداشاپ.",
    brandId: mudaBrand.id,
    basePrice: 890000,
    discount: 10,
    categoryId: children["shirt"].id,
    images: [img("photo-1602810318383-e386cc2a3ccf")],
    attributeIds: [genderAttr.id, sizeClothingAttr.id, colorAttr.id, materialAttr.id, patternAttr.id, collarAttr.id, sleeveAttr.id, seasonAttr.id],
    specs: [{ label: "جنس", value: "کتان خالص" }, { label: "کشور سازنده", value: "ترکیه" }],
  });
  for (const [size, color, stock] of [["M", "سفید", 12], ["L", "سفید", 8], ["M", "آبی", 5], ["L", "آبی", 0]]) {
    await ensureVariant(p4.id, `SHIRT-${size}-${color}`, stock, [["سایز لباس", size], ["رنگ", color], ["جنسیت", "مردانه"], ["جنس", "کتان"], ["الگو", "ساده"], ["نوع یقه", "یقه‌دار"], ["نوع آستین", "آستین بلند"], ["فصل", "چهارفصل"]]);
  }

  // ۵. پیراهن حریر زنانه
  const p5 = await ensureProduct({
    slug: "womens-silk-shirt",
    title: "پیراهن حریر زنانه",
    description: "پیراهن حریر سبک با افتادگی زیبا، مناسب مهمانی و محیط کار.",
    brandId: parsianBrand.id,
    basePrice: 610000,
    discount: 5,
    categoryId: extraChildren["dress"].id,
    images: [img("photo-1551163943-3f6a855d1153")],
    attributeIds: [genderAttr.id, sizeClothingAttr.id, colorAttr.id, materialAttr.id, patternAttr.id, collarAttr.id, sleeveAttr.id, seasonAttr.id],
  });
  for (const [size, color, stock] of [["S", "صورتی", 7], ["M", "صورتی", 9], ["L", "صورتی", 0], ["S", "سفید", 6], ["M", "سفید", 10], ["L", "سفید", 3]]) {
    await ensureVariant(p5.id, `WSHIRT-${size}-${color}`, stock, [["سایز لباس", size], ["رنگ", color], ["جنسیت", "زنانه"], ["جنس", "حریر"], ["الگو", "ساده"], ["نوع یقه", "بدون یقه"], ["نوع آستین", "بدون آستین"], ["فصل", "چهارفصل"]]);
  }

  // ۶. شلوار جین مردانه
  const p6 = await ensureProduct({
    slug: "mens-denim-jeans",
    title: "شلوار جین مردانه",
    description: "شلوار جین کلاسیک با پارچه‌ی ضخیم و دوخت مقاوم، مناسب استفاده روزمره.",
    brandId: mudaBrand.id,
    basePrice: 540000,
    categoryId: children["pants"].id,
    images: [img("photo-1542272604-787c3835535d")],
    attributeIds: [genderAttr.id, sizeClothingAttr.id, colorAttr.id, materialAttr.id, patternAttr.id, seasonAttr.id],
  });
  for (const [size, color, stock] of [["M", "آبی", 11], ["L", "آبی", 9], ["XL", "آبی", 2], ["M", "مشکی", 6], ["L", "مشکی", 4], ["XL", "مشکی", 0]]) {
    await ensureVariant(p6.id, `JEANS-${size}-${color}`, stock, [["سایز لباس", size], ["رنگ", color], ["جنسیت", "مردانه"], ["جنس", "دنیم"], ["الگو", "ساده"], ["فصل", "چهارفصل"]]);
  }

  // ۷. مانتو اسپرت زنانه (کاندید حراج فلش)
  const p7 = await ensureProduct({
    slug: "womens-sporty-manteau",
    title: "مانتو اسپرت زنانه",
    description: "مانتو اسپرت سبک با پارچه‌ی نخی، مناسب استفاده روزمره و دانشگاه.",
    brandId: parsianBrand.id,
    basePrice: 780000,
    discount: 25,
    categoryId: children["manto-shomiz"].id,
    images: [img("photo-1445205170230-053b83016050")],
    attributeIds: [genderAttr.id, sizeClothingAttr.id, colorAttr.id, materialAttr.id, patternAttr.id, sleeveAttr.id, seasonAttr.id],
  });
  for (const [size, color, stock] of [["S", "مشکی", 8], ["M", "مشکی", 12], ["L", "مشکی", 5], ["S", "بژ", 4], ["M", "بژ", 0], ["L", "بژ", 3]]) {
    await ensureVariant(p7.id, `MANTO-${size}-${color}`, stock, [["سایز لباس", size], ["رنگ", color], ["جنسیت", "زنانه"], ["جنس", "نخ"], ["الگو", "ساده"], ["نوع آستین", "آستین بلند"], ["فصل", "چهارفصل"]]);
  }

  // ۸. کفش کتانی زنانه
  const p8 = await ensureProduct({
    slug: "womens-sneakers",
    title: "کفش کتانی زنانه",
    description: "کفش کتانی سبک و راحت با کفی طبی، مناسب پیاده‌روی روزانه.",
    brandId: mudaBrand.id,
    basePrice: 1250000,
    categoryId: extraChildren["sneakers"].id,
    images: [img("photo-1595950653106-6c9ebd614d3a")],
    attributeIds: [genderAttr.id, sizeShoesAttr.id, colorAttr.id, materialAttr.id, seasonAttr.id],
    specs: [{ label: "جنس رویه", value: "مش تنفس‌پذیر" }],
  });
  for (const [size, color, stock] of [["37", "سفید", 6], ["38", "سفید", 10], ["39", "سفید", 4], ["37", "صورتی", 0], ["38", "صورتی", 5], ["39", "صورتی", 2]]) {
    await ensureVariant(p8.id, `WSNEAKER-${size}-${color}`, stock, [["سایز کفش", size], ["رنگ", color], ["جنسیت", "زنانه"], ["جنس", "مش تنفس‌پذیر"], ["فصل", "چهارفصل"]]);
  }

  // ۹. کفش رسمی مردانه چرم
  const p9 = await ensureProduct({
    slug: "mens-leather-formal-shoes",
    title: "کفش رسمی مردانه چرم",
    description: "کفش رسمی چرم طبیعی با دوخت دستی، مناسب محیط اداری و مراسم.",
    brandId: parsianBrand.id,
    basePrice: 1890000,
    discount: 10,
    categoryId: extraChildren["formal-shoes"].id,
    images: [img("photo-1614252369475-531eba835eb1")],
    attributeIds: [genderAttr.id, sizeShoesAttr.id, colorAttr.id, materialAttr.id, seasonAttr.id],
    specs: [{ label: "جنس", value: "چرم طبیعی" }],
  });
  for (const [size, color, stock] of [["40", "مشکی", 7], ["41", "مشکی", 9], ["42", "مشکی", 5], ["43", "مشکی", 0], ["40", "قهوه‌ای", 3], ["41", "قهوه‌ای", 6], ["42", "قهوه‌ای", 4]]) {
    await ensureVariant(p9.id, `MFORMAL-${size}-${color}`, stock, [["سایز کفش", size], ["رنگ", color], ["جنسیت", "مردانه"], ["جنس", "چرم طبیعی"], ["فصل", "چهارفصل"]]);
  }

  // ۱۰. کیف دستی چرم زنانه (بدون سایز، فقط رنگ + جنسیت)
  const p10 = await ensureProduct({
    slug: "womens-leather-handbag",
    title: "کیف دستی چرم زنانه",
    description: "کیف دستی چرم طبیعی با طراحی ساده و کاربردی، مناسب استفاده روزانه.",
    brandId: mudaBrand.id,
    basePrice: 970000,
    categoryId: extraChildren["bags"].id,
    images: [img("photo-1584917865442-de89df76afd3")],
    attributeIds: [genderAttr.id, colorAttr.id, materialAttr.id],
  });
  for (const [color, stock] of [["مشکی", 9], ["قهوه‌ای", 6], ["بژ", 0]]) {
    await ensureVariant(p10.id, `BAG-${color}`, stock, [["رنگ", color], ["جنسیت", "زنانه"], ["جنس", "چرم طبیعی"]]);
  }

  // ۱۱. ساعت هوشمند اسپرت -- بدون جنسیت اصلاً
  const p11 = await ensureProduct({
    slug: "sporty-smartwatch",
    title: "ساعت هوشمند اسپرت",
    description: "ساعت هوشمند با باتری تا ۷ روز، مقاوم در برابر آب و مناسب ورزش.",
    brandId: mudaBrand.id,
    basePrice: 2450000,
    discount: 15,
    categoryId: topLevel["electronics"].id,
    images: [img("photo-1523275335684-37898b6baf30")],
    attributeIds: [colorAttr.id],
    specs: [{ label: "باتری", value: "تا ۷ روز" }, { label: "مقاومت آب", value: "IP68" }],
  });
  for (const [color, stock] of [["مشکی", 20], ["طوسی", 14]]) {
    await ensureVariant(p11.id, `WATCH-${color}`, stock, [["رنگ", color]]);
  }

  // ۱۲. اتو بخار خانگی -- بدون برند، بدون جنسیت، بدون هیچ ویژگی‌ای
  const p12 = await ensureProduct({
    slug: "home-steam-iron",
    title: "اتو بخار خانگی",
    description: "اتوی بخار با قدرت بخار بالا، مناسب لباس‌های ضخیم و نازک.",
    brandId: null,
    basePrice: 1180000,
    categoryId: topLevel["home-kitchen"].id,
    images: [img("photo-1626806787461-102c1bfaaea1")],
    attributeIds: [],
  });
  await ensureVariant(p12.id, "IRON-STD", 18, []);

  console.log("۱۲ محصول نمونه (با جنسیت متنوع، و بدون جنسیت برای لوازم برقی/خانه) آماده شد.");

  // ---------- کدهای تخفیف نمونه ----------
  await prisma.coupon.upsert({
    where: { code: "WELCOME10" },
    update: {},
    create: { code: "WELCOME10", type: "PERCENT", value: 10, minOrderAmount: 200000 },
  });
  await prisma.coupon.upsert({
    where: { code: "FREESHIP" },
    update: {},
    create: { code: "FREESHIP", type: "FREE_SHIP", value: 0 },
  });
  console.log("کدهای تخفیف نمونه (WELCOME10, FREESHIP) آماده شد.");

  // ---------- حراج فلش نمونه (روی مانتو اسپرت زنانه، ۲۴ ساعت آینده) ----------
  const existingFlashSale = await prisma.flashSale.findFirst({
    where: { productId: p7.id, isActive: true },
  });
  if (!existingFlashSale) {
    await prisma.flashSale.create({
      data: {
        productId: p7.id,
        discountPercent: 35,
        stock: 10,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    console.log("حراج فلش نمونه (روی مانتو اسپرت زنانه، ۳۵٪ تخفیف، ۲۴ ساعته) ساخته شد.");
  }

  // ---------- کمپین نمونه (پارسیان‌پوش، یک هفته آینده) ----------
  await prisma.campaign.upsert({
    where: { slug: "parsian-poosh-summer" },
    update: {},
    create: {
      title: "کمپین تابستانه پارسیان‌پوش",
      slug: "parsian-poosh-summer",
      brandId: parsianBrand.id,
      bannerImage: img("photo-1441984904996-e0b6ba687e04"),
      description: "تخفیف‌های ویژه روی محصولات منتخب پارسیان‌پوش، فقط یک هفته.",
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  console.log("کمپین نمونه (پارسیان‌پوش) آماده شد.");

  console.log("✅ seed کامل شد.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
