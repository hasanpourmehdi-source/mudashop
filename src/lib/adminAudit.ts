import { prisma } from "@/lib/prisma";

// ثبتِ یک اقدامِ حساسِ ادمین/کارمند -- برخلاف OrderStatusHistory (که فقط چی و
// کِی رو ثبت می‌کنه)، اینجا مشخص می‌کنه *کی* این کار رو کرده. مثل
// notifyCustomerOutbound هرگز throw نمی‌کند تا کنارِ جریان‌های اصلی (تأیید
// پرداخت، ساختن حساب کارمند و ...) امن باشد -- یه لاگِ گم‌شده بهتر از یه
// درخواستِ ۵۰۰‌شده‌ست.
export async function logAdminAction(opts: {
  adminId: string;
  adminName: string;
  adminEmail: string;
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: string;
}): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminId: opts.adminId,
        adminName: opts.adminName,
        adminEmail: opts.adminEmail,
        action: opts.action,
        targetType: opts.targetType,
        targetId: opts.targetId,
        detail: opts.detail,
      },
    });
  } catch {
    // لاگ مهمه ولی نباید جریان اصلی رو بترکونه
  }
}
