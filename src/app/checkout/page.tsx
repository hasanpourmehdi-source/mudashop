"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCart } from "@/hooks/useCart";
import { GIFT_WRAP_COST, NO_COST_SHIPPING_METHODS, availableShippingMethods, calculateShipping } from "@/lib/shipping";
import { getAppliedCouponCode, setAppliedCouponCode } from "@/lib/appliedCoupon";
import { trackBeginCheckout, trackPurchase } from "@/lib/analytics";
import { Spinner } from "@/components/Spinner";
import { TrustBadgesInline } from "@/components/TrustBadgesInline";
import { useTrustBadges } from "@/components/TrustBadgesProvider";
import { useSalesPaused } from "@/components/SalesPausedProvider";

type Address = {
  id: string;
  title: string;
  fullName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string;
  detail: string;
  isDefault: boolean;
};

type CouponResult = {
  valid: boolean;
  code: string;
  type: "PERCENT" | "FIXED" | "FREE_SHIP" | "FIRST_BUY";
  discountAmount: number;
  freeShipping: boolean;
};

const emptyAddressForm = {
  title: "",
  fullName: "",
  phone: "",
  province: "",
  city: "",
  postalCode: "",
  detail: "",
};

export default function CheckoutPage() {
  const router = useRouter();
  const { status: sessionStatus } = useSession();
  const { items, total, clear } = useCart();
  const trustBadges = useTrustBadges();
  const { paused: salesPaused, message: salesPausedMessage } = useSalesPaused();
  // خریدِ مهمان: بدون لاگین هم می‌شه سفارش ثبت کرد (فقط با نام/ایمیل/تلفن)
  const isGuest = sessionStatus === "unauthenticated";
  const [guestEmail, setGuestEmail] = useState("");

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [addressForm, setAddressForm] = useState(emptyAddressForm);
  const [shippingMethod, setShippingMethod] = useState("");
  const [giftWrap, setGiftWrap] = useState(false);
  const [cashOnDeliveryEnabled, setCashOnDeliveryEnabled] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CARD_TRANSFER" | "CASH_ON_DELIVERY">("CARD_TRANSFER");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(true);

  // کوپن
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<CouponResult | null>(null);
  const [couponError, setCouponError] = useState("");
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  // کیف پول
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(false);

  // مزیتِ باشگاه مشتریان -- سطوحِ بالاتر ممکنه ارسالِ رایگانِ نامحدود داشته
  // باشن؛ اینجا فقط برای این‌که پیش‌نمایشِ چک‌اوت با چیزی که سرور واقعاً
  // محاسبه می‌کنه یکی باشه (خودِ منطق سمتِ سرور، src/app/api/orders/route.ts)
  const [tierFreeShipping, setTierFreeShipping] = useState(false);

  // ویرایش آدرس
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [editAddressForm, setEditAddressForm] = useState(emptyAddressForm);
  const [editAddressError, setEditAddressError] = useState("");
  const [editAddressSaving, setEditAddressSaving] = useState(false);

  // آیا ایمیل حساب (فقط برای کاربر لاگین‌کرده، نه مهمان) تأیید شده -- اگه نه،
  // همین اول هشدار می‌دیم تا کاربر کل فرم رو پر نکنه و بعد توی مرحله‌ی آخر
  // با خطای «سفارش ثبت نشد» غافلگیر نشه
  const [emailVerified, setEmailVerified] = useState(true);

  // تأییدِ قوانین -- فقط سمتِ کلاینت چک می‌شه (مثل بیشتر سایت‌ها)، تضمینِ
  // حقوقیِ واقعی نیست، فقط یعنی مشتری قبل از ثبت سفارش لینکش رو دیده
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  useEffect(() => {
    if (isGuest) return;
    fetch("/api/auth/verification-status")
      .then((res) => (res.ok ? res.json() : { verified: true }))
      .then((data) => setEmailVerified(!!data.verified));
  }, [isGuest]);

  // فقط یک‌بار برای همین بازِ ورود به چک‌اوت (نه هر رندر) -- برای پیکسل تبلیغاتی
  useEffect(() => {
    if (items.length === 0) return;
    trackBeginCheckout(items.map((i) => ({ id: i.id, title: i.title, price: i.price, quantity: i.quantity })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetch("/api/addresses")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Address[]) => {
        setAddresses(data);
        const def = data.find((a) => a.isDefault) ?? data[0];
        if (def) setSelectedAddressId(def.id);
        else setShowNewAddressForm(true);
      })
      .finally(() => setLoadingAddresses(false));

    fetch("/api/wallet")
      .then((res) => (res.ok ? res.json() : { balance: 0 }))
      .then((data) => setWalletBalance(data.balance ?? 0));

    if (!isGuest) {
      fetch("/api/loyalty")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => setTierFreeShipping(!!data?.tier?.freeShipping));
    }

    fetch("/api/settings/public")
      .then((res) => (res.ok ? res.json() : { cashOnDeliveryEnabled: false }))
      .then((data) => setCashOnDeliveryEnabled(!!data.cashOnDeliveryEnabled));

    // اگه توی صفحه‌ی سبد یه کد تخفیف اعمال شده بود، همون رو این‌جا هم پیش‌فرض
    // پر و اعمال می‌کنیم -- ولی دوباره از سرور اعتبارسنجی می‌شه (ممکنه منقضی شده باشه)
    const savedCoupon = getAppliedCouponCode();
    if (savedCoupon) setCouponInput(savedCoupon);
  }, []);

  useEffect(() => {
    const savedCoupon = getAppliedCouponCode();
    if (savedCoupon && couponInput === savedCoupon && !coupon) {
      handleApplyCoupon();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couponInput]);

  // نحوه ارسال فقط برای سبدهای فقط-مزون همین‌جا (کنار انتخاب آدرس) پرسیده
  // می‌شه -- سبدهای حاوی کالای خارجی (ترندیول) نحوه/هزینه‌ی ارسالشون بعد از
  // خرید و وزن‌کشی توسط ادمین مشخص می‌شه، نه اینجا
  const hasExternalItems = items.some((i) => i.source === "TRENDYOL");
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
  const currentCity = selectedAddress?.city ?? addressForm.city;
  const availableMethods = availableShippingMethods(currentCity);

  // اگه روشی که قبلاً انتخاب شده (مثلاً «پیک موتوری») با تغییر آدرس دیگه در
  // دسترس نباشه، پاکش می‌کنیم تا کاربر دوباره صریح انتخاب کنه
  useEffect(() => {
    if (shippingMethod && !availableMethods.includes(shippingMethod as (typeof availableMethods)[number])) {
      setShippingMethod("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCity]);

  // هزینه ارسال برای سبد فقط-مزون هم این‌جا (با همان منطق سرور) قابل محاسبه‌ست:
  // روش‌های NO_COST یا کوپن ارسال رایگان => صفر؛ روش پستی => SHIPPING_COST مگر
  // سبد بالاتر از آستانه‌ی ارسال رایگان. فقط سبدهای دارای کالای خارجی (ترندیول)
  // بعد از وزن‌کشی توسط ادمین اعلام می‌شن (اونجا قابل پیش‌بینی نیست).
  const subtotal = total();
  const giftWrapCost = giftWrap ? GIFT_WRAP_COST : 0;
  const discountAmount = coupon?.discountAmount ?? 0;
  const shippingCost =
    !hasExternalItems &&
    shippingMethod &&
    !coupon?.freeShipping &&
    !tierFreeShipping &&
    !NO_COST_SHIPPING_METHODS.includes(shippingMethod as (typeof NO_COST_SHIPPING_METHODS)[number])
      ? calculateShipping(subtotal)
      : 0;
  const totalBeforeWallet = subtotal - discountAmount + giftWrapCost + shippingCost;
  const walletApplied = useWallet ? Math.min(walletBalance, totalBeforeWallet) : 0;
  const grandTotal = totalBeforeWallet - walletApplied;

  async function handleSaveAddress(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...addressForm, isDefault: addresses.length === 0 }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "خطا در ذخیره آدرس");
      return;
    }
    setAddresses((prev) => [data, ...prev]);
    setSelectedAddressId(data.id);
    setShowNewAddressForm(false);
    setAddressForm(emptyAddressForm);
  }

  function startEditAddress(a: Address) {
    setEditingAddressId(a.id);
    setEditAddressForm({
      title: a.title,
      fullName: a.fullName,
      phone: a.phone,
      province: a.province,
      city: a.city,
      postalCode: a.postalCode,
      detail: a.detail,
    });
    setEditAddressError("");
  }

  async function handleSaveEditAddress(id: string) {
    setEditAddressError("");
    setEditAddressSaving(true);
    const res = await fetch(`/api/addresses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editAddressForm),
    });
    const data = await res.json();
    setEditAddressSaving(false);
    if (!res.ok) {
      setEditAddressError(data.error ?? "خطا در ذخیره تغییرات");
      return;
    }
    setAddresses((prev) => prev.map((a) => (a.id === id ? data : a)));
    setEditingAddressId(null);
  }

  async function handleDeleteAddress(id: string) {
    if (!confirm("حذف این آدرس قطعی است؟")) return;
    const res = await fetch(`/api/addresses/${id}`, { method: "DELETE" });
    if (res.ok) {
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      if (selectedAddressId === id) setSelectedAddressId("");
    }
  }

  async function handleApplyCoupon() {
    setCouponError("");
    setCoupon(null);
    if (!couponInput.trim()) return;
    setCheckingCoupon(true);
    const res = await fetch("/api/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: couponInput.trim(), subtotal }),
    });
    const data = await res.json();
    setCheckingCoupon(false);
    if (!res.ok) {
      setCouponError(data.error ?? "کد تخفیف نامعتبر است");
      setAppliedCouponCode("");
      return;
    }
    setCoupon(data);
    setAppliedCouponCode(data.code);
  }

  async function handlePlaceOrder() {
    setError("");
    if (salesPaused) {
      setError(salesPausedMessage);
      return;
    }
    if (!agreedToTerms) {
      setError("برای ثبت سفارش، باید قوانین و مقررات را بپذیرید");
      return;
    }
    if (isGuest) {
      const { title, fullName, phone, province, city, postalCode, detail } = addressForm;
      if (!title || !fullName || !phone || !province || !city || !postalCode || !detail) {
        setError("لطفاً اطلاعات آدرس را کامل کنید");
        return;
      }
      if (!guestEmail.trim()) {
        setError("برای خرید بدون ثبت‌نام، وارد کردن ایمیل لازم است");
        return;
      }
    } else if (!selectedAddressId) {
      setError("لطفاً یک آدرس انتخاب کنید");
      return;
    }
    if (!hasExternalItems && !shippingMethod) {
      setError("لطفاً نحوه ارسال را انتخاب کنید");
      return;
    }
    setSubmitting(true);

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(isGuest
          ? {
              newAddress: addressForm,
              guestEmail: guestEmail.trim(),
              guestName: addressForm.fullName,
              guestPhone: addressForm.phone,
            }
          : { addressId: selectedAddressId }),
        shippingMethod: hasExternalItems ? undefined : shippingMethod,
        giftWrap,
        couponCode: coupon?.code,
        useWallet: isGuest ? false : useWallet,
        paymentMethod: cashOnDeliveryEnabled ? paymentMethod : "CARD_TRANSFER",
        items: items.map((i) => ({
          source: i.source,
          productId: i.productId,
          variantId: i.variantId,
          flashSaleId: i.flashSaleId,
          quantity: i.quantity,
          variantLabel: i.variantLabel,
          merchantId: i.merchantId,
        })),
      }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "خطا در ثبت سفارش");
      return;
    }

    trackPurchase(
      data.id,
      (data.items as { id: string; title: string; price: number; quantity: number }[]).map((i) => ({
        id: i.id,
        title: i.title,
        price: i.price,
        quantity: i.quantity,
      })),
      data.total
    );

    clear();
    setAppliedCouponCode("");
    if (isGuest) {
      router.push(`/track-order?orderId=${data.id}&email=${encodeURIComponent(guestEmail.trim())}`);
      return;
    }
    router.push(`/orders/${data.id}`);
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <h1 className="text-xl font-bold mb-2">سبد خرید شما خالی است</h1>
        <p className="text-[var(--color-muted)]">
          قبل از تسویه‌حساب، چند محصول به سبد خرید اضافه کنید.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 grid md:grid-cols-[1fr_320px] gap-8">
      {/* min-w-0 لازمه چون این ستون مستقیم فرزندِ گریده -- پایینِ md که فقط
          یه ستونِ ضمنی داره، بدونِ این، محتوای داخلش می‌تونه عرضِ کلِ صفحه رو
          به بیرون بزنه و باعثِ اسکرولِ افقیِ کل صفحه بشه (دقیقاً همون باگِ
          سبدخرید) */}
      <div className="space-y-8 min-w-0">
        {salesPaused && (
          <div className="border-2 cut-line rounded-lg p-4 bg-amber-50 text-sm">
            <p className="font-medium">⏸️ {salesPausedMessage}</p>
          </div>
        )}

        {!isGuest && !emailVerified && (
          <div className="border-2 cut-line rounded-lg p-4 bg-amber-50 text-sm">
            <p className="font-medium">
              ⚠️ ایمیل حسابت هنوز تأیید نشده -- برای ثبت سفارش، اول باید تأییدش کنی.
            </p>
            <Link href="/profile" className="text-xs text-[var(--color-wine)] hover:underline">
              رفتن به پروفایل برای تأیید ایمیل ←
            </Link>
          </div>
        )}

        {/* آدرس‌ها */}
        <section>
          <h2 className="font-bold mb-4">آدرس ارسال</h2>
          {loadingAddresses ? (
            <p className="text-sm text-[var(--color-muted)]">در حال بارگذاری...</p>
          ) : (
            <div className="space-y-2 mb-4">
              {addresses.map((a) =>
                editingAddressId === a.id ? (
                  <div key={a.id} className="border-2 cut-line rounded-lg p-3 bg-white space-y-2">
                    <div className="grid sm:grid-cols-2 gap-2">
                      <input
                        placeholder="عنوان *"
                        value={editAddressForm.title}
                        onChange={(e) => setEditAddressForm({ ...editAddressForm, title: e.target.value })}
                        className="border cut-line rounded-lg px-3 py-1.5 text-sm"
                      />
                      <input
                        placeholder="نام گیرنده *"
                        value={editAddressForm.fullName}
                        onChange={(e) => setEditAddressForm({ ...editAddressForm, fullName: e.target.value })}
                        className="border cut-line rounded-lg px-3 py-1.5 text-sm"
                      />
                      <input
                        placeholder="شماره تماس *"
                        value={editAddressForm.phone}
                        onChange={(e) => setEditAddressForm({ ...editAddressForm, phone: e.target.value })}
                        className="border cut-line rounded-lg px-3 py-1.5 text-sm"
                      />
                      <input
                        placeholder="استان *"
                        value={editAddressForm.province}
                        onChange={(e) => setEditAddressForm({ ...editAddressForm, province: e.target.value })}
                        className="border cut-line rounded-lg px-3 py-1.5 text-sm"
                      />
                      <input
                        placeholder="شهر *"
                        value={editAddressForm.city}
                        onChange={(e) => setEditAddressForm({ ...editAddressForm, city: e.target.value })}
                        className="border cut-line rounded-lg px-3 py-1.5 text-sm"
                      />
                      <input
                        placeholder="کد پستی *"
                        value={editAddressForm.postalCode}
                        onChange={(e) => setEditAddressForm({ ...editAddressForm, postalCode: e.target.value })}
                        className="border cut-line rounded-lg px-3 py-1.5 text-sm"
                      />
                      <textarea
                        placeholder="آدرس کامل *"
                        value={editAddressForm.detail}
                        onChange={(e) => setEditAddressForm({ ...editAddressForm, detail: e.target.value })}
                        className="border cut-line rounded-lg px-3 py-1.5 text-sm sm:col-span-2"
                      />
                    </div>
                    {editAddressError && <p className="text-xs text-red-600">{editAddressError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveEditAddress(a.id)}
                        disabled={editAddressSaving}
                        className="text-xs inline-flex items-center justify-center gap-1 bg-[var(--color-wine)] text-white px-3 py-1.5 rounded-full disabled:opacity-50"
                      >
                        {editAddressSaving ? <Spinner className="w-3 h-3" /> : "ذخیره"}
                      </button>
                      <button
                        onClick={() => setEditingAddressId(null)}
                        className="text-xs text-[var(--color-muted)]"
                      >
                        انصراف
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={a.id}
                    className={`flex items-start gap-3 border cut-line rounded-lg p-3 bg-white ${
                      selectedAddressId === a.id ? "border-[var(--color-wine)]" : ""
                    }`}
                  >
                    <label className="flex items-start gap-3 cursor-pointer flex-1">
                      <input
                        type="radio"
                        name="address"
                        checked={selectedAddressId === a.id}
                        onChange={() => setSelectedAddressId(a.id)}
                        className="mt-1 accent-[var(--color-wine)]"
                      />
                      <div className="text-sm">
                        <p className="font-medium">
                          {a.title} — {a.fullName}
                        </p>
                        <p className="text-[var(--color-muted)]">
                          {a.province}، {a.city}، {a.detail}
                        </p>
                        <p className="text-[var(--color-muted)]">{a.phone}</p>
                      </div>
                    </label>
                    <div className="flex flex-col gap-1 text-xs shrink-0">
                      <button
                        onClick={() => startEditAddress(a)}
                        className="text-[var(--color-wine)] hover:underline"
                      >
                        ویرایش
                      </button>
                      <button
                        onClick={() => handleDeleteAddress(a.id)}
                        className="text-red-600 hover:underline"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {!isGuest && !showNewAddressForm ? (
            <button
              onClick={() => setShowNewAddressForm(true)}
              className="text-sm text-[var(--color-wine)] font-medium"
            >
              + افزودن آدرس جدید
            </button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!isGuest) handleSaveAddress(e);
              }}
              noValidate
              className="grid sm:grid-cols-2 gap-3 border cut-line rounded-lg p-4 bg-white"
            >
              {isGuest && (
                <input
                  type="email"
                  placeholder="ایمیل (برای پیگیری سفارش)"
                  required
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  dir="ltr"
                  className="border cut-line rounded-lg px-3 py-2 sm:col-span-2"
                />
              )}
              <input
                placeholder="عنوان (مثلا منزل) *"
                required
                value={addressForm.title}
                onChange={(e) => setAddressForm({ ...addressForm, title: e.target.value })}
                className="border cut-line rounded-lg px-3 py-2"
              />
              <input
                placeholder="نام گیرنده *"
                required
                value={addressForm.fullName}
                onChange={(e) => setAddressForm({ ...addressForm, fullName: e.target.value })}
                className="border cut-line rounded-lg px-3 py-2"
              />
              <input
                placeholder="شماره تماس *"
                required
                value={addressForm.phone}
                onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                className="border cut-line rounded-lg px-3 py-2"
              />
              <input
                placeholder="استان *"
                required
                value={addressForm.province}
                onChange={(e) => setAddressForm({ ...addressForm, province: e.target.value })}
                className="border cut-line rounded-lg px-3 py-2"
              />
              <input
                placeholder="شهر *"
                required
                value={addressForm.city}
                onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                className="border cut-line rounded-lg px-3 py-2"
              />
              <input
                placeholder="کد پستی *"
                required
                value={addressForm.postalCode}
                onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                className="border cut-line rounded-lg px-3 py-2"
              />
              <textarea
                placeholder="آدرس کامل *"
                required
                value={addressForm.detail}
                onChange={(e) => setAddressForm({ ...addressForm, detail: e.target.value })}
                className="border cut-line rounded-lg px-3 py-2 sm:col-span-2"
              />
              {!isGuest && (
                <div className="sm:col-span-2 flex gap-2">
                  <button
                    type="submit"
                    className="bg-[var(--color-wine)] text-white px-4 py-2 rounded-full text-sm font-medium"
                  >
                    ذخیره آدرس
                  </button>
                  {addresses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowNewAddressForm(false)}
                      className="text-sm text-[var(--color-muted)]"
                    >
                      انصراف
                    </button>
                  )}
                </div>
              )}
            </form>
          )}
        </section>

        {isGuest && (
          <p className="text-xs text-[var(--color-muted)] -mt-4">
            حساب کاربری داری؟{" "}
            <a href="/auth/login?callbackUrl=/checkout" className="text-[var(--color-wine)] font-medium">
              وارد شو
            </a>{" "}
            تا سریع‌تر خرید کنی و تاریخچه‌ی سفارش‌هات رو ببینی.
          </p>
        )}

        {/* نحوه ارسال -- فقط برای سبد فقط-مزون؛ گزینه‌های در دسترس به شهرِ آدرس انتخابی بستگی داره */}
        {!hasExternalItems && (
          <section>
            <h2 className="font-bold mb-3">نحوه ارسال</h2>
            <div className="flex flex-wrap gap-2">
              {availableMethods.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setShippingMethod(m)}
                  className={`border cut-line rounded-full px-4 py-2 text-sm transition-colors ${
                    shippingMethod === m
                      ? "border-[var(--color-wine)] text-[var(--color-wine)] font-medium bg-[var(--color-wine)]/5"
                      : "bg-white hover:border-[var(--color-wine)]"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            {shippingMethod && NO_COST_SHIPPING_METHODS.includes(shippingMethod as (typeof NO_COST_SHIPPING_METHODS)[number]) && (
              <p className="text-xs text-green-700 mt-2">
                هزینه‌ی این روش مستقیم توسط شما به تحویل‌دهنده پرداخت می‌شود — در سایت هزینه‌ای برای ارسال محاسبه نمی‌شود.
              </p>
            )}
          </section>
        )}

        {/* روش پرداخت -- فقط وقتی ادمین از تنظیمات پرداخت‌درمحل رو روشن کرده نشون داده می‌شه */}
        {cashOnDeliveryEnabled && (
          <section>
            <h2 className="font-bold mb-3">روش پرداخت</h2>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { value: "CARD_TRANSFER", label: "کارت به کارت (آپلود فیش واریزی)" },
                  { value: "CASH_ON_DELIVERY", label: "پرداخت در محل (نقدی موقع تحویل)" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPaymentMethod(opt.value)}
                  className={`border cut-line rounded-full px-4 py-2 text-sm transition-colors ${
                    paymentMethod === opt.value
                      ? "border-[var(--color-wine)] text-[var(--color-wine)] font-medium bg-[var(--color-wine)]/5"
                      : "bg-white hover:border-[var(--color-wine)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {paymentMethod === "CASH_ON_DELIVERY" && (
              <p className="text-xs text-[var(--color-muted)] mt-2">
                کل مبلغ سفارش (و هزینه ارسال، اگر بود) موقع تحویل کالا به‌صورت نقدی از شما دریافت می‌شود -- نیازی به واریز آنلاین نیست.
              </p>
            )}
          </section>
        )}

        {/* کد تخفیف */}
        <section>
          <h2 className="font-bold mb-3">کد تخفیف</h2>
          <div className="flex gap-2">
            <input
              placeholder="مثلا WELCOME10"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              className="border cut-line rounded-lg px-3 py-2 bg-white flex-1"
            />
            <button
              onClick={handleApplyCoupon}
              disabled={checkingCoupon}
              className="border cut-line inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-white disabled:opacity-50"
            >
              {checkingCoupon && <Spinner className="w-4 h-4" />}
              {checkingCoupon ? "در حال بررسی..." : "اعمال"}
            </button>
          </div>
          {couponError && <p className="text-sm text-red-600 mt-2">{couponError}</p>}
          {coupon && (
            <p className="text-sm text-green-700 mt-2">
              کد «{coupon.code}» اعمال شد
              {coupon.discountAmount > 0 &&
                ` — ${coupon.discountAmount.toLocaleString("fa-IR")} تومان تخفیف`}
              {coupon.freeShipping && " — ارسال رایگان"}
            </p>
          )}
        </section>

        {/* کیف پول */}
        {walletBalance > 0 && (
          <section>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={useWallet}
                onChange={(e) => setUseWallet(e.target.checked)}
                className="accent-[var(--color-wine)]"
              />
              استفاده از کیف پول (موجودی: {walletBalance.toLocaleString("fa-IR")} تومان)
            </label>
          </section>
        )}

        {/* کادو */}
        <section>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={giftWrap}
              onChange={(e) => setGiftWrap(e.target.checked)}
              className="accent-[var(--color-wine)]"
            />
            بسته‌بندی هدیه (+{GIFT_WRAP_COST.toLocaleString("fa-IR")} تومان)
          </label>
        </section>

        {/* آیتم‌های سبد */}
        <section>
          <h2 className="font-bold mb-4">اقلام سفارش</h2>
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex justify-between gap-2 flex-wrap text-sm border cut-line rounded-lg p-3 bg-white"
              >
                <span>
                  {item.title} {item.variantLabel && `(${item.variantLabel})`} × {item.quantity}
                </span>
                {/* whitespace-nowrap لازمه چون بدونش، توی ردیفِ باریک، عددِ
                    قیمت از خودِ «تومان» جدا می‌شه و به خط بعد می‌ره */}
                <span className="font-medium whitespace-nowrap">
                  {(item.price * item.quantity).toLocaleString("fa-IR")} تومان
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* خلاصه سفارش */}
      <aside className="border cut-line rounded-lg p-5 bg-white h-fit min-w-0 space-y-3 text-sm">
        <h2 className="font-bold mb-2">خلاصه سفارش</h2>
        <div className="flex justify-between">
          <span className="text-[var(--color-muted)]">جمع اقلام</span>
          <span>{subtotal.toLocaleString("fa-IR")} تومان</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-green-700">
            <span>تخفیف کوپن</span>
            <span>−{discountAmount.toLocaleString("fa-IR")} تومان</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-[var(--color-muted)]">
            هزینه ارسال
            {!hasExternalItems && shippingCost === 0 && !coupon?.freeShipping && !tierFreeShipping && (
              <span className="block text-[10px] text-[var(--color-muted)]">
                {NO_COST_SHIPPING_METHODS.includes(shippingMethod as (typeof NO_COST_SHIPPING_METHODS)[number])
                  ? "پرداخت مستقیم به تحویل‌دهنده"
                  : "ارسال رایگان بالاتر از سقف خرید"}
              </span>
            )}
          </span>
          <span className="text-xs text-[var(--color-muted)]">
            {hasExternalItems
              ? "پس از بررسی ادمین اعلام می‌شود"
              : shippingCost === 0
                ? coupon?.freeShipping
                  ? "رایگان (کد تخفیف)"
                  : tierFreeShipping
                    ? "رایگان (مزیت باشگاه مشتریان)"
                    : "رایگان"
                : shippingMethod
                  ? `${shippingCost.toLocaleString("fa-IR")} تومان`
                  : "پس از انتخاب نحوه ارسال"}
          </span>
        </div>
        {giftWrap && (
          <div className="flex justify-between">
            <span className="text-[var(--color-muted)]">بسته‌بندی هدیه</span>
            <span>{giftWrapCost.toLocaleString("fa-IR")} تومان</span>
          </div>
        )}
        {walletApplied > 0 && (
          <div className="flex justify-between text-green-700">
            <span>پرداخت از کیف پول</span>
            <span>−{walletApplied.toLocaleString("fa-IR")} تومان</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-base border-t cut-line pt-3">
          <span>
            مبلغ قابل پرداخت
            <span className="block text-[10px] font-normal text-[var(--color-muted)]">
              {hasExternalItems ? "هزینه ارسال+باربری پس از بررسی ادمین اعلام می‌شود" : "شامل هزینه ارسال"}
            </span>
          </span>
          <span className="text-[var(--color-wine)]">{grandTotal.toLocaleString("fa-IR")} تومان</span>
        </div>

        <label className="flex items-start gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="accent-[var(--color-wine)] mt-0.5"
          />
          <span>
            <Link href="/terms" target="_blank" className="text-[var(--color-wine)] hover:underline">
              قوانین و مقررات
            </Link>{" "}
            و{" "}
            <Link href="/privacy" target="_blank" className="text-[var(--color-wine)] hover:underline">
              حریم خصوصی
            </Link>{" "}
            را می‌پذیرم
          </span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handlePlaceOrder}
          disabled={submitting || salesPaused}
          className="w-full inline-flex items-center justify-center gap-2 bg-[var(--color-wine)] text-white py-3 rounded-full font-medium disabled:opacity-50"
        >
          {submitting && <Spinner className="w-4 h-4" />}
          {submitting ? "در حال ثبت سفارش..." : "ثبت سفارش"}
        </button>

        <TrustBadgesInline badges={trustBadges} />
      </aside>
    </div>
  );
}
