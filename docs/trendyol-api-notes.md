# یادداشت‌های تحقیق روی API ترندیول

این فایل مستندسازی مداومِ یافته‌های ما درباره‌ی اندپوینت‌های ترندیول (رسمی و غیررسمی) هست، برای استفاده‌ی آینده در توسعه‌ی مداشاپ. هر بخش تاریخ/منبع کشفش رو داره تا معلوم باشه چقدر قابل‌اتکاست.

منابع تا الان: `trendyol_parser` (۲.۱-۲.۴)، `trendyol-scrapper` (۲.۵)، `trendyol-category-scraper` (۲.۶)، `TrendPress` پلاگین وردپرس (۲.۷)، `trendyol-clone` که پاسخ خام واقعی داشت (۲.۸ -- **معتبرترین منبع، چون از رو کد حدس نزده، خودِ داده‌ی واقعیه**)، و `BOT` یه پروژه‌ی Node.js (۲.۹).

---

## ۱. اندپوینت‌های رسمی «Seller Integration API» (مستندشده در developers.trendyol.com)

Base URL: `https://apigw.trendyol.com`

نیازی به auth ندارن (public):

| اندپوینت | توضیح |
|---|---|
| `GET /integration/product/brands` | لیست کامل برندها |
| `GET /integration/product/brands/by-name?name=` | جستجوی فازی برند (مناسب autocomplete) |
| `GET /integration/product/product-categories` | درخت کامل دسته‌بندی (حجیم، بدون pagination) |
| `GET /integration/product/categories/{categoryId}/attributes` | ویژگی‌های هر دسته‌بندی |

اندپوینت‌های سطح فروشنده (نیاز به auth با Basic Token، از `TRENDYOL_SELLER_ID`/`TRENDYOL_TOKEN`):
- `GET /integration/product/sellers/{sellerId}/products?page&size&approved` — لیست محصولات فروشنده (`data.content[]`)
- `GET /integration/order/sellers/{sellerId}/orders?startDate&endDate&size&page` — لیست سفارش‌ها (`data.content[]`, هر خط `line.barcode`, `line.commission`)

نکته‌ی معماری مهم: توی این API، **«Beden» (سایز) همیشه `varianter:true`** و **«Renk» (رنگ) همیشه `varianter:false, slicer:true`** — یعنی ترندیول رنگ رو یه محور SKU جدا از سایز می‌بینه؛ این با مدل چندمحوری `ProductVariant` خودمون فرق داره.

ما فعلاً API Key/Secret فروشنده نداریم، پس این بخش عملاً در دسترسمون نیست.

---

## ۲. اندپوینت‌های داخلی/غیررسمی «Discovery»

⚠️ **این‌ها هیچ‌کدوم مستند رسمی ندارن.** این‌ها همون سرویس‌هایی هستن که خودِ سایت trendyol.com (نه پنل فروشنده) پشت‌صحنه صداشون می‌زنه. بدون auth کار می‌کنن، ولی چون خارج از API رسمی Partner هستن، ممکنه بدون اطلاع قبلی تغییر کنن یا استفاده‌ی گسترده ازشون با ToS ترندیول در تضاد باشه. فقط برای فهمیدن ساختار داده و الهام‌گرفتن مفیدن، نه برای اتکای پروداکشن.

### ۲.۱ جستجو/لیست محصولات (Infinite Scroll) — پایه (از `trendyol_parser`)

```
GET https://public.trendyol.com/discovery-web-searchgw-service/v2/api/infinite-scroll/sr
```
پارامترها: `mid=`/`wb=` (فروشنده/برند)، `pi=` (صفحه)، `offset=` (۲۴تایی)، بقیه اختیاری‌ان. خروجی و فیلدهای دقیق رو در **۲.۸** ببین.

### ۲.۲ جزئیات محصول

```
GET https://public.trendyol.com/discovery-web-productgw-service/api/productDetail/{productId}?sav=false&storefrontId=1&culture=tr-TR&linearVariants=true&isLegalRequirementConfirmed=false
```
یه فرمت جایگزین (بخش ۲.۷): `?merchantId={merchantId}&campaignId={campaignId}` — این دو مقدار مستقیم روی آبجکت محصول توی پاسخ لیست هست.

### ۲.۳ لیست اسم ویژگی‌های واقعی ترندیول (از `attributes[].key.name`)

```
Alt-Üst Takım، Askı، Astar Durumu، Astar Materyali، Ayakkabı Tabanı،
Baskı/Nakış Tekniği، Bağlama Şekli، Beden، Bel، Bilek Stili، Boy، Boy / Ölçü،
Boyut، Boyut/Ebat، Branş، Cam Materyali، Cam Renk، Cam Tipi، Cep، Cep Sayısı،
Cep Tipi، Deri Kalitesi، Desen، Dokuma Tipi، Dolgu Materyali، Dolgu Tekniği،
D�ş Materyal، Ek Özellik، Ekartman، Hacim، Isı Teknolojisi، Kalınlık، Kalıp،
Kap، Kapama Şekli، Kapasite، Kemer/Kuşak Durumu، Kesim، Kol Boyu، Kol Tipi،
Koleksiyon، Kordon Durumu، Kullanım Alanı، Kullanım Amacı، Kumaş Teknolojisi،
Kumaş Tipi، Kumaş Özellik، Kumaş/İplik Özellik، Laptop Çantası Boyutu،
Materyal، Model، Okula Dönüş، Ortam، Paket İçeriği، Parça Sayısı، Paça Boyu،
Paça Tipi، Persona، Saya Materyali، Siluet، Spor Branşı، Spor Türü، Stil،
Sürdürülebilir، Sürdürülebilirlik Detayı، Taban، Taban Materyali،
Taban Teknolojisi، Taban Tipi، Teknik، Tip، Topuk Boyu، Topuk Tipi، Yaka Tipi،
Zemin، Çerçeve Formu، Çerçeve Materyali، Çerçeve Renk، Çerçeve Tipi، Çeşit،
Çivi Tipi، Özellik، Ürün Detayı، Ürün Tipi، Üst Siluet، İzolasyon،
İç Taban Materyali، İçerik
```

### ۲.۴ اندپوینت فیلترهای جستجو (هنوز تست نشده)

```
GET https://api.trendyol.com/websearchgw/api/filter
```
حدس: facetهای فیلتر (برند، بازه‌قیمت، ویژگی). دامنه‌ش جداست: `api.trendyol.com` نه `public.trendyol.com`.

### ۲.۵ نسخه‌ی دسته‌بندی‌محور (از `trendyol-scrapper`)

