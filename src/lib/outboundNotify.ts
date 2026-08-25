import { prisma } from "@/lib/prisma";
import webpush from "web-push";

// ================= اعلان خارج از سایت (ایمیل / پیامک / پوش مرورگر) =================
// هدف: وقتی اتفاقی برای مشتری می‌افته (ثبت سفارش، ارسال، تحویل بسته، پاسخ
// پشتیبانی، شارژ کیف‌پول، ...) علاوه‌بر اعلان زنگوله‌ای داخل سایت، بر اساس
// ترجیحات کاربر ایمیل/پیامک/پوش هم بفرستیم.
//
// پراوایدرهای ایمیل/پیامک: با env تنظیم می‌شوند و با fetch خام (بدون
// کتابخانه) فراخوانی می‌شن. پوش با استاندارد Web Push (کتابخانه‌ی web-push +
// کلیدهای VAPID) کار می‌کنه -- برخلاف ایمیل/پیامک نیازی به اکانت سرویسِ
// شخص‌ثالث ندارد، مستقیم به همون endpointِ مرورگرِ کاربر (که موقع subscribe
// از خودِ گوگل/موزیلا/اپل گرفته) می‌فرستد. اگه پراوایدری پیکربندی نشده باشد
// (محیط توسعه)، اعلان فقط در OutboundNotification با status="LOGGED" ثبت
// می‌شه تا بشه در پنل ادمین دید و واقعاً چیزی بیرون نرود.

export const EMAIL_CHANNEL = "EMAIL" as const;
export const SMS_CHANNEL = "SMS" as const;
export const PUSH_CHANNEL = "PUSH" as const;
export type OutboundChannel = typeof EMAIL_CHANNEL | typeof SMS_CHANNEL | typeof PUSH_CHANNEL;

// رویدادهایی که برای مشتری اعلان خارج از سایت می‌فرستیم. کلیدها در
// NotificationSetting.disabled*Events ذخیره می‌شوند.
export const NOTIFICATION_EVENTS = [
  "ORDER_CREATED",
  "PAYMENT_RECEIVED",
  "PAYMENT_DEADLINE",
  "ORDER_SHIPPED",
  "PACKAGE_DELIVERED",
  "ORDER_DELAYED",
  "ORDER_CANCELLED",
  "RETURN_SUBMITTED",
  "RETURN_DECIDED",
  "SUPPORT_REPLY",
  "WALLET_CREDIT",
  "STOCK_BACK",
  "PRICE_DROP",
  "NEW_DEVICE_LOGIN",
  "CART_ABANDONED",
  "REFERRAL_REWARD",
] as const;

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export const NOTIFICATION_EVENT_LABELS: Record<NotificationEvent, string> = {
  ORDER_CREATED: "ثبت سفارش",
  PAYMENT_RECEIVED: "تأیید پرداخت",
  PAYMENT_DEADLINE: "یادآوری مهلت پرداخت",
  ORDER_SHIPPED: "ارسال سفارش",
  PACKAGE_DELIVERED: "تحویل بسته",
  ORDER_DELAYED: "تأخیر در سفارش",
  ORDER_CANCELLED: "لغو سفارش",
  RETURN_SUBMITTED: "ثبت درخواست مرجوعی",
  RETURN_DECIDED: "نتیجه درخواست مرجوعی",
  SUPPORT_REPLY: "پاسخ پشتیبانی",
  WALLET_CREDIT: "شارژ کیف پول",
  STOCK_BACK: "موجودی محصول",
  PRICE_DROP: "کاهش قیمت",
  NEW_DEVICE_LOGIN: "ورود از دستگاه جدید",
  CART_ABANDONED: "یادآوری سبد خرید",
  REFERRAL_REWARD: "پاداش کد معرفی",
};

// کانال‌های فعال برای یک رویداد -- خالص و قابل تست.
// sms فقط وقتی مشتری شماره‌ی موبایل ثبت کرده باشد معنا دارد. push فقط وقتی
// معنا دارد که کاربر حداقل یک subscription فعال (مرورگر/دستگاه) داشته باشد --
// بدونش فرستادن بی‌فایده‌ست، پس اینجا هم مثل شماره‌موبایل گیت می‌شود.
export function resolveChannels(opts: {
  emailOn: boolean;
  smsOn: boolean;
  pushOn?: boolean;
  emailDisabledEvents: string[];
  smsDisabledEvents: string[];
  pushDisabledEvents?: string[];
  eventType: NotificationEvent;
  hasPhone: boolean;
  hasPushSubscription?: boolean;
}): OutboundChannel[] {
  const channels: OutboundChannel[] = [];
  if (opts.emailOn && !opts.emailDisabledEvents.includes(opts.eventType)) channels.push(EMAIL_CHANNEL);
  if (opts.hasPhone && opts.smsOn && !opts.smsDisabledEvents.includes(opts.eventType)) {
    channels.push(SMS_CHANNEL);
  }
  if (
    opts.hasPushSubscription &&
    opts.pushOn &&
    !(opts.pushDisabledEvents ?? []).includes(opts.eventType)
  ) {
    channels.push(PUSH_CHANNEL);
  }
  return channels;
}

