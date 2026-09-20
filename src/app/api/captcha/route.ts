import { NextResponse } from "next/server";
import { createCaptcha } from "@/lib/captcha";

export async function GET() {
  const { id, question } = createCaptcha();
  return NextResponse.json({ id, question });
}