```
GET .../infinite-scroll/{category-slug}-x-c{categoryId}?pi={page}&...&offset={offset}&channelId=1
```
`offset` واقعی از `result.offset` پاسخ قبلی میاد. این پروژه هدرهای واقع‌گرایانه (`user-agent`, `origin`) فرستاده.

### ۲.۶ ساده‌ترین نسخه — جستجوی آزاد با کلمه‌کلیدی (از `trendyol-category-scraper`)

```
GET .../infinite-scroll/sr?q={keyword}&pi={page}
```
پارامترهای اضافه اختیاری‌ان. صفحه‌بندی ساده: `pi` رو زیاد کن تا جواب کمتر از ۲۴ تا برگرده. بدون هیچ هدر خاصی هم جواب گرفته بود (تناقض با ۲.۵).

### ۲.۷ کشف‌های PHP/وردپرس (`TrendPress`)

- یه مسیر سوم: `filter/{path}&pi=` (صفحه‌بندی ۲۵تایی)
- `merchantId`/`campaignId` مستقیم روی آبجکت محصول توی پاسخ لیست هستن
- ادعا می‌کنه `variant.price.sellingPrice.value` (آبجکت با `.value`) — **این با ۲.۸ در تناقضه؛ ۲.۸ رو مرجع بدون**

### ۲.۸ 🏆 زمین حقیقت واقعی — پاسخ خام واقعی ذخیره‌شده (از `trendyol-clone`)

این پروژه توی `util/extract_products/original/` سه‌تا **پاسخ خام واقعی ذخیره‌شده** داشت (`kadin_response.json`, `erkek_response.json`, `annecocuk_response.json`) — برخلاف بقیه که از رو کد حدس می‌زدیم، این‌جا خودِ داده‌ی واقعیه.

**۱. اندپوینت جستجو (کامنت خودِ کد):**
```python
# Search API of TY
url = f"https://public.trendyol.com/discovery-web-searchgw-service/v2/api/filter/sr?q={query}&pi={page_index}"
```

**۲. ✅ حل قطعی شکل فیلد قیمت:** `price` یه آبجکت تخت با اعداد خامه، بدون `.value`:
```json
"price": { "buyingPrice": 0, "discountedPrice": 139, "originalPrice": 139, "sellingPrice": 139 }
```
هم توی سطح لیست، هم توی `variants[].price`. نسخه‌ی PHP (۲.۷) با `->value` احتمالاً قدیمی/اشتباه بوده.

**۳. ✅ حل قطعی فرمت `categoryHierarchy`:** مقدار واقعی `"Şampuan/Kozmetik & Kişisel Bakım/Saç Bakım"` — ترتیب از **خاص به عام** (برگ اول، ریشه آخر).

**۴. لیست کامل فیلدهای واقعی `result.products[]`:**
```
id, name, images[], imageAlt, brand{id,name}, tax, ratingScore{averageRating,totalCount},
showSexualContent, productGroupId, hasReviewPhoto, cardType, sections, variants[],
categoryHierarchy, categoryId, categoryName, url, merchantId, campaignId, price{...},
promotions[], rushDeliveryDuration, freeCargo, campaignName, listingId, winnerVariant,
itemNumber, discountedPriceInfo, hasVideoContent, hasCrossPromotion, hasCollectableCoupon,
sameDayShipping, isLegalRequirementConfirmed, badges[], stamps[]
```
یعنی **نیازی به `productDetail` نیست** حتی برای وریانت‌ها.

**۵. ریبون‌های تبلیغاتی (En Çok Satan، 3 Al 2 Öde):** `badges[]` → `{type, title}`؛ `stamps[]` → ریبون تصویری واقعی (`imageUrl`, `position`)؛ `promotions[]` → پروموشن نام‌دار.

**۶. ⚠️ هیچ فیلد صریح «gender» روی خودِ محصول نیست.**

**۷. 🎯 راه‌حل تست‌شده برای هدف زنانه/مردانه:** مستقیم کلمه‌ی ترکی رو سرچ کن:
```
filter/sr?q=kadın&pi=1   → محصولات «زنانه»
filter/sr?q=erkek&pi=1   → محصولات «مردانه»
```
تست شد: `q=kadın` واقعاً زنانه برمی‌گردونه (شامپو، عطر زنانه، پیژامه)، `q=erkek` مردانه (تیشرت، سویت‌شرت). ⚠️ نویز داره چون جستجوی متنیه نه فیلتر ساختاریافته — برای دقت بیشتر عبارت رو مشخص‌تر کن (`q=kadın giyim`).

### ۲.۹ دامنه‌ی جایگزین + توضیح خطای «بلاک شدی» (از یه پروژه‌ی Node.js/Express به اسم `BOT`)

**۱. یه دامنه‌ی دیگه هم کار می‌کنه (کامنت خودِ کد: «Çalışan endpoint»):**
```js
const SEARCH_URL = 'https://apigw.trendyol.com/discovery-web-searchgw-service/v2/api/infinite-scroll/sr';
```
یعنی هم `public.trendyol.com` هم `apigw.trendyol.com` همین مسیر رو دارن.

**۲. توضیح خطای «Sorry, you have been blocked» که موقع بازکردن مستقیم توی مرورگر گرفتیم:** این پروژه این هدرهای دقیق رو می‌فرسته (فقط User-Agent کافی نیست):
```
User-Agent, Accept, Accept-Language: tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7,
Origin: https://www.trendyol.com, Referer: https://www.trendyol.com/,
sec-ch-ua, sec-ch-ua-mobile, sec-ch-ua-platform,
sec-fetch-dest: empty, sec-fetch-mode: cors, sec-fetch-site: same-site
```
بدون این ترکیب کامل (خصوصاً `Referer` و `sec-fetch-*`)، یه لایه‌ی ضدبات بلاکش می‌کنه.

**۳. پارامترهای این نسخه:** `q`, `pi=1`, `culture=tr-TR`, `storefrontId=1`, `pId=0`.

**۴. فیلدهای جدید دیده‌شده:** `price.discountRatio`، `socialProof.favoriteCount.count` (رشته‌ست، نیاز به `parseInt`)، `merchantName` (رشته)، `freeCargo` (بولین).

**۵.** این پروژه از همین API برای «تحلیل رقبا و پیشنهاد SEO» هم استفاده می‌کنه — خارج از scope فعلی، فقط برای یادداشت آینده.

### ۲.۱۰ 🔥 به‌روزترین و معتبرترین منبع -- مستقیم از HTML زنده‌ی همین امروز (view-source واقعی صفحه‌ی `trendyol.com/sr?wc=82`)