export function parseDisabledEvents(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((e) => typeof e === "string") : [];
  } catch {
    return [];
  }
}

// ارسال ایمیل -- در صورت تنظیم RESEND_API_KEY از Resend استفاده می‌کند،
// وگرنه فقط لاگ می‌شود (خیلی شبیه به الگوی موجودِ بازیابی رمز در dev).
export async function deliverEmail(opts: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ status: "SENT" | "LOGGED" | "FAILED"; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "مداشاپ <noreply@mudashop.ir>";
  if (!apiKey) {
    console.log(`[outbound-email:LOGGED] به ${opts.to} -- ${opts.subject}\n${opts.body}`);
    return { status: "LOGGED" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        text: opts.body,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { status: "FAILED", error: `Resend ${res.status}: ${text.slice(0, 300)}` };
    }
    return { status: "SENT" };
  } catch (err) {
    return { status: "FAILED", error: err instanceof Error ? err.message : String(err) };
  }
}

// ارسال پیامک -- با KavehNegar (کاوه‌نگار). بدون پیکربندی فقط لاگ می‌شود.
export async function deliverSms(opts: {
  to: string;
  body: string;
}): Promise<{ status: "SENT" | "LOGGED" | "FAILED"; error?: string }> {
  const apiKey = process.env.KAVENEGAR_API_KEY;
  if (!apiKey) {
    console.log(`[outbound-sms:LOGGED] به ${opts.to} -- ${opts.body}`);
    return { status: "LOGGED" };
  }
  try {
    const sender = process.env.KAVENEGAR_SENDER ?? "10004346";
    const res = await fetch(
      `https://api.kavenegar.com/v1/${apiKey}/sms/send.json`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ receptor: opts.to, sender, message: opts.body }),
      }
    );
    if (!res.ok) {
      const text = await res.text();
      return { status: "FAILED", error: `Kavenegar ${res.status}: ${text.slice(0, 300)}` };
    }
    return { status: "SENT" };
  } catch (err) {
    return { status: "FAILED", error: err instanceof Error ? err.message : String(err) };
  }
}

// ارسال پوش -- با استاندارد Web Push (کتابخانه‌ی web-push + کلیدهای VAPID از
// env). برخلاف ایمیل/پیامک، «بدون پیکربندی» اینجا یعنی کلیدهای VAPID ست
// نشده‌ن -- که برای این پروژه غیرمعمولیه چون خودمون تولیدشون کردیم، ولی
// همون رفتار امن (فقط لاگ) رو برای سازگاری با محیط‌های دیگه حفظ می‌کنیم.
// اگه سرویس‌دهنده‌ی پوش (گوگل/موزیلا/اپل) بگه این subscription دیگه معتبر
// نیست (404/410)، status="GONE" برمی‌گردونیم تا صدازننده این subscription
// رو از دیتابیس پاک کنه -- نه اینکه هر بار دوباره امتحانش کنه.
export async function deliverPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; url?: string }
): Promise<{ status: "SENT" | "LOGGED" | "FAILED" | "GONE"; error?: string }> {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:support@mudashop.ir";

  if (!publicKey || !privateKey) {
    console.log(`[outbound-push:LOGGED] به ...${subscription.endpoint.slice(-24)} -- ${payload.title}`);
    return { status: "LOGGED" };
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify({ title: payload.title, body: payload.body, url: payload.url ?? "/" })
    );
    return { status: "SENT" };
  } catch (err) {
    const statusCode = (err as { statusCode?: number } | undefined)?.statusCode;
    if (statusCode === 404 || statusCode === 410) return { status: "GONE" };
    return { status: "FAILED", error: err instanceof Error ? err.message : String(err) };
  }
}

