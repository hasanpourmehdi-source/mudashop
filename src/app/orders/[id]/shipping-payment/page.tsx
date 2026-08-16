"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";

type ShippingPaymentStatus = "AWAITING_PAYMENT" | "AWAITING_VERIFICATION" | "PAID" | "FAILED";

export default function ShippingPaymentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [amount, setAmount] = useState<number | null>(null);
  const [shippingCost, setShippingCost] = useState<number | null>(null);
  const [cargoCost, setCargoCost] = useState<number | null>(null);
  const [walletOffset, setWalletOffset] = useState<number>(0);
  const [status, setStatus] = useState<ShippingPaymentStatus | null>(null);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [bankCardNumber, setBankCardNumber] = useState("");
  const [bankShebaNumber, setBankShebaNumber] = useState("");
  const [bankCardHolder, setBankCardHolder] = useState("");
  const [error, setError] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function load() {
    fetch(`/api/orders/${params.id}/shipping-payment`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setAmount(data.amount);
        setShippingCost(data.shippingCost ?? null);
        setCargoCost(data.cargoCost ?? null);
        setWalletOffset(data.walletOffset ?? 0);
        setStatus(data.status);
        setReceiptImage(data.receiptImage);
        setBankCardNumber(data.bankCardNumber ?? "");
        setBankShebaNumber(data.bankShebaNumber ?? "");
        setBankCardHolder(data.bankCardHolder ?? "");
      });
  }

  useEffect(load, [params.id]);

  function handleFileSelect(selected: File) {
    setFile(selected);
    setError("");
    setPreview(URL.createObjectURL(selected));
  }

  async function handleSubmitReceipt() {
    if (!file) return;
    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`/api/orders/${params.id}/shipping-payment/receipt`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    setUploading(false);

    if (!res.ok) {
      setError(data.error ?? "خطا در ارسال فیش");
      return;
    }
    setStatus("AWAITING_VERIFICATION");
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
        <p className="text-sm text-[var(--color-muted)] mb-4">
          {status === "PAID" ? "هزینه ارسال این سفارش پرداخت شده است." : "این پرداخت رد شده — منتظر تعیین دوباره‌ی هزینه ارسال باشید."}
        </p>
        <button
          onClick={() => router.push(`/orders/${params.id}`)}
          className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium"
        >
          مشاهده سفارش
        </button>
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
            به محض بررسی و تأیید ادمین، این مرحله تکمیل می‌شود.
          </p>
          {receiptImage && (
            <div className="relative w-32 h-32 mx-auto rounded-lg overflow-hidden border cut-line mb-6">
              <Image src={receiptImage} alt="فیش واریزی" fill className="object-cover" unoptimized />
            </div>
          )}
          <button
            onClick={() => router.push(`/orders/${params.id}`)}
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
          <p className="text-xs text-[var(--color-muted)] mb-1">پرداخت هزینه ارسال (کارت‌به‌کارت)</p>
          <p className="text-[10px] text-[var(--color-ochre)] font-bold">
            مبلغ رو به شماره کارت زیر واریز کنید و عکس فیش رو آپلود کنید
          </p>
        </div>

        <div className="mb-6 pb-6 border-b cut-line text-sm space-y-1">
          {cargoCost !== null && (
            <div className="flex justify-between">
              <span className="text-[var(--color-muted)]">هزینه باربری</span>
              <span>{cargoCost.toLocaleString("fa-IR")} تومان</span>
            </div>
          )}
          {shippingCost !== null && (
            <div className="flex justify-between">
              <span className="text-[var(--color-muted)]">هزینه ارسال</span>
              <span>{shippingCost.toLocaleString("fa-IR")} تومان</span>
            </div>
          )}
          {walletOffset > 0 && (
            <div className="flex justify-between text-green-700">
              <span>کسر شده از کیف پول شما</span>
              <span>−{walletOffset.toLocaleString("fa-IR")} تومان</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base pt-1">
            <span>مبلغ قابل پرداخت</span>
            <span className="text-[var(--color-wine)]">{amount.toLocaleString("fa-IR")} تومان</span>
          </div>
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
            disabled={!file || uploading}
            className="w-full bg-[var(--color-wine)] text-white py-3 rounded-full font-medium disabled:opacity-50"
          >
            {uploading ? "در حال ارسال..." : "ارسال فیش پرداخت"}
          </button>
          <button
            onClick={() => router.push(`/orders/${params.id}`)}
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