Mehdi یه `view-source:` واقعی از صفحه‌ی «Giyim» (پوشاک، `https://www.trendyol.com/sr?wc=82`) فرستاد. این **تازه‌ترین و معتبرترین سند ماست** چون مستقیم از صفحه‌ی زنده‌ی همین امروزه (نه کد یه پروژه‌ی قدیمی‌تر). نتیجه‌ی مهم: **سرویس‌های داخلی ترندیول اسم عوض کرده‌اند/به‌روز شده‌اند** -- همه‌ی چیزهایی که توی ۲.۱ تا ۲.۹ با اسم `discovery-web-searchgw-service` یا `discovery-web-productgw-service` دیدیم، احتمالاً **قدیمی/منسوخ شده‌ان** و جایگزین جدیدشون این‌هاست:

```
SEARCH_GATEWAY_URL   = https://apigw.trendyol.com/discovery-sfint-search-service
CHECKOUT_GATEWAY_URL = https://apigw.trendyol.com/discovery-sfint-checkout-service
BROWSING_GATEWAY_URL = https://apigw.trendyol.com/discovery-sfint-browsing-service
PRODUCT_GATEWAY_URL  = https://apigw.trendyol.com/discovery-storefront-trproductgw-service
```
(این مقادیر مستقیم از خودِ `config` تعبیه‌شده توی صفحه اومدن -- دقیق‌ترین منبع ممکنه.)

**✅ جواب مستقیم به سوال Mehdi («میشه محصولات رو از داخل پیج واکشی کرد؟»): بله، قطعاً، و این بهترین روشیه که تا الان پیدا کردیم.**

**۱. چطور از خودِ HTML صفحه محصولات رو دربیاریم (بدون نیاز به AJAX/API جدا برای صفحه‌ی اول):**
داخل تگ `<script>` صفحه، یه خط این شکلیه:
```js
window["__single-search-result__PROPS"] = { ...یه آبجکت JSON حدود ۲۰۰ کیلوبایتی... };
```
کافیه:
1. صفحه رو fetch کنیم (`GET https://www.trendyol.com/sr?wc={categoryId}`)
2. متن HTML رو بگیریم، دنبال `window["__single-search-result__PROPS"]=` بگردیم
3. از اونجا تا قبل از `</script>` رو (با حذف `;` انتهایی) با `JSON.parse` بخونیم
4. `data.data.products` آرایه‌ی ۲۴تایی محصولات صفحه‌ی اوله

**۲. بهترین بخش -- خودِ پاسخ، URL دقیق صفحه‌ی بعدی رو بهمون می‌ده (دیگه نیازی به حدس‌زدن پارامتر نیست):**
```
data.data._links.next
```
مقدارش دقیقاً همینه:
```
https://apigw.trendyol.com/discovery-sfint-search-service/api/search/products/?promotionSearch=false&stickyShellNavigation=true&isDynamicRenderingAgent=false&channelId=1&subPathStrategy=no-subpath&wc=82&tyPlusStripViewEnabled=true&pi=2&pageSize=24
```
یعنی برای صفحه‌ی ۲ به بعد، فقط کافیه همین لینک `next` رو مستقیم `fetch` کنیم -- که خودش هم احتمالاً یه `_links.next` جدید برمی‌گردونه برای صفحه‌ی بعد از اون. `pageSize=24` صریحاً توی URL هست.

**۳. اندپوینت فیلترها هم بالاخره پیدا شد (جواب قطعی به سوال قدیمی بخش ۲.۴):**
```
data.searchAggregation._links.aggregation
```
مقدارش:
```
https://apigw.trendyol.com/discovery-sfint-search-service/api/search/aggregations?promotionSearch=false&...&wc=82&pi=1&pageSize=24
```
(توی این پاسخ خاص، خودِ `aggregation` آرایه‌ش خالی بود -- احتمالاً چون یه درخواست جدا لازم داره؛ ولی حداقل حالا مسیر دقیقش رو داریم.)

**۴. گزینه‌های مرتب‌سازی واقعی (پارامتر `sst=`)** -- از `data._links.sort[]`:
| مقدار `sst` | معنی |
|---|---|
| `SCORE` | مرتبط‌ترین (پیش‌فرض) |
| `PRICE_BY_ASC` | ارزان به گران |
| `PRICE_BY_DESC` | گران به ارزان |
| `MOST_RECENT` | جدیدترین |
| `BEST_SELLER` | پرفروش‌ترین |
| `MOST_FAVOURITE` | محبوب‌ترین |
| `MOST_RATED` | بیشترین امتیاز |

**۵. معنی پارامتر `wc=82` (که Mehdi دید وقتی «Giyim» رو کلیک کرد):**
`wc` = «Web Category ID». توی `resolvedQuery.filters[0]`:
```json
{"filterKey":"WebCategory","filterType":"LIST","filterField":"webCategoryIds","values":["82"]}
```
یعنی `wc` مستقیم شناسه‌ی دسته‌بندیه، نه اسلاگ متنی مثل چیزی که توی ۲.۵ دیدیم (`gida-ve-icecek-x-c103946`). این‌ها دو راه متفاوت برای همون کاری‌ان که یکی مسیر `trendyol.com/{slug}-x-c{id}` قدیمی‌تره و این یکی مستقیم `trendyol.com/sr?wc={id}` جدیدتره.

⚠️ **مهم برای هدف بخش ۳ (زنانه/مردانه):** `canonicalFilters` توی این پاسخ یه فیلد `genders: []` داره (خالی چون فیلتر جنسیت اعمال نشده بود) -- یعنی **احتمالاً یه پارامتر ساختاریافته‌ی واقعی برای جنسیت وجود داره** (نه فقط جستجوی متنی «kadın» که توی ۲.۸ پیشنهاد دادیم)! برای پیدا کردنش: کافیه Mehdi توی مرورگر خودش، روی فیلتر «Kadın»/«Erkek» (اگه توی صفحه‌ی دسته‌بندی پوشاک وجود داشته باشه) کلیک کنه و دوباره یه `view-source:` از URL نتیجه بفرسته -- اونجا دقیقاً می‌بینیم چه پارامتری به URL اضافه شد (مثلاً شاید `wc=82&gender=1` یا مشابهش).

