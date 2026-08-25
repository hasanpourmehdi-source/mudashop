// مدیریت حساب چنددستگاهی و امنیت نشست‌ها.
// بخش‌های خالص (تشخیص دستگاه، اعتبار نشست) برای تست واحد جدا هستند؛
// بخش‌های دیتابیس در همان پروژه استفاده می‌شوند و خطاها را قورت می‌دهند تا
// هرگز جریان ورود/خرید را خراب نکنند.

import { randomUUID } from "crypto";
import { decode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { notifyCustomerOutbound } from "@/lib/outboundNotify";

// ---------- بخش خالص: تشخیص دستگاه ----------

export type ParsedDevice = { browser: string; os: string; kind: "رایانه" | "موبایل" | "تبلت" | "نا‌شناس" };

// استخراج نام مرورگر و سیستم‌عامل از User-Agent -- خالص و قابل تست
export function parseUserAgent(ua: string): ParsedDevice {
  let browser = "مرورگر ناشناس";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/opr\//i.test(ua) || /opera/i.test(ua)) browser = "Opera";
  else if (/chrome\//i.test(ua)) browser = "Chrome";
  else if (/firefox\//i.test(ua)) browser = "Firefox";
  else if (/safari\//i.test(ua)) browser = "Safari";
  else if (/msie |trident\//i.test(ua)) browser = "Internet Explorer";

  let os = "سیستم‌عامل ناشناس";
  if (/windows nt/i.test(ua)) os = "Windows";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ios/i.test(ua)) os = "iOS";
  else if (/mac os x|macintosh/i.test(ua)) os = "macOS";
  else if (/linux/i.test(ua)) os = "Linux";

  let kind: ParsedDevice["kind"] = "رایانه";
  if (/ipad|tablet/i.test(ua)) kind = "تبلت";
  else if (/mobile|android|iphone/i.test(ua)) kind = "موبایل";

  return { browser, os, kind };
}

// برچسب نمایشی دستگاه برای لیست نشست‌ها -- خالص
export function buildDeviceLabel(ua?: string | null): string {
  if (!ua) return "دستگاه ناشناس";
  const { browser, os } = parseUserAgent(ua);
  if (browser === "مرورگر ناشناس" && os === "سیستم‌عامل ناشناس") return "دستگاه ناشناس";
  return `${browser} روی ${os}`;
}

// اعتبارسنجی نشست بر اساس باطل‌شدن و نسخه‌ی امنیتی -- خالص
export function isSessionValid(opts: {
  revokedAt?: Date | null;
  tokenVer?: string | null;
  userVer?: string | null;
}): boolean {
  if (opts.revokedAt) return false;
  if (opts.tokenVer && opts.userVer && opts.tokenVer !== opts.userVer) return false;
  return true;
}

// پس‌انداز برای دستگاهِ بدون کوکی -- خالص (فقط برای مواقعی که device_id نداریم)
export function fallbackDeviceId(ua?: string | null): string {
  return `ua:${ua ? ua.slice(0, 200) : "none"}`;
}

// ---------- توابع کمکی کوکی ----------

export function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

export function parseSetCookies(setCookieHeader: string | null): Array<[string, string]> {
  if (!setCookieHeader) return [];
  const out: Array<[string, string]> = [];
  for (const part of setCookieHeader.split(",")) {
    const [kv] = part.split(";");
    const eq = kv.indexOf("=");
    if (eq <= 0) continue;
    out.push([kv.slice(0, eq).trim(), kv.slice(eq + 1).trim()]);
  }
  return out;
}

// ---------- بخش دیتابیس ----------

export type SessionListItem = {
  id: string;
  deviceLabel: string;
  ip: string | null;
  isCurrent: boolean;
  createdAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
};

// شناسه‌ی نشست (sid) داخل JWTِ کوکیِ درخواست فعلی -- برای «حفظ دستگاه فعلی» هنگام خروج از بقیه
export async function sessionSidFromRequest(req: Request): Promise<string | null> {
  try {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const cookieName = cookieHeader.includes("__Secure-authjs.session-token")
      ? "__Secure-authjs.session-token"
      : "authjs.session-token";
    const token = readCookie(cookieHeader, cookieName);
    if (!token) return null;
    const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
    if (!secret) return null;
    const payload = await decode({ token, secret, salt: cookieName });
    return (payload?.sid as string) ?? null;
  } catch {
    return null;
  }
}

export async function listUserSessions(userId: string): Promise<SessionListItem[]> {
  const rows = await prisma.userSession.findMany({
    where: { userId },
    orderBy: { lastSeenAt: "desc" },
    take: 20,
  });
  return rows.map((r) => ({
    id: r.id,
    deviceLabel: buildDeviceLabel(r.userAgent),
    ip: r.ip,
    isCurrent: r.isCurrent,
    createdAt: r.createdAt,
    lastSeenAt: r.lastSeenAt,
    revokedAt: r.revokedAt,
  }));
}

// لغو یک دستگاه دیگر (نه دستگاه فعلی)
export async function revokeSessionForUser(userId: string, sessionId: string): Promise<"ok" | "not-found" | "forbidden"> {
  const row = await prisma.userSession.findFirst({ where: { id: sessionId, userId } });
  if (!row) return "not-found";
  if (row.isCurrent) return "forbidden";
  await prisma.userSession.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
  return "ok";
}

// خروج از همه‌ی دستگاه‌های دیگر؛ دستگاه فعلی (currentSid) می‌ماند
export async function revokeOtherSessions(userId: string, currentSid: string | null): Promise<number> {
  const res = await prisma.userSession.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(currentSid ? { sid: { not: currentSid } } : { isCurrent: false }),
    },
    data: { revokedAt: new Date() },
  });
  return res.count;
}

// خروج از همه‌جا: نسخه‌ی امنیتی عوض می‌شود (همه‌ی JWTها بی‌اعتبار) + همه‌ی نشست‌ها باطل
export async function logoutEverywhere(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { securityStamp: randomUUID() } }),
    prisma.userSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}

