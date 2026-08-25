import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  NOTIFICATION_EVENTS,
  NOTIFICATION_EVENT_LABELS,
  parseDisabledEvents,
  type NotificationEvent,
} from "@/lib/outboundNotify";

// تنظیمات اعلان خارج از سایت (ایمیل/پیامک) برای کاربر لاگین‌شده.
// GET: خواندن (اگر ردیف نباشد، با پیش‌فرض می‌سازد)
// PUT: به‌روزرسانی سوییچ‌ها + رویدادهای غیرفعال هر کانال
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const [settings, user] = await Promise.all([
    prisma.notificationSetting.findUnique({ where: { userId: session.user.id } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true, phone: true } }),
  ]);

  let s = settings;
  if (!s) {
    s = await prisma.notificationSetting.create({ data: { userId: session.user.id } });
  }

  const pushSubscriptionCount = await prisma.pushSubscription.count({ where: { userId: session.user.id } });

  return NextResponse.json({
    emailOn: s.emailOn,
    smsOn: s.smsOn,
    pushOn: s.pushOn,
    emailDisabledEvents: parseDisabledEvents(s.emailDisabledEvents),
    smsDisabledEvents: parseDisabledEvents(s.smsDisabledEvents),
    pushDisabledEvents: parseDisabledEvents(s.pushDisabledEvents),
    hasPhone: Boolean(user?.phone),
    hasPushSubscription: pushSubscriptionCount > 0,
    email: user?.email ?? null,
    events: NOTIFICATION_EVENTS.map((e) => ({
      key: e,
      label: NOTIFICATION_EVENT_LABELS[e],
    })),
  });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }

  const body = await req.json();
  const emailOn = typeof body.emailOn === "boolean" ? body.emailOn : true;
  const smsOn = typeof body.smsOn === "boolean" ? body.smsOn : false;

  // فقط کلیدهای معتبرِ رویداد را نگه می‌داریم
  const validEvents = new Set<string>(NOTIFICATION_EVENTS);
  const sanitize = (arr: unknown): string[] =>
    Array.isArray(arr) ? arr.filter((e): e is string => typeof e === "string" && validEvents.has(e)) : [];

  const emailDisabledEvents = sanitize(body.emailDisabledEvents);
  const smsDisabledEvents = sanitize(body.smsDisabledEvents);
  // pushOn عمداً اینجا قابل‌تغییر نیست -- فقط /api/push/subscribe (وقتی
  // واقعاً subscription مرورگر ساخته شد) یا /api/push/unsubscribe می‌توانند
  // آن را عوض کنند؛ اینجا فقط رویدادهای غیرفعالِ پوش را ذخیره می‌کنیم
  const pushDisabledEvents = sanitize(body.pushDisabledEvents);

  await prisma.notificationSetting.upsert({
    where: { userId: session.user.id },
    update: {
      emailOn,
      smsOn,
      emailDisabledEvents: JSON.stringify(emailDisabledEvents),
      smsDisabledEvents: JSON.stringify(smsDisabledEvents),
      pushDisabledEvents: JSON.stringify(pushDisabledEvents),
    },
    create: {
      userId: session.user.id,
      emailOn,
      smsOn,
      emailDisabledEvents: JSON.stringify(emailDisabledEvents),
      smsDisabledEvents: JSON.stringify(smsDisabledEvents),
      pushDisabledEvents: JSON.stringify(pushDisabledEvents),
    },
  });

  return NextResponse.json({ ok: true });
}

export type NotificationEventsPayload = {
  key: NotificationEvent;
  label: string;
};