**✅ حل شد (تست واقعی Mehdi روی `https://www.trendyol.com/sr?wg=1&wc=82`، `sr?wg=1`، و `sr?wg=2`):**
```json
{
  "filterKey": "WebGender",
  "filterType": "LIST",
  "filterField": "webGenderIds",
  "values": ["1"],
  "filters": [{"key": "1", "beautifiedName": "kadin", "name": "Kadın"}]
}
```
**`wg` = «Web Gender»** — تایید کامل و قطعی با ۳ تا تست جدا:

| پارامتر | جنسیت | تایید |
|---|---|---|
| `wg=1` | زنانه (Kadın) | ✅ هم ساختار پاسخ، هم اسم محصولات (کیف/پیراهن/دستبند زنانه) |
| `wg=2` | مردانه (Erkek) | ✅ هم ساختار پاسخ، هم اسم محصولات (پیراهن/تیشرت/پیژامه مردانه) |

و **`wg` مستقل از `wc` کار می‌کنه** — `sr?wg=1` (بدون هیچ `wc`) کاملاً درست جواب داد و `canonicalFilters.categories` خالی موند، یعنی این محصولات زنانه‌ی *کل* سایته، نه فقط یه دسته‌ی خاص:
```
https://www.trendyol.com/sr?wg=1          → همه‌ی محصولات زنانه ✅ تست‌شده
https://www.trendyol.com/sr?wg=2          → همه‌ی محصولات مردانه ✅ تست‌شده
https://www.trendyol.com/sr?wg=1&wc=82    → محصولات زنانه‌ی دسته‌ی «Giyim» ✅ تست‌شده
```

**۸. تایید یه پارامتر سوم: `wb` = «Web Brand»** (تست شد: `sr?wb=486&wg=1`):
```json
{"filterKey":"WebBrand","filterField":"webBrandIds","values":["486"],
 "filters":[{"key":"486","beautifiedName":"bershka","name":"Bershka"}]}
```
یعنی `wb=486` = برشکا، و **`wb`/`wc`/`wg` کاملاً مستقل و ترکیب‌پذیرن** -- `sr?wb=486&wg=1` دقیقاً محصولات زنانه‌ی برشکا رو داد (`total: 793`، خیلی دقیق‌تر از حالت کلی چون فیلترش تنگ‌تره). یعنی برای هر ترکیبی (برند+جنسیت، برند+دسته، هر سه با هم) می‌شه لینک ساخت -- دقیقاً چیزی که برای فیلد `Category.trendyolUrl` (یا حتی لینک ترندیول روی کمپین‌های برند در آینده) بهش نیاز داریم.





**۶. فیلدهای واقعی و به‌روز هر محصول در این نسخه (کمی متفاوت از ۲.۸، چون سرویس جدیدتره):**
```
boutiqueId, brand, webBrands, brandId, campaignId, merchantId, category{id,name},
contentId, discount{discountName}, id, image, images[], itemNumber, listingId, name,
price{current, currentText, discountedPrice, discountedPriceText, old, oldText,
      originalPrice, originalPriceText, currency, currencySymbol},
stamps, tagDetails, badges, stock, url, socialProof[], promotions[], freeCargo,
recommendedRetailPrice{...}, appPrice{codeName, discountPercentage, newPrice, oldPrice},
hasFlashSaleTag, hasFastDeliveryTag, priceLabels, singlePrice{...}, advert{adScore,cpc,...},
advertType, rushDelivery, sameDayShipping, nextDayDelivery, groupId, variantValue, variantId
```
نکته: اینجا `category` فقط `{id, name}` سطح برگه‌ست (نه رشته‌ی hierarchy مثل ۲.۸)، و `discount` عملاً فقط `discountName` داره -- قیمت واقعی و درصد تخفیف از روی `price.current` در برابر `price.originalPrice`/`price.discountedPrice` محاسبه می‌شه.

**۷. نکته‌ی دیگه:** بعضی محصولات `advert{cpc, adScore, advertId, ...}` دارن -- یعنی تبلیغ (اسپانسری) هستن. اگه محصولات ترندیول رو نمایش بدیم، بهتره این‌ها رو حذف یا مشخص کنیم (مثل «Sponsorlu» که توی اسکرین‌شات‌های قبلی دیده بودیم)، چون نمایش‌دادن جایگاه تبلیغاتی ترندیول توی سایت خودمون بی‌معنی/گمراه‌کننده‌ست.



**وضعیت فعلی مداشاپ:** دیتای «ترندیول» توی سایت ما همین الان صرفاً یه **شبیه‌سازیه** — از Fake Store API میاد (`src/lib/trendyol.ts`)، هیچ ربطی به ترندیول واقعی نداره و اصلاً فیلد `gender` هم نداره.

**✅ راه‌حل (بعد از ۲.۸):** مستقیم کلمه‌ی «kadın»/«erkek» رو با endpoint جستجو (`filter/sr?q=kadın` یا `infinite-scroll/sr?q=kadın`) بفرستیم — دیگه لازم نیست منتظر تست `userGenderId` بمونیم.

**برای رسیدن به هدف، این مراحل لازمه:**

## ۳. هدف باز: نمایش محصولات زنانه‌ی ترندیول موقع کلیک روی «زنانه»

**وضعیت فعلی مداشاپ:** دیتای «ترندیول» توی سایت ما همین الان صرفاً یه **شبیه‌سازیه** — از Fake Store API میاد (`src/lib/trendyol.ts`)، هیچ ربطی به ترندیول واقعی نداره و اصلاً فیلد `gender` هم نداره.

**✅✅✅ کاملاً حل شد و تست‌شده (۲.۱۰):** `wg=1` = زنانه، `wg=2` = مردانه، هر دو مستقل از `wc` کار می‌کنن. دیگه نیازی به جستجوی متنی نویزدار «kadın» یا حدس‌زدن `userGenderId` نیست.

**برای رسیدن به هدف، این مراحل لازمه:**

1. **جایگزینی `fetchTrendyolProducts` واقعی**: تابعی که صفحه‌ی `https://www.trendyol.com/sr?wg=1` (زنانه) یا `?wg=2` (مردانه) رو fetch کنه، `window["__single-search-result__PROPS"]` رو از HTML دربیاره (۲.۱۰.۱)، و `data.data.products` رو بخونه. برای صفحه‌ی بعدی از `data.data._links.next` استفاده کنه (۲.۱۰.۲) -- نیازی به `productDetail` جدا برای نمایش گرید نیست.
2. **معماری کش**: کش دوره‌ای (چند ساعت یک‌بار)، نه fetch زنده به‌ازای هر کلیک کاربر.
3. **ریسک ToS**: نرخ درخواست پایین + کش طولانی‌مدت.

هیچ تست باقی‌مونده‌ای نیست. وقتی خواستی وارد پیاده‌سازیش بشیم، خبر بده.

