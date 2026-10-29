import Link from "next/link";
import { SubmitButton } from "@/components/SubmitButton";
import { OptimisticCheck } from "@/components/OptimisticCheck";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { suggestionsFor } from "@/lib/checklist";
import { dueDateLabel, dueLabel } from "@/lib/wedding";
import { categoryColor, PAY_METHODS, PAYERS } from "@/lib/wedding-meta";
import { kstParts, manwon, DAY } from "@/lib/time";
import { addSuggestedTasks, markPaymentPaid, toggleStep, toggleTask } from "../../../actions";

export const dynamic = "force-dynamic";

const md = (d: Date) => {
  const p = kstParts(d);
  return `${p.month + 1}/${p.date}`;
};

/** 이벤트 보기 화면. 입력 칸은 없고, 추가·수정은 작성 화면으로 넘어감 (체크·'냈어요'처럼 한 번 누르면 끝나는 것만 여기서) */
export default async function WeddingEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const now = new Date();
  const s = await prisma.weddingStep.findUnique({
    where: { id },
    include: {
      tasks: { orderBy: [{ done: "asc" }, { dueDate: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] },
      payments: { orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!s) notFound();

  const days = s.targetDate ? Math.ceil((s.targetDate.getTime() - now.getTime()) / DAY) : null;
  const suggestions = suggestionsFor(s.templateKey).filter((t) => !s.tasks.some((x) => x.content === t.content));
  const paidSum = s.payments.filter((p) => p.method !== "PLANNED").reduce((sum, p) => sum + p.amount, 0);
  const plannedSum = s.payments.filter((p) => p.method === "PLANNED").reduce((sum, p) => sum + p.amount, 0);
  const base = `/wedding/event/${s.id}`;

  return (
    <main className="space-y-7">
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <Link href="/wedding" className="text-[13px] font-semibold text-sub">‹ 할 일</Link>
          <Link href={`${base}/edit`} className="text-[13px] font-semibold text-save">수정</Link>
        </div>
        <div className="hero flex items-start gap-3 p-5">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-cover-sub">이벤트 {s.order}</p>
            <h1 className={`text-[22px] leading-tight font-bold ${s.done ? "line-through decoration-2" : ""}`}>{s.title}</h1>
            <p className="num mt-1.5 text-[13px] text-cover-sub">
              {s.targetDate ? `${dueDateLabel(s.targetDate, now)} · ${dueLabel(days!)}` : "날짜 미정"}
              {s.done && ` · 완료 ${[s.doneBy, s.doneAt && md(s.doneAt)].filter(Boolean).join(" · ")}`}
            </p>
          </div>
          <form action={toggleStep.bind(null, s.id)}>
            <SubmitButton base="" pendingText="…" className="rounded-full bg-white/90 px-3.5 py-2 text-[13px] font-bold text-save">
              {s.done ? "완료 취소" : "완료"}
            </SubmitButton>
          </form>
        </div>
        {s.hint && <p className="rounded-xl bg-spend-soft px-3 py-2 text-[13px] text-spend">{s.hint}</p>}
      </header>

      {/* 체크리스트 */}
      <section>
        <h2 className="section-title !justify-start">
          체크리스트
          <small className="num">
            {s.tasks.filter((t) => t.done).length}/{s.tasks.length}
          </small>
          <AddLink href={`${base}/task/new`}>+ 할 일</AddLink>
        </h2>
        <div className="card space-y-3">
          {s.tasks.length > 0 ? (
            <ul className="ledger">
              {s.tasks.map((t) => {
                const tDays = t.dueDate ? Math.ceil((t.dueDate.getTime() - now.getTime()) / DAY) : null;
                return (
                  <li key={t.id} className="flex items-start gap-2.5 py-2.5">
                    <div className="pt-0.5">
                      <OptimisticCheck done={t.done} action={toggleTask.bind(null, t.id)} label={t.content} />
                    </div>
                    <Link href={`/wedding/task/${t.id}`} className="flex min-w-0 flex-1 items-start gap-2">
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[14px] ${t.done ? "text-sub line-through" : ""}`}>
                          {t.section === "행정·혜택" && (
                            <span className="mr-1.5 rounded-md bg-save-soft px-1.5 py-0.5 text-[10px] font-bold text-save no-underline">행정</span>
                          )}
                          {t.content}
                        </span>
                        {(t.dueDate || (t.done && t.doneBy)) && (
                          <span className="num block text-[12px] text-sub">
                            {t.dueDate && (
                              <span className={!t.done && tDays! < 0 ? "font-semibold text-spend" : ""}>
                                📅 {dueDateLabel(t.dueDate, now)} · {dueLabel(tDays!)}
                              </span>
                            )}
                            {t.done && t.doneBy && <span className={t.dueDate ? "ml-1.5" : ""}>{t.dueDate ? "· " : ""}{t.doneBy}</span>}
                          </span>
                        )}
                      </span>
                      <span className="pt-0.5 text-faint" aria-hidden>›</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[14px] text-sub">아직 할 일이 없어요</p>
          )}
          {suggestions.length > 0 && (
            <form action={addSuggestedTasks.bind(null, s.id)}>
              <button className="text-[13px] font-semibold text-save">
                추천 할 일 {suggestions.length}개 넣기 ({suggestions.slice(0, 2).map((x) => x.content).join(", ")}
                {suggestions.length > 2 ? " …" : ""})
              </button>
            </form>
          )}
        </div>
      </section>

      {/* 메모 */}
      <section>
        <h2 className="section-title !justify-start">
          메모
          <AddLink href={`${base}/memo`}>{s.note ? "메모 수정" : "메모 쓰기"}</AddLink>
        </h2>
        <div className="card">
          {s.note ? (
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{s.note}</p>
          ) : (
            <p className="text-[14px] text-sub">아직 메모가 없어요</p>
          )}
        </div>
      </section>

      {/* 결제관리 */}
      <section>
        <h2 className="section-title !justify-start">
          결제관리
          <small className="num">
            {manwon(paidSum)}원 냄{plannedSum > 0 && ` · ${manwon(plannedSum)}원 예정`}
          </small>
          <AddLink href={`${base}/payment/new`}>+ 결제</AddLink>
        </h2>
        <div className="card">
          {s.payments.length > 0 ? (
            <ul className="ledger">
              {s.payments.map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  <Link href={`/wedding/payment/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-3">
                    <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: categoryColor(p.category) }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{p.content}</span>
                      <span className="num block truncate text-[12px] text-sub">
                        {p.category} · {PAY_METHODS[p.method as keyof typeof PAY_METHODS] ?? p.method} ·{" "}
                        {p.payer === "OTHER" ? p.payerNote || "기타" : PAYERS[p.payer as keyof typeof PAYERS] ?? p.payer}
                        {p.paidAt && ` · ${md(p.paidAt)}`}
                      </span>
                    </span>
                    <span className={`num shrink-0 text-[15px] font-bold ${p.method === "PLANNED" ? "text-sub" : ""}`}>
                      {p.amount.toLocaleString("ko-KR")}원
                    </span>
                  </Link>
                  {p.method === "PLANNED" && (
                    <form action={markPaymentPaid.bind(null, p.id)}>
                      <SubmitButton base="btn-ghost" pendingText="…" className="!bg-save-soft !px-2.5 !py-1.5 text-[12px] !text-save">
                        냈어요
                      </SubmitButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-sub">아직 기록한 결제가 없어요</p>
          )}
        </div>
        <p className="mt-2 px-1 text-[12px] text-sub">
          여기 적은 결제는 <Link href="/wedding/budget" className="font-semibold text-save">예산 탭</Link>의 사용량 막대에 같은 색으로 쌓여요
        </p>
      </section>
    </main>
  );
}

/** 섹션 제목 오른쪽의 작성 화면 링크 */
function AddLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="ml-auto text-[13px] font-semibold text-save">
      {children}
    </Link>
  );
}
