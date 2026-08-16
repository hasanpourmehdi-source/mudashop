# language: fa
ویژگی: تشخیص سفارش‌های گیرکرده در داشبورد ادمین
  به‌عنوان ادمین، روی صفحه‌ی اصلی پنل باید ببینم کدوم سفارش‌ها توی کدوم مرحله
  گیر کرده‌ن و چقدر طولش کشیده -- تا بتونم نیمه‌هشدارها رو قبل از تبدیل شدن
  به هشدار جدی پیگیری کنم.

  @TC-11.1
  الگوی سناریو: آستانه‌ی نیمه‌هشدار/هشدار برای هر مرحله
    با فرض سفارشی که در مرحله‌ی "<مرحله>" است و "<ساعت گذشته>" ساعت از since آن گذشته
    وقتی ادمین داشبورد را باز می‌کند
    آنگاه سطح این سفارش باید "<سطح>" باشد

    نمونه‌ها:
      | مرحله                          | ساعت گذشته | سطح  |
      | AWAITING_FIRST_REVIEW           | 1          | none |
      | AWAITING_FIRST_REVIEW           | 3          | warn |
      | AWAITING_FIRST_REVIEW           | 7          | alert|
      | AWAITING_ITEM_PAYMENT_REVIEW     | 10         | none |
      | AWAITING_ITEM_PAYMENT_REVIEW     | 15         | warn |
      | AWAITING_ITEM_PAYMENT_REVIEW     | 25         | alert|
      | AWAITING_SHIPPING_PAYMENT_REVIEW | 10         | none |
      | AWAITING_SHIPPING_PAYMENT_REVIEW | 15         | warn |
      | AWAITING_SHIPPING_PAYMENT_REVIEW | 25         | alert|
      | AWAITING_PURCHASE                | 20         | none |
      | AWAITING_PURCHASE                | 30         | warn |
      | AWAITING_PURCHASE                | 50         | alert|
      | AWAITING_ADMIN_ITEMS_REVIEW       | 10         | none |
      | AWAITING_ADMIN_ITEMS_REVIEW       | 15         | warn |
      | AWAITING_ADMIN_ITEMS_REVIEW       | 25         | alert|
      | SHIPPED_TOO_LONG                 | 60         | none |
      | SHIPPED_TOO_LONG                 | 90         | warn |
      | SHIPPED_TOO_LONG                 | 130        | alert|
      | AWAITING_RETURN_REVIEW           | 20         | none |
      | AWAITING_RETURN_REVIEW           | 30         | warn |
      | AWAITING_RETURN_REVIEW           | 50         | alert|

  @TC-11.2
  سناریو: اولویت تشخیص مرحله وقتی چند شرط هم‌زمان صادقه
    با فرض سفارشی که هم itemsNegotiationStatus آن "AWAITING_ADMIN_REVIEW" است هم paymentStatus آن "AWAITING_VERIFICATION"
    وقتی ادمین داشبورد را باز می‌کند
    آنگاه مرحله‌ی تشخیص‌داده‌شده باید "AWAITING_ADMIN_ITEMS_REVIEW" باشد (نه AWAITING_ITEM_PAYMENT_REVIEW) -- چون بررسی مذاکره‌ی اقلام زودتر از بررسی فیش پرداخت انجام می‌شود

  @TC-11.3
  سناریو: ساعت‌شمار AWAITING_ADMIN_ITEMS_REVIEW از لحظه‌ی واقعیِ پاسخ مشتری حساب می‌شود
    با فرض سفارشی که ۲۰ ساعت پیش مشتری به تغییرات پاسخ داد (itemsNegotiationRespondedAt = ۲۰ ساعت پیش) و از آن زمان یک فیلد بی‌ربط دیگر order.updatedAt را جدیدتر کرده
    وقتی ادمین داشبورد را باز می‌کند
    آنگاه ساعت‌شمار این سفارش باید نزدیک به ۲۰ ساعت باشد (بر اساس itemsNegotiationRespondedAt)، نه نزدیک صفر (updatedAt)

  @TC-11.4
  سناریو: نشان‌های خلاصه‌ی بالای داشبورد
    با فرض N سفارش در سطح "alert" و M سفارش در سطح "warn"
    وقتی ادمین داشبورد را باز می‌کند
    آنگاه یک نشان قرمز "⚠️ N سفارش گیرکرده — نیاز به پیگیری فوری" و یک نشان زرد "⏳ M سفارش نیمه‌هشدار" نمایش داده می‌شود
    و هر گروه بر اساس بیشترین مدت‌زمان انتظار مرتب شده است (طولانی‌ترین اول)

  @TC-11.5
  سناریو: حالت خالی داشبورد
    با فرض این‌که هیچ سفارشی در هیچ مرحله‌ای گیر نکرده باشد
    وقتی ادمین داشبورد را باز می‌کند
    آنگاه پیام "هیچ سفارشی منتظر اقدام یا گیرکرده نیست. 🎉" نمایش داده می‌شود