---

## ۴. قابلیت مرتبط: جستجوی فارسی → نتایج زنده‌ی ترندیول

هدف: کاربر فارسی می‌نویسه (مثلاً «تیشرت قرمز»)، ترجمه می‌شه به ترکی («kırmızı tişört» — ترتیب صفت/اسم برعکسه)، و سرچ می‌کنیم: `filter/sr?q={ترجمه‌شده}&pi=1`. نتایج مستقیم توی پاسخ لیست کامل‌ان.

**تصمیم برای ترجمه (ترکیبی):**
1. اول لغت‌نامه‌ی دستی فارسی→ترکی (رنگ‌ها، نوع لباس) + قاعده‌ی بازآرایی صفت/اسم.
2. اگه پوشش نداد، fallback به API ترجمه‌ی واقعی.
3. کش دو لایه: ترجمه + نتیجه‌ی سرچ.

هنوز در مرحله‌ی تصمیم‌گیریه.

---

## ۵. مسیر پیاده‌سازی و دیباگ واکشی زنده (تا اینجا حل‌شده)

اندپوینت آزمایشی اولیه (`GET /api/trendyol/search?q=...`) و بعد صفحه‌ی کامل `/products/trendyol/live` ساخته شد. مشکلاتی که پشت‌سرهم پیش اومد و حل شدن:

1. **۴۰۳ Forbidden** با `fetch` خام Node.js → حل شد با `got-scraping` (امضای TLS/HTTP2 واقع‌گرایانه‌تر)
2. **`ENOENT` برای `header-generator`** (وابستگی `got-scraping`) موقع باندل‌شدن با Turbopack → حل شد با `serverExternalPackages: ["got-scraping", "header-generator"]` توی `next.config.ts`
3. **ریدایرکت به `/en/select-country`** (چون IP سرور خارج از ترکیه‌ست) → حل شد با فرستادن کوکی‌های ترجیحی واقعی (`countryCode=TR`, `storefrontId=1`, `language=tr`, ...) که از مرورگر واقعی Mehdi استخراج شدن -- کوکی‌های مدیریت‌بات کلادفلر (`_cflb`, `_cfuvid`) عمداً کپی نشدن چون معمولاً IP-bound ان
4. **محصولات همیشه خالی برمی‌گشت** → یه باگ منطقی بود: فیلد `advert` روی *همه‌ی* محصولات هست (حتی غیرتبلیغاتی‌ها، با `advertId: ""`)، پس چک `Boolean(advert)` همه رو اشتباهی «تبلیغاتی» تشخیص می‌داد. اصلاح شد به `Boolean(advert?.advertId) || Number(advert?.cpc ?? 0) > 0`
5. **بین جابه‌جایی زنانه/مردانه، محتوای قبلی می‌موند** → باگ کلاسیک React بود: `TrendyolLiveGrid` (کامپوننت کلاینت) بدون `key` بین ناوبری‌ها remount نمی‌شد، پس `useState(initialProducts)` آپدیت نمی‌شد. حل شد با `key={url}`

**مقاوم‌سازی در برابر تغییرات آینده:** طبق درخواست Mehdi، استخراج داده الان دو استراتژی داره (اسم دقیق شناخته‌شده، بعد یه fallback عمومی که دنبال هر `window[...]=` با شکل داده‌ی درست می‌گرده) -- اگه هر دو شکست بخوره، به همه‌ی ادمین‌ها از طریق سیستم اعلان داخلی (زنگوله‌ی هدر) خبر داده می‌شه (`src/lib/adminAlerts.ts`)، با محدودیت یه اعلان در هر ۲۴ ساعت تا اسپم نشه.

⚠️ توجه: این اندپوینت‌ها رو مستقیم توی مرورگر باز نکن (`public.trendyol.com`/`apigw.trendyol.com`) — بلاک می‌شه. فقط از طریق سایت خودمون تستشون کن.

## ۶. معماری چندسایتی (`ExternalSite`) — نه فقط ترندیول

طبق پیشنهاد Mehdi، سیستم از یه لینک هاردکدشده‌ی تک‌سایتی (`Category.trendyolUrl`) به یه معماری عمومی چندسایتی مهاجرت کرد که هم ترندیول و ترندیول‌میلا رو پوشش می‌ده، هم آماده‌ی اضافه‌شدن سایت‌های آینده‌ست (زارا، مانگو، آدیداس، Hepsiburada، ...).

### مدل داده (`prisma/schema.prisma`)

- **`ExternalSite`**: هر سایت (نام، `slug`، `baseUrl` که با `?` تموم می‌شه، `isActive`)
- **`ExternalSiteCategoryParam`**: برای هر (سایت، دسته‌ی مزون) یه پارامتر کامل مثل `wc=82`
- **`ExternalSiteAttributeParam`**: دو‌جوره —
  - **مقدار ثابت** (وقتی `value` پر باشه): مثلاً ویژگی «جنسیت» + مقدار «مردانه» → `wg=2`
  - **قالب عمومی** (وقتی `value` خالی/`null` باشه): روی *هر* مقداری از اون ویژگی اعمال می‌شه، با جایگزینی `{value}` — مثلاً ویژگی «سایز» → `vr=size|group-{value}`، که برای مقدار `L` می‌شه `vr=size|group-l` (کوچک‌شده)

### تابع مرکزی: `buildExternalSiteUrl()` (`src/lib/externalSites.ts`)

```ts
buildExternalSiteUrl(siteSlug, categorySlug, [{attributeName, value}, ...])
```
`baseUrl` سایت رو با پارامتر دسته‌بندی (اگه نگاشتی براش ثبت شده باشه) و پارامتر هر فیلتر ویژگی (اول دنبال mapping دقیق همون مقدار می‌گرده، وگرنه قالب عمومی رو با جایگزینی `{value}` اعمال می‌کنه) به‌هم می‌چسبونه. اگه نگاشتی برای بخشی پیدا نشه، همون بخش نادیده گرفته می‌شه (نه کل عملیات شکست بخوره).

`buildAllExternalSiteUrls()` همین کارو برای همه‌ی سایت‌های فعال هم‌زمان انجام می‌ده (برای نمایش چندتا بج کنار هم توی منو).

### پنل ادمین: `/admin/external-sites`

مدیریت کامل سایت‌ها + نگاشت دسته‌بندی + نگاشت ویژگی از همینجا. هر سایت یه کارت داره با دو زیربخش (پارامتر دسته‌بندی‌ها، پارامتر ویژگی‌ها) که می‌شه ردیف اضافه/حذف کرد.

