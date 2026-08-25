import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "CUSTOMER" | "ADMIN" | "STAFF";
    } & DefaultSession["user"];
  }

  interface User {
    role?: "CUSTOMER" | "ADMIN" | "STAFF";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "CUSTOMER" | "ADMIN" | "STAFF";
    sid?: string; // شناسه‌ی نشست دستگاه (رجیستری user_sessions)
    ver?: string; // نسخه‌ی امنیتی حساب؛ با «خروج از همه‌جا» عوض می‌شود
  }
}
