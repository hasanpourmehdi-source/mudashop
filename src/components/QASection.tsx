"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Reply = {
  id: string;
  message: string;
  isAdmin: boolean;
  createdAt: string;
  user: { name: string | null };
};

type Question = {
  id: string;
  userId: string | null;
  question: string;
  answer: string | null;
  createdAt: string;
  replies: Reply[];
};

export function QASection({
  productId,
  externalId,
}: {
  productId?: string;
  externalId?: string;
}) {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    const query = productId ? `productId=${productId}` : `externalId=${externalId}`;
    fetch(`/api/questions?${query}`)
      .then((res) => res.json())
      .then(setQuestions);
  }

  useEffect(load, [productId, externalId]);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const res = await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, externalId, question: newQuestion }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "خطا در ثبت پرسش");
      return;
    }
    setNewQuestion("");
    load();
  }

  async function handleAnswer(id: string) {
    const answer = answerDrafts[id];
    if (!answer?.trim()) return;
    await fetch(`/api/admin/questions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
    });
    setAnswerDrafts((prev) => ({ ...prev, [id]: "" }));
    load();
  }

  async function handleReply(id: string) {
    const message = replyDrafts[id];
    if (!message?.trim()) return;
    const res = await fetch(`/api/questions/${id}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (res.ok) {
      setReplyDrafts((prev) => ({ ...prev, [id]: "" }));
      load();
    }
  }

  return (
    <section className="mt-10 pt-8 border-t cut-line">
      <h2 className="font-bold text-lg mb-6">پرسش و پاسخ</h2>

      {status === "authenticated" ? (
        <form onSubmit={handleAsk} className="mb-6 flex gap-2">
          <input
            placeholder="سوال خود را بپرسید..."
            required
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            className="flex-1 border cut-line rounded-lg px-3 py-2 text-sm bg-white"
          />
          <button
            type="submit"
            disabled={submitting}
            className="bg-[var(--color-wine)] text-white px-5 py-2 rounded-full text-sm font-medium disabled:opacity-50"
          >
            پرسیدن
          </button>
        </form>
      ) : (
        <p className="text-sm text-[var(--color-muted)] mb-6">
          برای پرسیدن سوال ابتدا وارد حساب کاربری خود شوید.
        </p>
      )}
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {questions.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">هنوز سوالی پرسیده نشده.</p>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => {
            const canReply = isAdmin || (session?.user?.id && session.user.id === q.userId);
            return (
              <div key={q.id} className="border cut-line rounded-lg p-4 bg-white">
                <p className="text-sm font-medium mb-1">س: {q.question}</p>
                {q.answer ? (
                  <p className="text-sm text-[var(--color-muted)]">ج: {q.answer}</p>
                ) : isAdmin ? (
                  <div className="flex gap-2 mt-2">
                    <input
                      placeholder="پاسخ ادمین..."
                      value={answerDrafts[q.id] ?? ""}
                      onChange={(e) =>
                        setAnswerDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))
                      }
                      className="flex-1 border cut-line rounded-lg px-3 py-1.5 text-sm"
                    />
                    <button
                      onClick={() => handleAnswer(q.id)}
                      className="text-sm bg-[var(--color-wine)] text-white px-3 py-1.5 rounded-full"
                    >
                      ثبت پاسخ
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--color-muted)] italic">هنوز پاسخ داده نشده.</p>
                )}

                {q.replies.length > 0 && (
                  <div className="mt-3 space-y-2 border-t cut-line pt-3">
                    {q.replies.map((r) => (
                      <p key={r.id} className="text-sm">
                        <span
                          className={
                            r.isAdmin
                              ? "font-bold text-[var(--color-wine)]"
                              : "font-bold text-[var(--color-muted)]"
                          }
                        >
                          {r.isAdmin ? "پشتیبانی مُداشاپ" : r.user.name ?? "کاربر"}:
                        </span>{" "}
                        {r.message}
                      </p>
                    ))}
                  </div>
                )}

                {canReply && (
                  <div className="flex gap-2 mt-3">
                    <input
                      placeholder={isAdmin ? "پیام جدید به این گفتگو..." : "ادامه‌ی سوال یا پاسخ به توضیح..."}
                      value={replyDrafts[q.id] ?? ""}
                      onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      className="flex-1 border cut-line rounded-lg px-3 py-1.5 text-xs bg-white"
                    />
                    <button
                      onClick={() => handleReply(q.id)}
                      className="text-xs border cut-line px-3 py-1.5 rounded-full bg-white hover:border-[var(--color-wine)]"
                    >
                      ارسال
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
