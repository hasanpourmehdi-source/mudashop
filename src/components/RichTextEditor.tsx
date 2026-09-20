"use client";

import { useEffect, useRef } from "react";

// ویرایشگرِ متنِ سبک برای توضیحاتِ محصول -- فقط پررنگ/مورب/لیست، نه یه
// WYSIWYG کامل (بدونِ لینک/عکس/جدول). عمداً بدونِ کتابخونه‌ی سنگین -- با
// contentEditable + execCommand که برای همین سه دستورِ ساده کافی و پایداره.
// امنیت رو خودِ این کامپوننت تضمین نمی‌کنه -- سمتِ سرور (sanitizeHtml.ts)
// قبل از ذخیره و قبل از نمایش، HTML رو با allow-list پاک‌سازی می‌کنه
export function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  // مقدارِ اولیه رو فقط یه‌بار (موقعِ mount/عوض‌شدنِ محصولِ در حالِ ویرایش) داخلِ
  // contentEditable می‌ذاریم -- اگه با هر تغییرِ value دوباره innerHTML رو ست
  // می‌کردیم، کرسِر وسطِ تایپِ کاربر می‌پرید اولِ متن
  useEffect(() => {
    if (ref.current && !initialized.current) {
      ref.current.innerHTML = value || "";
      initialized.current = true;
    }
  }, [value]);

  useEffect(() => {
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {
      // بعضی مرورگرها این دستور رو ندارن -- بی‌خطر، فقط یعنی Enter شاید <div> بسازه
    }
  }, []);

  function exec(command: string) {
    ref.current?.focus();
    document.execCommand(command, false);
    handleInput();
  }

  function handleInput() {
    if (ref.current) onChange(ref.current.innerHTML);
  }

  return (
    <div className="border cut-line rounded-lg overflow-hidden bg-white sm:col-span-2">
      <div className="flex items-center gap-1 border-b cut-line bg-[var(--color-linen-dim)] px-2 py-1.5">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("bold")}
          className="w-7 h-7 rounded hover:bg-white font-bold text-sm"
          title="پررنگ"
        >
          B
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("italic")}
          className="w-7 h-7 rounded hover:bg-white italic text-sm"
          title="مورب"
        >
          I
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("insertUnorderedList")}
          className="w-7 h-7 rounded hover:bg-white text-sm"
          title="لیست"
        >
          •≡
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        onInput={handleInput}
        data-placeholder={placeholder}
        className="min-h-24 px-3 py-2 text-sm focus:outline-none [&_ul]:list-disc [&_ul]:pr-5 [&_ol]:list-decimal [&_ol]:pr-5 [&_p]:mb-2 empty:before:content-[attr(data-placeholder)] empty:before:text-[var(--color-muted)]"
      />
    </div>
  );
}
