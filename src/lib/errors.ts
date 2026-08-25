// خطاهایی که پیام‌شان برای نمایش به کاربر نهایی امن است.
// بقیه‌ی خطاها (Prisma، شبکه، ...) نباید مستقیم به کلاینت برگردند چون
// جزئیات داخلی (اسکیمای دیتابیس، stack، ...) لو می‌دهند.
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}