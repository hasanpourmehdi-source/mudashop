import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { revokeSessionForUser } from "@/lib/security";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "احراز هویت لازم است" }, { status: 401 });
  }
  const { id } = await params;
  const result = await revokeSessionForUser(session.user.id, id);

  if (result === "not-found") {
    return NextResponse.json({ error: "دستگاه پیدا نشد" }, { status: 404 });
  }
  if (result === "forbidden") {
    return NextResponse.json({ error: "نمی‌توانی دستگاه فعلی را از این‌جا حذف کنی" }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}