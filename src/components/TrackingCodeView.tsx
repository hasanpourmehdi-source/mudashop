import { trackingUrl } from "@/lib/trackingLink";

// نمایش کد رهگیری همراه با لینک «پیگیری آنلاین» به سایت پست/تییپاکس. اگه روش
// ارسال پیک موتوری باشه (شماره تماس است) یا carrier قابل تشخیص نباشد، فقط کد
// بدون لینک نشان داده می‌شه
export function TrackingCodeView({
  code,
  shippingMethod,
}: {
  code: string;
  shippingMethod?: string | null;
}) {
  const url = trackingUrl(code, shippingMethod);
  return (
    <span dir="ltr" className="inline-flex items-center gap-2">
      <span className="font-mono text-xs">{code}</span>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--color-wine)] text-xs underline whitespace-nowrap"
        >
          پیگیری
        </a>
      )}
    </span>
  );
}