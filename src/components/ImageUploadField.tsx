"use client";

import { useRef, useState } from "react";
import Image from "next/image";

export function ImageUploadField({
  value,
  onChange,
  invalid = false,
}: {
  value: string; // URL فعلی عکس (یا "" اگه هنوز آپلود نشده)
  onChange: (url: string) => void;
  invalid?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError("");
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "خطا در آپلود عکس");
        return;
      }
      onChange(data.url);
    } catch {
      setError("خطا در ارتباط با سرور");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      {value ? (
        <div className="flex items-center gap-3">
          <div className="relative w-24 h-24 rounded-lg overflow-hidden border cut-line bg-[var(--color-linen-dim)] shrink-0">
            <Image src={value} alt="" fill className="object-cover" unoptimized />
          </div>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="text-xs text-[var(--color-wine)] hover:underline w-fit disabled:opacity-50"
            >
              {uploading ? "در حال آپلود..." : "تعویض عکس"}
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              className="text-xs text-red-600 hover:underline w-fit"
            >
              حذف عکس
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`w-full border-2 border-dashed cut-line rounded-lg py-6 text-sm text-[var(--color-muted)] hover:bg-[var(--color-linen-dim)] disabled:opacity-50 ${
            invalid ? "!border-red-600" : ""
          }`}
        >
          {uploading ? "در حال آپلود..." : "📷 انتخاب عکس راهنمای سایز"}
        </button>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