### داده‌ی از پیش seed شده (`prisma/seedExternalSites.js`)

فقط چیزی که واقعاً تست و تاییدشده ثبت شده:
- سایت‌های `trendyol` (`https://www.trendyol.com/sr?`) و `trendyol-milla` (`https://www.trendyol-milla.com/sr?`)
- نگاشت جنسیت برای هر دو: زنانه→`wg=1`، مردانه→`wg=2`

پارامتر دسته‌بندی (`wc=`) و سایز (`vr=`) عمداً خالی گذاشته شده چون هنوز تست نشدن (Mehdi توی توضیح خودش سه‌تا عدد متفاوت -- ۸۲، ۸۵، ۷۵ -- برای «پوشاک» زده بود که معلوم بود صرفاً مثال بودن، نه مقدار واقعی) -- باید از پنل ادمین دستی، بعد از تست واقعی هر دسته، اضافه بشن.

### نکته‌ی مهم درباره‌ی استخراج داده (`fetchTrendyolProductsFromUrl`)

منطق فعلی استخراج (`extractSearchDataFromHtml` در `src/lib/trendyol.ts`) روی الگوی `window["..."]=` که ترندیول/ترندیول‌میلا استفاده می‌کنن طراحی شده، و چون هر دو زیرمجموعه‌ی همون شرکتن، احتمالاً هر دو از همین الگو پیروی می‌کنن. **ولی این تضمین نمی‌شه برای سایت‌های کاملاً متفاوت (زارا، مانگو، آدیداس) هم کار کنه** -- اون‌ها ممکنه از یه پلتفرم فرانت‌اند کاملاً متفاوت (مثلاً Next.js با `__NEXT_DATA__`، یا Nuxt، یا هر چیز دیگه) استفاده کنن. برای آینده، احتمالاً باید یه فیلد `extractionMethod` به `ExternalSite` اضافه بشه که مشخص کنه هر سایت با کدوم استراتژی پارس بشه (نه فرض‌کردن که همه شبیه ترندیولن). این هنوز پیاده‌سازی نشده -- فعلاً فقط برای خانواده‌ی ترندیول (که تاییدشده) کار می‌کنه.

### فایل‌های درگیر (برای مرجع سریع)

- `prisma/schema.prisma` — ۳ مدل جدید
- `prisma/seedExternalSites.js` — سید اولیه
- `src/lib/externalSites.ts` — تابع مرکزی URL-builder + `getSiteFilterOptions()`
- `src/lib/categories.ts` — `fetchCategoryTree`/`fetchGenderMegaGroups` (بدون بار اضافی محاسبه‌ی لینک خارجی؛ اون منطق رفت به بخش ۷)
- `src/app/admin/external-sites/page.tsx` + `src/app/api/admin/external-sites/**` — پنل مدیریت
- `src/lib/trendyol.ts` — دیگه به یه دامنه‌ی خاص قفل نیست (`isHtmlPage` بر اساس وجود `/discovery-` توی URL تشخیص داده می‌شه، نه دامنه‌ی خاص)

## ۷. بازطراحی UI: نقطه‌ی ورود واحد به‌جای بج‌های پراکنده

نسخه‌ی اول (بخش ۶) یه بج کوچیک «TY» کنار هر دسته/جنسیت توی مگامنو می‌ذاشت. Mehdi درست اشاره کرد که وقتی تعداد سایت‌ها زیاد بشه، این بج‌ها شلوغ و ناهماهنگ می‌شن. تصمیم نهایی:

- **یه لینک واحد «فروشگاه‌های دیگر»** توی نوار مگامنو (`CategoryMegaMenu.tsx`) اضافه شد که می‌بره به `/marketplaces`
- **`/marketplaces`**: لیست کارت‌های همه‌ی سایت‌های فعال (اسم + دامنه)
- **`/marketplaces/[slug]`**: صفحه‌ی مخصوص هر سایت، با یه فرم فیلتر ساده (GET، بدون جاوااسکریپت پیچیده چون واکشی زنده کنده و ریفرش کامل صفحه مشکلی نداره) که **فقط دسته‌بندی/ویژگی‌هایی رو نشون می‌ده که واقعاً برای همون سایت نگاشت ثبت شده** (نه کل فیلترهای مزون) -- از طریق تابع جدید `getSiteFilterOptions(siteSlug)`

نتیجه: بج‌های پراکنده حذف شدن، `CategoryNode.externalLinks` (که فقط برای بج‌ها لازم بود) هم حذف شد، و صفحه‌ی قدیمی `src/app/products/trendyol/live/page.tsx` (که با `?url=` خام کار می‌کرد) هم حذف شد چون `/marketplaces/[slug]` جایگزین کاملشه. **نکته: پچ فایل نمی‌تونه فایل حذف کنه -- باید خودت پوشه‌ی `src/app/products/trendyol/live/` رو دستی پاک کنی.** روت `/api/trendyol/live` همچنان لازمه (دکمه‌ی «بارگذاری بیشتر» ازش استفاده می‌کنه)، فقط صفحه‌ی مصرف‌کننده‌ش عوض شده.


## ۸. ساختار صفحه‌ی اصلی ترندیول (`trendyol.com/`) — متفاوت از صفحه‌ی جستجو

Mehdi یه `view-source:` از خودِ `https://www.trendyol.com/` (نه صفحه‌ی جستجو) فرستاد. برخلاف صفحه‌ی جستجو (که `window["__single-search-result__PROPS"]` داشت)، صفحه‌ی اصلی از یه متغیر کاملاً متفاوت استفاده می‌کنه:

```
window["__widget-list-v2__PROPS"]
```

### ساختار

```
data.widgetList = {
  totalItems: 795,
  totalPages: 40,
  page: 0,
  hasMore: true,
  widgets: [ ...۲۰ تا ویجت... ]
}
```

یعنی صفحه‌ی اصلی از **۴۰ صفحه‌ی ویجت** تشکیل شده که با اسکرول لود می‌شن (دقیقاً همون چیزی که اولِ کار پرسیده بودی: «هرچی میری پایین‌تر هی اضافه میشه»). هر ویجت یکی از این تایپ‌هاست:

- **`PRODUCT`** — ردیف محصولات (مثل «Popüler Ürünler» که اولین اسکرین‌شات همین بحث بود)
- **`BANNER`** — بنر تبلیغاتی/کمپین
- **`REVIEW_IMAGE`** — همون «نظرات عکس‌دار محبوب» که قبلاً برای خودمون هم ساختیم

