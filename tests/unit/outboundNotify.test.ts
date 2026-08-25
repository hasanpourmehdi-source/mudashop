// اعلان خارج از سایت (ایمیل/پیامک) -- کانال‌های فعال + پارس رویدادهای غیرفعال
import { describe, expect, it } from "vitest";
import { resolveChannels, parseDisabledEvents, EMAIL_CHANNEL, SMS_CHANNEL, PUSH_CHANNEL } from "@/lib/outboundNotify";

describe("resolveChannels", () => {
  it("ایمیل و پیامک هردو فعال هستند -> هر دو کانال", () => {
    const channels = resolveChannels({
      emailOn: true,
      smsOn: true,
      emailDisabledEvents: [],
      smsDisabledEvents: [],
      eventType: "ORDER_SHIPPED",
      hasPhone: true,
    });
    expect(channels).toEqual([EMAIL_CHANNEL, SMS_CHANNEL]);
  });

  it("بدون شماره موبایل -> فقط ایمیل (حتی اگر smsOn باشد)", () => {
    const channels = resolveChannels({
      emailOn: true,
      smsOn: true,
      emailDisabledEvents: [],
      smsDisabledEvents: [],
      eventType: "ORDER_SHIPPED",
      hasPhone: false,
    });
    expect(channels).toEqual([EMAIL_CHANNEL]);
  });

  it("ایمیل غیرفعال و پیامک فعال -> فقط پیامک", () => {
    const channels = resolveChannels({
      emailOn: false,
      smsOn: true,
      emailDisabledEvents: [],
      smsDisabledEvents: [],
      eventType: "ORDER_SHIPPED",
      hasPhone: true,
    });
    expect(channels).toEqual([SMS_CHANNEL]);
  });

  it("رویداد در emailDisabledEvents -> ایمیل برای همان رویداد ارسال نمی‌شود", () => {
    const channels = resolveChannels({
      emailOn: true,
      smsOn: false,
      emailDisabledEvents: ["ORDER_SHIPPED"],
      smsDisabledEvents: [],
      eventType: "ORDER_SHIPPED",
      hasPhone: true,
    });
    expect(channels).toEqual([]);
  });

  it("غیرفعال‌کردن یک رویداد فقط همان رویداد را حذف می‌کند نه بقیه", () => {
    const channels = resolveChannels({
      emailOn: true,
      smsOn: false,
      emailDisabledEvents: ["ORDER_SHIPPED"],
      smsDisabledEvents: [],
      eventType: "PACKAGE_DELIVERED",
      hasPhone: true,
    });
    expect(channels).toEqual([EMAIL_CHANNEL]);
  });

  it("هر دو کانال غیرفعال -> خالی", () => {
    const channels = resolveChannels({
      emailOn: false,
      smsOn: false,
      emailDisabledEvents: [],
      smsDisabledEvents: [],
      eventType: "ORDER_SHIPPED",
      hasPhone: true,
    });
    expect(channels).toEqual([]);
  });

  it("پوش فعال و subscription موجود -> کانال پوش هم اضافه می‌شود", () => {
    const channels = resolveChannels({
      emailOn: false,
      smsOn: false,
      pushOn: true,
      emailDisabledEvents: [],
      smsDisabledEvents: [],
      pushDisabledEvents: [],
      eventType: "ORDER_SHIPPED",
      hasPhone: false,
      hasPushSubscription: true,
    });
    expect(channels).toEqual([PUSH_CHANNEL]);
  });

  it("پوش فعال ولی بدون subscription -> کانال پوش اضافه نمی‌شود", () => {
    const channels = resolveChannels({
      emailOn: false,
      smsOn: false,
      pushOn: true,
      emailDisabledEvents: [],
      smsDisabledEvents: [],
      pushDisabledEvents: [],
      eventType: "ORDER_SHIPPED",
      hasPhone: false,
      hasPushSubscription: false,
    });
    expect(channels).toEqual([]);
  });

  it("رویداد در pushDisabledEvents -> پوش برای همان رویداد ارسال نمی‌شود", () => {
    const channels = resolveChannels({
      emailOn: false,
      smsOn: false,
      pushOn: true,
      emailDisabledEvents: [],
      smsDisabledEvents: [],
      pushDisabledEvents: ["ORDER_SHIPPED"],
      eventType: "ORDER_SHIPPED",
      hasPhone: false,
      hasPushSubscription: true,
    });
    expect(channels).toEqual([]);
  });
});

describe("parseDisabledEvents", () => {
  it("رشته‌ی JSON معتبر -> آرایه", () => {
    expect(parseDisabledEvents('["ORDER_SHIPPED","SUPPORT_REPLY"]')).toEqual([
      "ORDER_SHIPPED",
      "SUPPORT_REPLY",
    ]);
  });

  it("JSON نامعتبر -> آرایه‌ی خالی", () => {
    expect(parseDisabledEvents("not-json")).toEqual([]);
    expect(parseDisabledEvents("")).toEqual([]);
  });

  it("آرایه‌ی ناخواسته فقط رشته‌ها نگه می‌دارد", () => {
    expect(parseDisabledEvents('[1,"ORDER_SHIPPED",null]')).toEqual(["ORDER_SHIPPED"]);
  });
});