// اعلان «ورود از دستگاه جدید»: زنگوله داخل سایت + ایمیل/پیامک خارج از سایت
export async function notifyNewDeviceLogin(userId: string, label: string, ip?: string | null): Promise<void> {
  const ipText = ip ? ` (IP: ${ip})` : "";
  await prisma.notification.create({
    data: {
      userId,
      message: `ورود از یک دستگاه جدید: ${label}${ipText}. اگه این خودت نبودی، از صفحه‌ی «امنیت و دستگاه‌ها» آن را حذف کن.`,
      link: "/profile/security",
    },
  });
  await notifyCustomerOutbound({
    userId,
    eventType: "NEW_DEVICE_LOGIN",
    title: "ورود از دستگاه جدید",
    body: `به حساب شما از یک دستگاه جدید وارد شده است: ${label}${ipText}. اگر این شما نیستید، وارد حساب شوید و از «امنیت و دستگاه‌ها» آن را حذف کنید.`,
  });
}

// بعد از موفقیت ورود در NextAuth صدا زده می‌شود: کوکی نشستِ تازه را دیکد می‌کند،
// دستگاه را در user_sessions ثبت/به‌روز می‌کند و اگر دستگاه جدید باشد اعلان می‌دهد.
// هرگز throw نمی‌کند تا ورود با خطای ثبت دستگاه خراب نشود.
export async function registerDeviceAfterAuth(req: Request, res: Response): Promise<void> {
  try {
    // از getSetCookie استفاده می‌کنیم چون مقدارهای جدا (مثل Expires) کاما دارند
    // و split ساده روی هدر ترکیبی آن را می‌شکند.
    const rawCookies: string[] = res.headers.getSetCookie();
    const sessionCookie: [string, string] | undefined = rawCookies
      .map((h) => parseSetCookies(h)[0])
      .find((c) => c && c[0].endsWith("session-token"));
    if (!sessionCookie || !sessionCookie[1]) return; // مثلاً خروج (set-cookie پاک‌شده)

    const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
    if (!secret) return;

    const payload = await decode({ token: sessionCookie[1], secret, salt: sessionCookie[0] });
    const userId = (payload?.id ?? payload?.sub) as string | undefined;
    const sid = payload?.sid as string | undefined;
    if (!userId || !sid) return;

    const cookieHeader = req.headers.get("cookie");
    const deviceId = readCookie(cookieHeader, "device_id") ?? fallbackDeviceId(req.headers.get("user-agent"));
    const userAgent = req.headers.get("user-agent") ?? undefined;
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;

    const prior = await prisma.userSession.findFirst({ where: { userId, deviceId } });
    const isNewDevice = !prior;

    if (prior) {
      await prisma.userSession.update({
        where: { id: prior.id },
        data: { sid, userAgent, ip, isCurrent: true, revokedAt: null, lastSeenAt: new Date() },
      });
    } else {
      await prisma.userSession.create({ data: { userId, sid, deviceId, userAgent, ip, isCurrent: true } });
    }

    // فقط آخرین دستگاه، «دستگاه فعلی» بماند
    await prisma.userSession.updateMany({
      where: { userId, sid: { not: sid }, isCurrent: true },
      data: { isCurrent: false },
    });

    if (isNewDevice) {
      await notifyNewDeviceLogin(userId, buildDeviceLabel(userAgent), ip);
    }
  } catch {
    // ثبت دستگاه خراب شد؟ ورود را خراب نکن
  }
}