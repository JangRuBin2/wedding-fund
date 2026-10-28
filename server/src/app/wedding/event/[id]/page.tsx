import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { suggestionsFor } from "@/lib/checklist";
import { dueDateLabel, dueLabel } from "@/lib/wedding";
import { categoryColor, PAY_METHODS, PAYERS, WEDDING_CATEGORIES } from "@/lib/wedding-meta";
import { kstParts, manwon, toKst, DAY } from "@/lib/time";
import {
  addPayment,
  addSuggestedTasks,
  addTask,
  deletePayment,
  deleteTask,
  deleteWeddingStep,
  markPaymentPaid,
  saveStepMemo,
  setTaskDate,
  toggleStep,
  toggleTask,
  updateStep,
} from "../../../actions";

export const dynamic = "force-dynamic";

const dateInput = (d: Date | null) => (d ? toKst(d).toISOString().slice(0, 10) : "");
const md = (d: Date) => {
  const p = kstParts(d);
  return `${p.month + 1}/${p.date}`;
};

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
  const defaultCategory = s.payments.at(-1)?.category ?? "기타";

  return (
    <main className="space-y-7">
      <header className="space-y-3">
        <Link href="/wedding" className="text-[13px] font-semibold text-sub">‹ 할 일</Link>
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
            <button className="rounded-full bg-white/90 px-3.5 py-2 text-[13px] font-bold text-save">
              {s.done ? "완료 취소" : "완료"}
            </button>
          </form>
        </div>
        {s.hint && <p className="rounded-xl bg-spend-soft px-3 py-2 text-[13px] text-spend">{s.hint}</p>}
      </header>

      {/* 체크리스트 */}
      <section>
        <h2 className="section-title">
          체크리스트
          <small className="num">
            {s.tasks.filter((t) => t.done).length}/{s.tasks.length}
          </small>
        </h2>
        <div className="card space-y-3">
          {s.tasks.length > 0 && (
            <ul className="ledger">
              {s.tasks.map((t) => {
                const tDays = t.dueDate ? Math.ceil((t.dueDate.getTime() - now.getTime()) / DAY) : null;
                return (
                  <li key={t.id} className="py-2.5">
                    <div className="flex items-start gap-2.5">
                      <form action={toggleTask.bind(null, t.id)} className="pt-0.5">
                        <button
                          aria-label={t.done ? `${t.content} 완료 취소` : `${t.content} 완료`}
                          className={`flex h-5 w-5 items-center justify-center rounded-md border-2 text-[11px] font-bold ${
                            t.done ? "border-save bg-save text-white" : "border-line"
                          }`}
                        >
                          {t.done ? "✓" : ""}
                        </button>
                      </form>
                      <div className="min-w-0 flex-1">
                        <p className={`text-[14px] ${t.done ? "text-sub line-through" : ""}`}>
                          {t.section === "행정·혜택" && (
                            <span className="mr-1.5 rounded-md bg-save-soft px-1.5 py-0.5 text-[10px] font-bold text-save no-underline">행정</span>
                          )}
                          {t.content}
                        </p>
                        <details className="group">
                          <summary className="num cursor-pointer list-none text-[12px] text-sub [&::-webkit-details-marker]:hidden">
                            {t.dueDate ? (
                              <span className={!t.done && tDays! < 0 ? "font-semibold text-spend" : ""}>
                                📅 {dueDateLabel(t.dueDate, now)} · {dueLabel(tDays!)}
                              </span>
                            ) : (
                              <span className="text-faint">+ 일정</span>
                            )}
                            {t.done && t.doneBy && <span className="ml-1.5">· {t.doneBy}</span>}
                          </summary>
                          <form action={setTaskDate} className="mt-2 flex gap-2">
                            <input type="hidden" name="id" value={t.id} />
                            <input name="dueDate" type="date" defaultValue={dateInput(t.dueDate)} className="input !py-1.5 text-[13px]" />
                            <button className="btn-ghost shrink-0 !bg-paper">저장</button>
                          </form>
                        </details>
                      </div>
                      <form action={deleteTask.bind(null, t.id)}>
                        <button className="px-1 text-[12px] text-faint hover:text-spend" aria-label={`${t.content} 삭제`}>✕</button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <form action={addTask} className="grid grid-cols-[1fr_auto] gap-2">
            <input type="hidden" name="stepId" value={s.id} />
            <input name="content" placeholder="예: 촬영용 옷 구매" required className="input col-span-2 text-[14px]" />
            <input name="dueDate" type="date" aria-label="일정 (선택)" className="input text-[14px]" />
            <button className="btn shrink-0">추가</button>
          </form>
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
        <h2 className="section-title">메모</h2>
        <form action={saveStepMemo} className="card space-y-2">
          <input type="hidden" name="id" value={s.id} />
          <textarea
            name="note"
            defaultValue={s.note ?? ""}
            rows={4}
            placeholder="예: 머리 시안 어떻게 하지? 업체에 물어볼 것"
            className="input resize-y text-[14px] leading-relaxed"
          />
          <div className="text-right">
            <button className="btn-ghost !bg-paper">메모 저장</button>
          </div>
        </form>
      </section>

      {/* 결제관리 */}
      <section>
        <h2 className="section-title">
          결제관리
          <small className="num">
            {manwon(paidSum)}원 냄{plannedSum > 0 && ` · ${manwon(plannedSum)}원 예정`}
          </small>
        </h2>
        <div className="card space-y-4">
          {s.payments.length > 0 && (
            <ul className="ledger">
              {s.payments.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: categoryColor(p.category) }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">{p.content}</p>
                    <p className="num truncate text-[12px] text-sub">
                      {p.category} · {PAY_METHODS[p.method as keyof typeof PAY_METHODS] ?? p.method} ·{" "}
                      {p.payer === "OTHER" ? p.payerNote || "기타" : PAYERS[p.payer as keyof typeof PAYERS] ?? p.payer}
                      {p.paidAt && ` · ${md(p.paidAt)}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`num text-[15px] font-bold ${p.method === "PLANNED" ? "text-sub" : ""}`}>{p.amount.toLocaleString("ko-KR")}원</p>
                    <div className="flex justify-end gap-2 text-[12px]">
                      {p.method === "PLANNED" && (
                        <form action={markPaymentPaid.bind(null, p.id)}>
                          <button className="font-semibold text-save">냈어요</button>
                        </form>
                      )}
                      <form action={deletePayment.bind(null, p.id)}>
                        <button className="text-faint hover:text-spend">삭제</button>
                      </form>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form action={addPayment} className="grid grid-cols-2 gap-2 border-t border-line pt-4 first:border-t-0 first:pt-0">
            <input type="hidden" name="stepId" value={s.id} />
            <fieldset className="col-span-2 space-y-1">
              <legend className="label mb-1">예산 구분</legend>
              <div className="flex flex-wrap gap-1.5">
                {WEDDING_CATEGORIES.map((c) => (
                  <label key={c.name} className="cursor-pointer">
                    <input type="radio" name="category" value={c.name} defaultChecked={c.name === defaultCategory} className="peer sr-only" />
                    <span
                      className="block rounded-full border-2 border-transparent bg-paper px-3 py-1.5 text-[13px] font-semibold text-sub peer-checked:text-ink peer-focus-visible:outline peer-checked:[border-color:var(--c)]"
                      style={{ "--c": c.color } as React.CSSProperties}
                    >
                      <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: c.color }} />
                      {c.name}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <input name="content" placeholder="내용 (예: 헤어변형)" required className="input col-span-2" />
            <input name="amount" inputMode="numeric" placeholder="금액 (원)" required className="input num" />
            <input name="paidAt" type="date" defaultValue={dateInput(now)} aria-label="결제일 (예정일)" className="input" />
            <select name="method" defaultValue="CARD" className="input" aria-label="결제 방식">
              {Object.entries(PAY_METHODS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select name="payer" defaultValue="GROOM" className="input" aria-label="결제자">
              {Object.entries(PAYERS).map(([k, v]) => (
                <option key={k} value={k}>{v === "기타" ? "기타 (부모님 등)" : v}</option>
              ))}
            </select>
            <input name="payerNote" placeholder="결제자가 기타면 누구인지 (예: 신부 어머니)" className="input col-span-2 text-[14px]" />
            <button className="btn col-span-2">결제 추가</button>
          </form>
        </div>
        <p className="mt-2 px-1 text-[12px] text-sub">
          여기 적은 결제는 <Link href="/wedding/budget" className="font-semibold text-save">예산 탭</Link>의 사용량 막대에 같은 색으로 쌓여요
        </p>
      </section>

      <details className="card">
        <summary className="cursor-pointer list-none text-[14px] font-semibold text-sub [&::-webkit-details-marker]:hidden">이벤트 고치기</summary>
        <form action={updateStep} className="mt-3 grid grid-cols-2 gap-2">
          <input type="hidden" name="id" value={s.id} />
          <input type="hidden" name="note" value={s.note ?? ""} />
          <input name="title" defaultValue={s.title} className="input col-span-2" />
          <input name="targetDate" type="date" defaultValue={dateInput(s.targetDate)} className="input col-span-2" />
          <button className="btn col-span-2">저장</button>
        </form>
        <form action={deleteWeddingStep.bind(null, s.id)} className="mt-2 text-right">
          <button className="btn-ghost !text-spend">이 이벤트 삭제</button>
        </form>
      </details>
    </main>
  );
}
