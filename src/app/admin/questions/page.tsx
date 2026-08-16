"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Reply = {
  id: string;
  message: string;
  isAdmin: boolean;
  user: { name: string | null };
};

type Question = {
  id: string;
  source: "MAZON" | "TRENDYOL";
  externalId: string | null;
  question: string;
  answer: string | null;
  createdAt: string;
  product: { title: string; slug: string } | null;
  replies: Reply[];
};

function ProductLink({ q }: { q: Question }) {
  if (q.source === "MAZON" && q.product) {
    return (
      <Link href={`/products/mazon/${q.product.slug}`} className="text-xs text-[var(--color-wine)]">
        {q.product.title}
      </Link>
    );
  }
  return (
    <span className="text-xs text-[var(--color-muted)]">محصول ترندیول (شناسه: {q.externalId})</span>
  );
}

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    fetch("/api/admin/questions")
      .then((res) => (res.ok ? res.json() : []))
      .then(setQuestions)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleAnswer(id: string) {
    const answer = drafts[id];
    if (!answer?.trim()) return;
    setError("");
    const res = await fetch(`/api/admin/questions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? `خطا در ثبت پاسخ (کد ${res.status})`);
      return;
    }
    setDrafts((prev) => ({ ...prev, [id]: "" }));
    load();
  }

  async function handleReject(id: string) {
    if (!confirm("این سوال برای همیشه حذف بشه؟ (مثلا چون نامناسبه)")) return;
    setError("");
    const res = await fetch(`/api/admin/questions/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? `خطا در حذف (کد ${res.status})`);
      return;
    }
    load();
  }

  async function handleReply(id: string) {
    const message = replyDrafts[id];
    if (!message?.trim()) return;
    await fetch(`/api/questions/${id}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    setReplyDrafts((prev) => ({ ...prev, [id]: "" }));
    load();
  }

  if (loading) return <p className="text-sm text-[var(--color-muted)]">در حال بارگذاری...</p>;

  const unanswered = questions.filter((q) => !q.answer);
  const answered = questions.filter((q) => q.answer);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-bold mb-6">
          سوالات بی‌پاسخ ({unanswered.length})
        </h1>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>
        )}
        {unanswered.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">همه سوالات پاسخ داده شده‌اند.</p>
        ) : (
          <div className="space-y-3">
            {unanswered.map((q) => (
              <div key={q.id} className="border cut-line rounded-lg p-4 bg-white text-sm">
                <p className="font-medium mb-1">{q.question}</p>
                <ProductLink q={q} />
                <div className="flex gap-2 mt-2">
                  <input
                    placeholder="پاسخ..."
                    value={drafts[q.id] ?? ""}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    className="flex-1 border cut-line rounded-lg px-3 py-1.5"
                  />
                  <button
                    onClick={() => handleAnswer(q.id)}
                    className="bg-[var(--color-wine)] text-white px-3 py-1.5 rounded-full text-xs font-medium shrink-0"
                  >
                    ثبت پاسخ
                  </button>
                  <button
                    onClick={() => handleReject(q.id)}
                    className="text-red-600 border cut-line px-3 py-1.5 rounded-full text-xs font-medium shrink-0"
                  >
                    رد و حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-bold mb-4">پاسخ داده‌شده ({answered.length})</h2>
        <div className="space-y-2">
          {answered.map((q) => (
            <div key={q.id} className="border cut-line rounded-lg p-3 bg-white text-sm">
              <p className="font-medium">{q.question}</p>
              <p className="text-[var(--color-muted)] mt-1">{q.answer}</p>

              {q.replies.length > 0 && (
                <div className="mt-2 space-y-1 border-t cut-line pt-2">
                  {q.replies.map((r) => (
                    <p key={r.id} className="text-xs">
                      <span
                        className={r.isAdmin ? "font-bold text-[var(--color-wine)]" : "font-bold text-[var(--color-muted)]"}
                      >
                        {r.isAdmin ? "پشتیبانی" : r.user.name ?? "کاربر"}:
                      </span>{" "}
                      {r.message}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex gap-2 mt-2">
                <input
                  placeholder="پیام جدید به این گفتگو..."
                  value={replyDrafts[q.id] ?? ""}
                  onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  className="flex-1 border cut-line rounded-lg px-3 py-1.5 text-xs"
                />
                <button
                  onClick={() => handleReply(q.id)}
                  className="text-xs border cut-line px-3 py-1.5 rounded-full bg-white hover:border-[var(--color-wine)] shrink-0"
                >
                  ارسال
                </button>
                <button
                  onClick={() => handleReject(q.id)}
                  className="text-xs text-red-600 border cut-line px-3 py-1.5 rounded-full shrink-0"
                >
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
