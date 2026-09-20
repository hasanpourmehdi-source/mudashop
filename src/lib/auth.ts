import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { verifyCaptcha } from "@/lib/captcha";

// محافظت در برابر brute-force: بعد از این تعداد رمز اشتباه پیاپی، حساب برای
// مدتی قفل می‌شود (نه برای همیشه -- تا یک کاربر واقعی که رمزش را فراموش کرده
// هم بتواند بعد از مدتی دوباره امتحان کند یا رمزش را بازیابی کند)
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // ۱۵ دقیقه

function minutesLeft(until: Date): number {
  return Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60_000));
}

const { handlers, auth: uncachedAuth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/auth/login",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        captchaId: { label: "CaptchaId", type: "text" },
        captchaAnswer: { label: "CaptchaAnswer", type: "text" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        const captchaId = credentials?.captchaId as string | undefined;
        const captchaAnswer = credentials?.captchaAnswer as string | undefined;
        if (!email || !password) return null;

        // کپچا برای ورود الزامی است (مثل تگموند) -- جلوگیری از brute-force
        if (!verifyCaptcha(captchaId, captchaAnswer)) {
          throw new Error("کد امنیتی اشتباه است -- لطفاً دوباره امتحان کنید");
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.password) return null;
        if (user.status === "BANNED") throw new Error("این حساب مسدود شده است");

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          throw new Error(
            `به‌خاطر تلاش‌های ناموفق زیاد، این حساب موقتاً قفل شده. حدود ${minutesLeft(user.lockedUntil)} دقیقه دیگر دوباره امتحان کنید.`
          );
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
          const attempts = user.failedLoginAttempts + 1;
          if (attempts >= MAX_LOGIN_ATTEMPTS) {
            await prisma.user.update({
              where: { id: user.id },
              data: { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + LOCKOUT_MS) },
            });
            throw new Error(
              `به‌خاطر ${MAX_LOGIN_ATTEMPTS} بار رمز اشتباه پیاپی، این حساب برای ۱۵ دقیقه قفل شد.`
            );
          }
          await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: attempts } });
          return null;
        }

        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // ورود: برای این دستگاه یک شناسه‌ی نشست تازه می‌سازیم و نسخه‌ی امنیتی حساب را
        // توی توکن می‌گذاریم تا «خروج از همه‌جا» (securityStamp) همه‌ی JWTها را باطل کند.
        // ردیف متناظر user_sessions توسط registerDeviceAfterAuth ساخته می‌شود.
        token.sid = randomUUID();
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id as string },
          select: { securityStamp: true },
        });
        token.ver = dbUser?.securityStamp ?? "initial";
        token.role = ((user as { role?: "CUSTOMER" | "ADMIN" | "STAFF" }).role ?? "CUSTOMER");
        token.id = user.id;
        return token;
      }

      // دسترسی‌های بعدی: نشست را اعتبارسنجی کن
      if (token.sid) {
        const sid = token.sid as string;
        const sess = await prisma.userSession.findUnique({
          where: { sid },
          select: { revokedAt: true, userId: true, lastSeenAt: true },
        });

        if (sess) {
          if (sess.revokedAt) return null; // این دستگاه حذف شده

          const dbUser = await prisma.user.findUnique({
            where: { id: sess.userId },
            select: { securityStamp: true },
          });
          if (!dbUser) return null;
          // «خروج از همه‌جا» نسخه را عوض کرده؟ توکن قدیمی بی‌اعتبار است
          if (token.ver !== dbUser.securityStamp) return null;

          // lastSeen را کم‌دفعات به‌روز کن (حداکثر هر ۱۵ دقیقه)
          if (Date.now() - sess.lastSeenAt.getTime() > 15 * 60_000) {
            await prisma.userSession
              .update({ where: { sid }, data: { lastSeenAt: new Date() } })
              .catch(() => {});
          }
        }
        // اگر ردیف نشست پیدا نشد (مثلاً خطای ثبت در همان لحظه‌ی ورود)،
        // امنیت را سخت نگیریم؛ کنترل واقعی از طریق securityStamp است.
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as "CUSTOMER" | "ADMIN" | "STAFF") ?? "CUSTOMER";
      }
      return session;
    },
    async signIn({ user, account }) {
      // برای ورود گوگل: اگر کاربر با این ایمیل از قبل با پسورد ثبت‌نام کرده، وصل می‌کنیم.
      // چون گوگل خودش مالکیتِ ایمیل رو تأیید کرده، اینجا emailVerified هم ست
      // می‌شه -- نه برای حساب‌های تازه‌ساخته فقط، بلکه برای حساب‌های قدیمیِ
      // رمزدار که برای اولین‌بار با گوگل وارد می‌شن هم (اگه هنوز تأیید نشده بودن)
      if (account?.provider === "google" && user.email) {
        const existing = await prisma.user.findUnique({ where: { email: user.email } });
        if (!existing) {
          await prisma.user.create({
            data: {
              email: user.email,
              name: user.name,
              image: user.image,
              emailVerified: new Date(),
            },
          });
        } else if (!existing.emailVerified) {
          await prisma.user.update({ where: { id: existing.id }, data: { emailVerified: new Date() } });
        }
      }
      return true;
    },
  },
});

// خیلی از صفحه‌ها + خودِ layout ریشه، هرکدوم مستقلاً auth() صدا می‌زنن -- بدونِ
// cache، یعنی برای هر بارگذاریِ صفحه (برای کاربرِ لاگین‌کرده) کوئریِ اعتبارسنجیِ
// نشست (jwt callback: userSession.findUnique + user.findUnique) چندین بار
// تکراری روی DB اجرا می‌شد. cache() فقط داخلِ همون یک رندرِ سرور (یه
// درخواستِ HTTP) نتیجه رو یادش می‌مونه -- نه بینِ درخواست‌های جدا -- پس
// تازگیِ نشست/لغوِ فوری دست‌نخورده می‌مونه
export const auth = cache(uncachedAuth);
export { handlers, signIn, signOut };
