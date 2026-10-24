"use client";

import { prepareUpload, appendUpload, discardPrepared } from "@/lib/directUpload";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { availableShippingMethods } from "@/lib/shipping";

type PaymentStatus = "PENDING" | "AWAITING_PAYMENT" | "AWAITING_VERIFICATION" | "PAID" | "FAILED";

export default function BankTransferPage() {
  const params = useParams<{ authority: string }>();
  const router = useRouter();

  const [amount, setAmount] = useState<number | null>(null);
  const [orderId, setOrderId] = useState<string>("");
  const [isGuest, setIsGuest] = useState(false);
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [bankCardNumber, setBankCardNumber] = useState("");
  const [bankShebaNumber, setBankShebaNumber] = useState("");
  const [bankCardHolder, setBankCardHolder] = useState("");
  const [city, setCity] = useState("");
  // اگه از قبل توی چک‌اوت انتخاب شده (سفارش فقط-مزون)، needsShippingMethod
  // false می‌مونه و دیگه پرسیده نمی‌شه؛ اگه هنوز مشخص نشده (سفارش حاوی کالای
  // خارجی)، همین‌جا موقع واریز هزینه‌ی اصلی سفارش ازش می‌پرسیم
  const [needsShippingMethod, setNeedsShippingMethod] = useState(false);
  const [shippingMethod, setShippingMethod] = useState("");
  const [error, setError] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function load() {
    fetch(`/api/payment/${params.authority}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setAmount(data.amount);
        setOrderId(data.orderId);
        setIsGuest(Boolean(data.isGuest));
        setStatus(data.paymentStatus);
        setReceiptImage(data.receiptImage);
        setBankCardNumber(data.bankCardNumber ?? "");
        setBankShebaNumber(data.bankShebaNumber ?? "");
        setBankCardHolder(data.bankCardHolder ?? "");
        setCity(data.city ?? "");
        setNeedsShippingMethod(!data.shippingMethod);
        if (data.shippingMethod) setShippingMethod(data.shippingMethod);
      });
  }

  useEffect(load, [params.authority]);

  function handleFileSelect(selected: File) {
    setFile(selected);
    setError("");
    setPreview(URL.createObjectURL(selected));
  }

  async function handleSubmitReceipt() {
    if (!file || (needsShippingMethod && !shippingMethod)) return;
    setUploading(true);
    setError("");

    const formData = new FormData();
    let prepared: Awaited<ReturnType<typeof prepareUpload>> | null = null;
    try {
      prepared = await prepareUpload(file, "payment-receipt", { authority: String(params.authority) });
      appendUpload(formData, prepared);
    } catch (err) {
      setUploading(false);
      setError(err instanceof Error ? err.message : "خطا در ارسال فیش");
      return;
    }
    if (needsShippingMethod) formData.append("shippingMethod", shippingMethod);

    const res = await fetch(`/api/payment/${params.authority}/receipt`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    setUploading(false);

    if (!res.ok) {
      discardPrepared(prepared);
      setError(data.error ?? "خطا در ارسال فیش");
      return;
    }
    setStatus("AWAITING_VERIFICATION");
  }

  // سفارشِ مهمان صفحه‌ی /orders/[id] رو نداره (لاگین می‌خواد و مهمان حسابی
  // نداره که باهاش وارد بشه) -- باید به همون صفحه‌ی read-onlyِ /track-order برگرده
  function orderViewHref() {
    return isGuest ? `/track-order?orderId=${orderId}` : `/orders/${orderId}`;
  }

  // این دکمه دیگه سفارش رو لغو نمی‌کنه (اون یه اقدام مجزا و نیازمند دلیله، از
  // طریق دکمه‌ی «لغو سفارش» توی خودِ صفحه‌ی سفارش) -- فقط برمی‌گرده به صفحه‌ی
  // سفارش، بدون هیچ تغییری. مشتری اگه واقعاً بخواد لغو کنه، از همون‌جا انجامش می‌ده
  function handleCancel() {
    router.push(orderViewHref());
  }

  if (error && amount === null) {
    return <p className="max-w-md mx-auto px-4 py-16 text-center text-red-600">{error}</p>;
  }
  if (amount === null) {
    return (
      <p className="max-w-md mx-auto px-4 py-16 text-center text-sm text-[var(--color-muted)]">
        در حال بارگذاری...
      </p>
    );
  }

  if (status === "PAID" || status === "FAILED") {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-sm text-[var(--color-muted)] mb-4">این تراکنش قبلاً پردازش شده است.</p>
        <button
          onClick={() => router.push(orderViewHref())}
          className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium"
        >
          مشاهده سفارش
        </button>
      </div>
    );
  }

  if (status === "PENDING") {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="border-2 cut-line rounded-xl p-6 bg-white text-center">
          <p className="text-3xl mb-3">⏳</p>
          <p className="font-bold mb-2">در انتظار بررسی ادمین</p>
          <p className="text-sm text-[var(--color-muted)] mb-6">
            سفارش شما ثبت شده و به‌محض بررسی، شماره کارت برای پرداخت در اختیارتون قرار می‌گیره.
          </p>
          <button
            onClick={() => router.push(orderViewHref())}
            className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium"
          >
            مشاهده سفارش
          </button>
        </div>
      </div>
    );
  }

  if (status === "AWAITING_VERIFICATION") {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="border-2 cut-line rounded-xl p-6 bg-white text-center">
          <p className="text-3xl mb-3">🕒</p>
          <p className="font-bold mb-2">فیش پرداخت شما ارسال شد</p>
          <p className="text-sm text-[var(--color-muted)] mb-6">
            به محض بررسی و تأیید ادمین، سفارش شما پردازش می‌شود.
          </p>
          {receiptImage && (
            <div className="relative w-32 h-32 mx-auto rounded-lg overflow-hidden border cut-line mb-6">
              <Image src={receiptImage} alt="فیش واریزی" fill className="object-cover" unoptimized />
            </div>
          )}
          <button
            onClick={() => router.push(orderViewHref())}
            className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium"
          >
            مشاهده سفارش
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="border-2 cut-line rounded-xl p-6 bg-white">
        <div className="text-center mb-6">
          <p className="text-xs text-[var(--color-muted)] mb-1">پرداخت کارت‌به‌کارت</p>
          <p className="text-[10px] text-[var(--color-ochre)] font-bold">
            مبلغ رو به شماره کارت زیر واریز کنید و عکس فیش رو آپلود کنید
          </p>
        </div>

        <div className="text-center mb-6 pb-6 border-b cut-line">
          <p className="text-sm text-[var(--color-muted)]">مبلغ قابل پرداخت</p>
          <p className="text-2xl font-extrabold text-[var(--color-wine)]">
            {amount.toLocaleString("fa-IR")} تومان
          </p>
        </div>

        <div className="mb-6 pb-6 border-b cut-line text-center">
          <p className="text-lg font-extrabold tracking-widest mb-1" dir="ltr">
            {bankCardNumber}
          </p>
          {bankShebaNumber && (
            <p className="text-xs text-[var(--color-muted)] tracking-widest mb-1" dir="ltr">
              شبا: {bankShebaNumber}
            </p>
          )}
          {bankCardHolder && (
            <p className="text-sm text-[var(--color-muted)]">به نام {bankCardHolder}</p>
          )}
        </div>

        {needsShippingMethod && (
          <div className="mb-6 pb-6 border-b cut-line">
            <p className="font-bold text-sm mb-3">نحوه ارسال</p>
            <div className="flex flex-wrap gap-2">
              {availableShippingMethods(city).map((m) => (
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
          </div>
        )}

        <div className="mb-6">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) handleFileSelect(selected);
              e.target.value = "";
            }}
          />

          {preview ? (
            <div className="flex items-center gap-3">
              <div className="relative w-20 h-20 rounded-lg overflow-hidden border cut-line shrink-0">
                <Image src={preview} alt="پیش‌نمایش فیش" fill className="object-cover" unoptimized />
              </div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="text-xs text-[var(--color-wine)] hover:underline disabled:opacity-50"
              >
                تعویض عکس
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full border-2 border-dashed cut-line rounded-lg py-6 text-sm text-[var(--color-muted)] hover:bg-[var(--color-linen-dim)]"
            >
              📷 انتخاب عکس فیش واریزی
            </button>
          )}
        </div>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <div className="space-y-2">
          <button
            onClick={handleSubmitReceipt}
            disabled={!file || (needsShippingMethod && !shippingMethod) || uploading}
            className="w-full bg-[var(--color-wine)] text-white py-3 rounded-full font-medium disabled:opacity-50"
          >
            {uploading ? "در حال ارسال..." : "ارسال فیش پرداخت"}
          </button>
          <button
            onClick={handleCancel}
            disabled={uploading}
            className="w-full border cut-line py-2.5 rounded-full text-sm text-[var(--color-muted)] disabled:opacity-50"
          >
            انصراف
          </button>
        </div>
      </div>
    </div>
  );
}
