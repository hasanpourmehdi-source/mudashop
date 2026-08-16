"use client";

import DatePicker from "react-multi-date-picker";
import TimePicker from "react-multi-date-picker/plugins/time_picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import DateObject from "react-date-object";

// ورودی تاریخ (+ ساعت، اختیاری) با تقویم شمسی -- جایگزین <input type="date"> یا
// <input type="datetime-local"> که همیشه تقویمشون میلادیه (مرورگر خودش تعیینش
// می‌کنه، ربطی به زبان صفحه نداره)
export function PersianDateTimeInput({
  value,
  onChange,
  className,
  showTime = true,
  placeholder,
}: {
  value: string; // ISO string، یا رشته‌ی خالی برای «انتخاب نشده»
  onChange: (isoString: string) => void;
  className?: string;
  showTime?: boolean;
  placeholder?: string;
}) {
  return (
    <DatePicker
      value={value ? new DateObject({ date: new Date(value), calendar: persian, locale: persian_fa }) : ""}
      onChange={(dateObject) => {
        if (!dateObject || Array.isArray(dateObject)) {
          onChange("");
          return;
        }
        onChange(dateObject.toDate().toISOString());
      }}
      calendar={persian}
      locale={persian_fa}
      format={showTime ? "YYYY/MM/DD HH:mm" : "YYYY/MM/DD"}
      plugins={showTime ? [<TimePicker key="time" hideSeconds />] : []}
      inputClass={
        className ?? "border cut-line rounded-lg px-3 py-2 bg-white w-full text-sm"
      }
      containerClassName="w-full"
      placeholder={placeholder}
    />
  );
}
