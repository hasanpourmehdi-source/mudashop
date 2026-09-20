import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";

// اگه کاربر از قبل لاگین باشه ولی به هر دلیلی (لینکِ قدیمی، نوتیفیکیشن،
// بوکمارک) سر از همین صفحه دربیاره، فرمِ ورود رو دوباره نشونش ندیم -- گیج‌کننده‌ست
// (هدرِ بالای صفحه می‌گه لاگینی، ولی خودِ صفحه فرمِ ورود می‌خواد). به همون
// مقصدی که قرار بود بره (callbackUrl، اگه میدل‌ور ست کرده باشه) هدایتش می‌کنیم
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const { callbackUrl: rawCallbackUrl } = await searchParams;
  const callbackUrl = rawCallbackUrl && rawCallbackUrl.startsWith("/") && !rawCallbackUrl.startsWith("//") ? rawCallbackUrl : "/";

  if (session?.user) {
    redirect(callbackUrl);
  }

  return <LoginForm callbackUrl={callbackUrl} />;
}