### فیلدهای واقعی هر محصول توی ویجت `PRODUCT`

این شکل **متفاوت و کامل‌تر** از چیزیه که توی صفحه‌ی جستجو دیدیم:
```
id, name, brandInfo{id,name}, category{id,name}, images[] (این‌جا کامل absolute
URL هستن، نیازی به prefix ندارن)، inStock, ratingScore{averageRating,totalCount},
hasReviewPhoto, url (نسبی)، merchantId, boutiqueId,
sanitizedPrice.finalPrice{text,value}, sanitizedPrice.unitPrice{text,value,unitSymbol}
(قیمت واحد مثل «۵٫۸۳ تومان/تبلت»)، badges{fastDelivery,freeCargo}, promotions[],
tagDetails[] (شامل بج‌هایی مثل «Çok Avantajlı Ürün»)، merchantListings[] (شامل
variants با قیمت کامل)، winnerVariant
```

### اندپوینت gateway (تایید جدید)

```
browsingGwUrl = https://apigw.trendyol.com/discovery-sfint-browsing-service
```
این احتمالاً همون سرویسیه که صفحه‌های بعدیِ ویجت‌لیست (`page=1,2,...` تا ۴۰) رو می‌ده. ⚠️ برخلاف صفحه‌ی جستجو، اینجا هیچ `_links.next` توی پاسخ نبود، یعنی مسیر دقیق pagination‌ش هنوز تست/تایید نشده -- فقط دامنه‌ی gateway‌ش مشخصه.

### نکته‌ی مهم معماری: این با چیزی که ساختیم فرق داره

`fetchTrendyolProductsFromUrl` و کل سیستم `ExternalSite` که ساختیم، مخصوص صفحه‌ی **نتایج جستجو** (`sr?wg=...`) طراحی شده -- یه لیست تخت از محصولاته. صفحه‌ی اصلی یه چیز دیگه‌ست: یه **فید چندنوعی از ویجت‌های مختلف** (نه فقط محصول). یعنی اگه بخوایم محتوای صفحه‌ی اصلی ترندیول رو (نه فقط نتایج سرچ) توی سایت خودمون نشون بدیم، به یه تابع استخراج جدا نیاز داریم که:
1. دنبال `__widget-list-v2__PROPS` بگرده (نه مارکر قبلی)
2. از `widgetList.widgets` فقط ویجت‌های `type === "PRODUCT"` رو فیلتر کنه و `items`شون رو دربیاره
3. فیلدهای همین بخش (که کمی متفاوت از فیلدهای صفحه‌ی جستجوعه) رو نگاشت کنه

**این هنوز پیاده‌سازی نشده -- فقط مستند شد.** اگه Mehdi بخواد محتوای صفحه‌ی اصلی ترندیول (نه فقط نتایج جستجوی دسته/جنسیت/برند) رو هم بیاره، این یه قابلیت جدا و جدیده که باید طراحی و ساخته بشه.

## ۹. مکانیزم «کلید مشترک» (sharedKey) برای ویژگی‌های چندزیرگروهی

طبق نمونه‌های واقعی چندگانه‌ای که Mehdi از فیلتر «Beden» (سایز) ترندیول جمع کرد:
```
vr=size|group-2xs_group-xs_..._group-xs-s_group-2xl-3xl_1_2_3_32_36-38_40-42
vr=size|group-l_group-xs-s_32_10-yas_standart
vr=size|27_33_39-5
```

**قانون کشف‌شده:** یه کلید مشترک (`vr=size|`) هست که چندتا ویژگی مختلف (سایز حرفی، سایز عددی، سایز سنی، استاندارد) زیرش جمع می‌شن؛ هرکدوم قالب تبدیل مقدار خودشو داره:

| نوع مقدار | قالب | مثال |
|---|---|---|
| سایز حرفی (تکی/ترکیبی) | `group-{value}` | `group-l`, `group-xs-s` |
| سایز عددی (تکی/بازه‌ای) | `{value}` (خام) | `32`, `36-38` |
| سایز سنی | `{value}-yas` | `10-yas` |
| استاندارد | `{value}` (خام) | `standart` |

همه‌ی مقادیر تبدیل‌شده با `_` به‌هم می‌چسبن، و کلید مشترک فقط یه‌بار جلوشون میاد.

**نکته‌ی تازه (از نمونه‌ی سایز اعشاری کفش):** مقادیر اعشاری با کاما (مثلاً UI نشون می‌ده «۳۹,۵») توی URL با **خط‌تیره جایگزین می‌شن**، نه کاماي خام و نه درصدرمزگذاری‌شده: `39,5` → `39-5`. یعنی تبدیل مقدار همیشه باید هم lowercase کنه هم کاما رو با خط‌تیره عوض کنه.

**نکته‌ی تازه‌تر (از نمونه‌ی سایز کیف زنانه):** فاصله و علامت `+` هم دقیقاً مثل کاما با خط‌تیره جایگزین می‌شن، و **هر کاراکتر خاص جدا** تبدیل می‌شه (نه اینکه چندتای پشت‌سرهم یکی بشن):
```
"Büyük Boy"           -> "buyuk-boy"           (فاصله -> خط‌تیره، ü -> u)
"33 x 38"              -> "33-x-38"             (فاصله‌ها -> خط‌تیره)
"50 x 60 + 60 x 100"   -> "50-x-60---60-x-100"  (فاصله+پلاس+فاصله = سه خط‌تیره‌ی جدا)
```
حروف خاص ترکی (`ü ş ı ğ ç ö`) هم باید به معادل ساده‌ی لاتینشون تبدیل بشن (اگه ادمین دقیقاً برچسب ترکی سایت مقصد رو کپی کرده باشه).

### پیاده‌سازی

- مدل `ExternalSiteAttributeParam` یه فیلد `sharedKey String?` گرفت. وقتی پر باشه، `paramTemplate` فقط بخش تبدیل مقداره (نه کل پارامتر).
- تابع `buildExternalSiteUrl` حالا مقادیر هم‌کلید رو جمع، تبدیل، و با `_` بهم می‌چسبونه.
- تابع کمکی `normalizeUrlValue()` هم lowercase می‌کنه هم کاما رو با خط‌تیره عوض می‌کنه، قبل از `encodeURIComponent`.
- پنل ادمین (`/admin/external-sites`) فیلد «کلید مشترک» رو هم به فرم افزودن هم به حالت ویرایش هر ردیف ویژگی اضافه کرد.
- `prisma/seedSizeSharedKey.js` دیتای نمونه‌ی کامل (۵ تا ویژگی سایز مختلف، همه زیر `vr=size|`) رو می‌سازه.

