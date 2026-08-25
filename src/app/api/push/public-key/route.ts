import { NextResponse } from "next/server";

// کلید عمومی VAPID برای ساختِ subscription توی مرورگر (pushManager.subscribe).
// اگه VAPID پیکربندی نشده باشه (محیطی که هنوز کلید نساخته)، publicKey=null
// برمی‌گرده تا کلاینت دکمه‌ی فعال‌سازی پوش رو کلاً نشون ندهد.
export async function GET() {
  return NextResponse.json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? null });
}