// پوش می‌تونه چندین subscription (چند مرورگر/دستگاه) برای یک کاربر داشته
// باشد -- برخلاف ایمیل/پیامک که یک «to» ساده‌اند، اینجا باید به همه‌شون جدا
// فرستاد و subscriptionِ منقضی‌شده رو حذف کرد
async function deliverPushToAllSubscriptions(
  userId: string,
  eventType: NotificationEvent,
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  for (const sub of subscriptions) {
    const result = await deliverPush(sub, payload);
    if (result.status === "GONE") {
      await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      continue;
    }
    await prisma.outboundNotification
      .create({
        data: {
          userId,
          channel: PUSH_CHANNEL,
          eventType,
          to: sub.endpoint,
          subject: payload.title,
          body: payload.body,
          status: result.status,
          error: result.error,
        },
      })
      .catch(() => {});
  }
}

export type OutboundDelivery = (opts: {
  channel: OutboundChannel;
  to: string;
  subject: string;
  body: string;
}) => Promise<{ status: "SENT" | "LOGGED" | "FAILED"; error?: string }>;

const defaultDelivery: OutboundDelivery = ({ channel, to, subject, body }) =>
  channel === EMAIL_CHANNEL
    ? deliverEmail({ to, subject, body })
    : deliverSms({ to, body });

// اعلان خارج از سایت برای یک مشتری، بر اساس ترجیحاتش. فقط کانال‌های فعال را
// می‌فرستد و نتیجه را در OutboundNotification ثبت می‌کند. هرگز throw نمی‌کند
// تا جای‌گذاری‌های کنارِ جریان‌های موجودِ سفارش ایمن باشد. اعلان زنگوله‌ای
// داخل سایت را این‌جا نمی‌سازد -- آن را در هر سایتِ رویداد به‌صورت جداگانه
// می‌سازند و این‌فانکشن فقط «برون‌سایت» را می‌پوشاند.
export async function notifyCustomerOutbound(opts: {
  userId: string;
  eventType: NotificationEvent;
  title: string;
  body: string;
  to?: string; // override برای شماره/ایمیل (مثلاً آدرس سفارش) -- پیش‌فرض از user
  url?: string; // لینکی که با کلیک روی اعلانِ پوش باز می‌شود (پیش‌فرض "/")
  delivery?: OutboundDelivery; // برای تست تزریق می‌شود
}): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: opts.userId },
      select: { email: true, phone: true },
    });
    if (!user) return;

    // تنظیمات: اگر ردیف نباشد (اولین‌بار)، با مقادیر پیش‌فرض می‌سازیم
    let settings = await prisma.notificationSetting.findUnique({
      where: { userId: opts.userId },
    });
    if (!settings) {
      settings = await prisma.notificationSetting.create({
        data: { userId: opts.userId },
      });
    }

    const pushSubscriptionCount = settings.pushOn
      ? await prisma.pushSubscription.count({ where: { userId: opts.userId } })
      : 0;

    const channels = resolveChannels({
      emailOn: settings.emailOn,
      smsOn: settings.smsOn,
      pushOn: settings.pushOn,
      emailDisabledEvents: parseDisabledEvents(settings.emailDisabledEvents),
      smsDisabledEvents: parseDisabledEvents(settings.smsDisabledEvents),
      pushDisabledEvents: parseDisabledEvents(settings.pushDisabledEvents),
      eventType: opts.eventType,
      hasPhone: Boolean(user.phone),
      hasPushSubscription: pushSubscriptionCount > 0,
    });

    const delivery = opts.delivery ?? defaultDelivery;

    for (const channel of channels) {
      if (channel === PUSH_CHANNEL) {
        await deliverPushToAllSubscriptions(opts.userId, opts.eventType, {
          title: opts.title,
          body: opts.body,
          url: opts.url,
        });
        continue;
      }

      const to = channel === EMAIL_CHANNEL ? opts.to ?? user.email : opts.to ?? user.phone!;
      if (!to) continue;
      const subject = channel === EMAIL_CHANNEL ? opts.title : "";
      const result = await delivery({ channel, to, subject, body: opts.body });

      try {
        await prisma.outboundNotification.create({
          data: {
            userId: opts.userId,
            channel,
            eventType: opts.eventType,
            to,
            subject: channel === EMAIL_CHANNEL ? opts.title : null,
            body: opts.body,
            status: result.status,
            error: result.error,
          },
        });
      } catch {
        // لاگ مهم است ولی نباید جریان اصلی را بشکند
      }
    }
  } catch {
    // هرگز اجازه نمی‌دهیم اعلانِ بیرون‌سایت جریان اصلی (مثل ثبت سفارش) را خراب کند
  }
}