## ۱۰. اندپوینت Aggregations -- منبع قطعی برای «Beden» (تست شد، جواب گرفتیم)

بالاخره اندپوینتی که از بخش ۲.۱۰ مستند کرده بودیم (`data.searchAggregation._links.aggregation`) رو Mehdi واقعاً تست کرد و پاسخ خامش رو گرفت. این **قطعی‌ترین منبعیه که تا الان داشتیم** -- چون دیگه لازم نیست حدس بزنیم، خودِ ترندیول نگاشت کامل رو می‌ده.

### مسیر واقعی (از `_links` خودِ پاسخ)
```
https://apigw.trendyol.com/discovery-sfint-search-service/api/search/aggregations?pathModel=kadin-giyim-x-g1-c82&tyPlusStripViewEnabled=true&channelId=1&culture=tr-TR
```
⚠️ نکته: این از فرمت `pathModel=kadin-giyim-x-g1-c82` استفاده می‌کنه (نه `wc=`/`wg=`) -- یه فرمت داخلی جایگزین. برای ما لازم نیست ازش استفاده کنیم چون `wg=`/`wc=` ساده‌تر و کاملاً کارآمده.

### ساختار پاسخ
```
data.aggregation = [ ... حدود ۵۸ تا facet مختلف ... ]
```
هر facet یه `filterKey` (مثلاً `size`, `WebBrand`, `Price`, ...) و یه آرایه‌ی `values` داره. هر `value`:
```json
{"id": "group-2xs", "text": "2XS", "beautifiedName": "group-2xs", "count": 24646, ...}
```
**فیلد `id` دقیقاً همون slugِ آماده‌ی استفاده توی URLه** -- دیگه نیازی به حدس‌زدن تبدیل نیست.

### نتیجه‌ی facet «size» (Beden) -- ۱۴۱ مقدار واقعی و کامل

دو فرمت اصلی دیده شد:
1. **`group-{x}`** (۲۷ مقدار): همه‌ی سایزهای حرفی از `2XS` تا `12XL` + بازه‌های ترکیبی (`xs-s`, `2xl-3xl`, ...)
2. **بدون پیشوند** (۱۱۴ مقدار): این‌ها **از قبل کامل و آماده‌ان** (خودِ ترندیول تبدیلشون کرده، نیازی به قالب `{value}-yas` یا مشابه نداریم چون مقدار `id` از قبل شامل پسوندشه):
   - عددی خام و بازه‌ای: `1` تا `110`، `35-38`، `36-44`، ...
   - سنی (پسوند yas از قبل توی id هست): `10-yas`, `2-3-yas`, `8-12-yas`, ...
   - سینه‌بند (حرف کاپ چسبیده): `75b`, `80dd`, `90d`, ...
   - `tek-ebat`, `standart`
   - چندتا مقدار عجیب/ناقص که احتمالاً خودِ دیتای فروشنده‌ی ترندیول اشکال داره: `36-`, `36---40`, `34-`, `4-0` (این‌ها رو هم عیناً نگه داشتیم چون Mehdi خواست هیچی از دست نره)

یه facet جدای دیگه هم هست: `size-dimensions` (عنوانش «Boyut/Ebat») با ۱۵ مقدار برای پرده/تشک و مثل اون (`75-x-190`, `tek-ebat`, ...) -- این‌ها هم از قبل کامل‌ان.

### پیاده‌سازی (`prisma/seedFullSizeFacet.js` + `prisma/splitNumericSizeGroups.js`)

نسخه‌ی اول همه‌ی ۱۲۸ مقدار غیرحرفی رو توی یه ویژگی («سایز عددی/متفرقه») ریخت که خیلی شلوغ و قاطی‌پاتی شد. اسکریپت دوم (`splitNumericSizeGroups.js`) اون ویژگی رو حذف کرد و به‌جاش **۶ تا ویژگی معنی‌دار و جدا** ساخت (همه بازم زیر همون `sharedKey="vr=size|"`):

| ویژگی | تعداد مقدار | نمونه |
|---|---|---|
| سایز عددی (تکی) | ۳۹ | `1`, `32`, `75`, `x` |
| سایز عددی (بازه‌ای) | ۲۹ | `35-38`, `40-42`, `36---40` |
| سایز سنی (بچگانه) | ۲۰ | `10-yas`, `2-3-yas` |
| سایز سینه‌بند | ۲۴ | `75b`, `90dd` |
| استاندارد/تک‌سایز | ۲ | `standart`, `tek-ebat` |
| ابعاد (طول × عرض) | ۱۴ | `75-x-190` |

جمعاً همون ۱۲۸ مقدار (بدون کم‌وکاست)، فقط حالا توی پنل ادمین ۶ تا دراپ‌داون تمیز و قابل‌فهم به‌جای یه لیست ۱۲۸تایی قاطی.

⚠️ محدودیت شناخته‌شده: مقادیر «ابعاد» رو هم زیر همون `vr=size|` گذاشتیم چون مطمئن نیستیم کلید جدایی داره یا نه -- اگه بعداً معلوم شد اشتباهه، فقط کافیه `sharedKey`شون رو عوض کنیم.

## ۱۱. جدول مرجع کامل دسته‌بندی‌ها و برندها (از همون aggregations)

از یه پاسخ aggregations دیگه (این‌بار برای «Kadın» بدون دسته‌بندی خاص، یعنی `pathModel=kadin-x-g1`)، دو تا facet دیگه هم پیدا شد که همون منطق facet «size» رو دارن -- یعنی `id` دقیقاً همون مقدار آماده‌ی پارامتره:

- **`WebCategory`** (۳۹۳ مورد) → پارامتر `wc=` → ذخیره شد توی `docs/trendyol-categories-kadin.md`
- **`WebBrand`** (۱۰۰۰ مورد، با پرچم `popular`) → پارامتر `wb=` → ذخیره شد توی `docs/trendyol-brands.md`

دیگه لازم نیست برای هر دسته‌بندی مزون یکی‌یکی `wc=`/`wb=` رو حدس/تست کنیم -- کافیه توی این دو فایل مرجع (Ctrl+F) اسم ترکی نزدیک به دسته‌بندی مزون رو پیدا کنیم.

⚠️ این جدول مخصوص scope «Kadın» (زنانه) بوده -- شاید بعضی دسته‌بندی‌های خاصِ مردانه (مثل «ریش‌تراش») توش نباشن. اگه لازم شد، همین کارو برای `pathModel=erkek-x-g2` هم می‌شه تکرار کرد.
