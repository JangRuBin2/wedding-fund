import Link from "next/link";
import { prisma } from "@/lib/db";
import { getGoalStatus } from "@/lib/goal";
import { checklistOverview, suggestionsFor } from "@/lib/checklist";
import { dueDateLabel, dueLabel } from "@/lib/wedding";
import { getMe } from "@/lib/me";
import { toKst } from "@/lib/time";
import { SubmitButton } from "@/components/SubmitButton";
import { WeddingHeader } from "@/components/WeddingTabs";
import {
  addSuggestedTasks,
  addTask,
  addWeddingStep,
  createWeddingSteps,
  deleteTask,
  deleteWeddingStep,
  fillStepDates,
  setMe,
  toggleStep,
  toggleTask,
  updateStep,
} from "../actions";

export const dynamic = "force-dynamic";

const dateInput = (d: Date | null) => (d ? toKst(d).toISOString().slice(0, 10) : "");
const md = (d: Date) => {
  const k = toKst(d);
  return `${k.getUTCMonth() + 1}/${k.getUTCDate()}`;
};
const who = (by: string | null, at: Date | null) => [by, at && md(at)].filter(Boolean).join(" · ");

export default async function WeddingChecklistPage() {
  const now = new Date();
  const [c, status, me, members] = await Promise.all([
    checklistOverview(now),
    getGoalStatus(now),
    getMe(),
    prisma.member.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  const undated = c.steps.some((s) => !s.done && !s.targetDate && s.templateKey);
  const upNext = [...c.overdue, ...c.soon].slice(0, 4);

  return (
    <main className="space-y-7">
      <WeddingHeader active="todo" daysLeft={status?.daysLeft} />

      {c.total === 0 ? (
        <section className="card space-y-4">
          <div>
            <p className="text-[17px] font-bold">체크리스트부터 만들어 볼까요?</p>
            <p className="mt-1 text-[14px] leading-relaxed text-sub">
              양가 인사부터 결혼식 당일, 신혼여행까지 20단계를 순서대로 만들어 드려요. 단계마다 세부 할 일과 누가 체크했는지가 남아요.
            </p>
          </div>
          <form action={createWeddingSteps}>
            <SubmitButton pendingText="만드는 중…">20단계로 시작하기</SubmitButton>
          </form>
        </section>
      ) : (
        <>
          {!me && members.length > 0 && (
            <form action={setMe} className="card flex flex-wrap items-center gap-2 !py-3.5">
              <p className="w-full text-[13px] text-sub">누가 체크했는지 남기려면 이 기기를 쓰는 사람을 골라 주세요</p>
              {members.map((m) => (
                <button key={m.id} name="name" value={m.name} className="btn-ghost !bg-save-soft !text-save">
                  {m.name}
                </button>
              ))}
            </form>
          )}

          <section className="card">
            <div className="flex items-baseline justify-between">
              <p className="text-[15px] text-sub">진행</p>
              <p className="num text-[15px] text-sub">
                <b className="text-[24px] font-extrabold text-ink">{c.done}</b> / {c.total}단계
              </p>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-paper">
              <div className="h-full rounded-full bg-save" style={{ width: `${c.total ? (c.done / c.total) * 100 : 0}%` }} />
            </div>
            {undated && status && (
              <form action={fillStepDates} className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                <p className="text-[13px] leading-snug text-sub">날짜가 없는 단계에 결혼식 날짜 기준 추천 일정을 넣을 수 있어요</p>
                <SubmitButton pendingText="채우는 중…" className="shrink-0 whitespace-nowrap">추천 일정 채우기</SubmitButton>
              </form>
            )}
            {!status && (
              <p className="mt-3 border-t border-line pt-3 text-[13px] text-sub">
                <Link href="/settings" className="font-semibold text-save">설정</Link>에서 결혼식 날짜(목표일)를 정하면 추천 일정을 채울 수 있어요
              </p>
            )}
          </section>

          {(upNext.length > 0 || c.next) && (
            <section>
              <h2 className="section-title">
                곧 할 일
                <small>{upNext.length ? "30일 안, 밀린 것 먼저" : "다음 단계"}</small>
              </h2>
              <ul className="card ledger !py-1 ring-1 ring-pink">
                {(upNext.length ? upNext : [c.next!]).map((s) => {
                  const days = s.targetDate ? Math.ceil((s.targetDate.getTime() - now.getTime()) / 86400_000) : null;
                  return (
                    <li key={s.id} className="flex items-center gap-3 py-3">
                      <span className={`num w-14 shrink-0 text-[13px] font-bold ${days != null && days < 0 ? "text-spend" : "text-sub"}`}>
                        {days == null ? "다음" : dueLabel(days)}
                      </span>
                      <a href={`#step-${s.id}`} className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                        {s.title}
                      </a>
                      {s.tasks.length > 0 && (
                        <span className="num shrink-0 text-[12px] text-sub">
                          {s.tasks.filter((t) => t.done).length}/{s.tasks.length}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section>
            <h2 className="section-title">
              전체 흐름
              {me && (
                <form action={setMe}>
                  <button name="name" value="" className="text-[12px] font-medium text-sub">
                    {me}님으로 기록 중 · 바꾸기
                  </button>
                </form>
              )}
            </h2>
            <ol className="card !py-2">
              {c.steps.map((s, i) => {
                const tasksDone = s.tasks.filter((t) => t.done).length;
                const suggestions = suggestionsFor(s.templateKey).filter((t) => !s.tasks.some((x) => x.content === t.content));
                const days = s.targetDate ? Math.ceil((s.targetDate.getTime() - now.getTime()) / 86400_000) : null;
                return (
                  <li key={s.id} id={`step-${s.id}`} className="relative flex scroll-mt-6 gap-3">
                    {/* 세로선 */}
                    {i < c.steps.length - 1 && <span className="absolute top-9 bottom-0 left-[15px] w-[2px] bg-line" aria-hidden />}
                    <form action={toggleStep.bind(null, s.id)} className="relative z-[1] pt-2">
                      <button
                        aria-label={s.done ? `${s.title} 완료 취소` : `${s.title} 완료`}
                        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-[13px] font-bold ${
                          s.done ? "border-save bg-save text-white" : "border-line bg-card text-sub"
                        }`}
                      >
                        {s.done ? "✓" : s.order}
                      </button>
                    </form>
                    <details className="group min-w-0 flex-1 pb-3" open={!s.done && s.id === c.next?.id}>
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-2 pt-2.5 [&::-webkit-details-marker]:hidden">
                        <span className="min-w-0">
                          <span className={`block text-[15px] font-semibold ${s.done ? "text-sub line-through decoration-1" : ""}`}>{s.title}</span>
                          <span className="num block text-[12px] text-sub">
                            {s.done
                              ? `완료 ${who(s.doneBy, s.doneAt)}`
                              : s.targetDate
                                ? `${dueDateLabel(s.targetDate, now)} · ${dueLabel(days!)}`
                                : "날짜 미정"}
                            {s.tasks.length > 0 && ` · 할 일 ${tasksDone}/${s.tasks.length}`}
                          </span>
                        </span>
                        <span className="mt-1 shrink-0 text-[12px] text-faint group-open:rotate-180" aria-hidden>
                          ▾
                        </span>
                      </summary>

                      <div className="mt-3 space-y-3">
                        {s.hint && <p className="rounded-xl bg-spend-soft px-3 py-2 text-[13px] text-spend">{s.hint}</p>}
                        {s.note && <p className="text-[13px] text-sub">{s.note}</p>}

                        {s.tasks.length > 0 && (
                          <ul className="space-y-1">
                            {s.tasks.map((t) => (
                              <li key={t.id} className="flex items-center gap-2.5">
                                <form action={toggleTask.bind(null, t.id)}>
                                  <button
                                    aria-label={t.done ? "완료 취소" : "완료"}
                                    className={`flex h-5 w-5 items-center justify-center rounded-md border-2 text-[11px] font-bold ${
                                      t.done ? "border-save bg-save text-white" : "border-line"
                                    }`}
                                  >
                                    {t.done ? "✓" : ""}
                                  </button>
                                </form>
                                <span className={`min-w-0 flex-1 text-[14px] ${t.done ? "text-sub line-through" : ""}`}>
                                  {t.section === "행정·혜택" && (
                                    <span className="mr-1.5 rounded-md bg-save-soft px-1.5 py-0.5 text-[10px] font-bold text-save">행정</span>
                                  )}
                                  {t.content}
                                  {t.done && t.doneBy && <span className="ml-1.5 text-[11px] text-faint no-underline">{t.doneBy}</span>}
                                </span>
                                <form action={deleteTask.bind(null, t.id)}>
                                  <button className="px-1 text-[12px] text-faint hover:text-spend" aria-label={`${t.content} 삭제`}>
                                    ✕
                                  </button>
                                </form>
                              </li>
                            ))}
                          </ul>
                        )}

                        <form action={addTask} className="flex gap-2">
                          <input type="hidden" name="stepId" value={s.id} />
                          <input name="content" placeholder="할 일 추가" className="input !py-2 text-[14px]" />
                          <button className="btn-ghost shrink-0 !bg-paper">추가</button>
                        </form>
                        {suggestions.length > 0 && (
                          <form action={addSuggestedTasks.bind(null, s.id)}>
                            <button className="text-[13px] font-semibold text-save">
                              추천 할 일 {suggestions.length}개 넣기 ({suggestions.slice(0, 2).map((x) => x.content).join(", ")}
                              {suggestions.length > 2 ? " …" : ""})
                            </button>
                          </form>
                        )}

                        <details className="rounded-xl bg-paper p-3">
                          <summary className="cursor-pointer list-none text-[12px] font-semibold text-sub [&::-webkit-details-marker]:hidden">
                            단계 고치기
                          </summary>
                          <form action={updateStep} className="mt-3 grid grid-cols-2 gap-2">
                            <input type="hidden" name="id" value={s.id} />
                            <input name="title" defaultValue={s.title} className="input col-span-2 !bg-card" />
                            <input name="targetDate" type="date" defaultValue={dateInput(s.targetDate)} className="input col-span-2 !bg-card" />
                            <input name="note" defaultValue={s.note ?? ""} placeholder="메모 (비고)" className="input col-span-2 !bg-card" />
                            <button className="btn col-span-2">저장</button>
                          </form>
                          <form action={deleteWeddingStep.bind(null, s.id)} className="mt-2 text-right">
                            <button className="btn-ghost !text-spend">이 단계 삭제</button>
                          </form>
                        </details>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ol>
          </section>

          <section>
            <h2 className="section-title">단계 추가</h2>
            <form action={addWeddingStep} className="card grid grid-cols-2 gap-2">
              <input name="title" placeholder="예: 웨딩슈즈 고르기" required className="input col-span-2" />
              <input name="targetDate" type="date" className="input col-span-2" />
              <button className="btn col-span-2">추가</button>
            </form>
          </section>
        </>
      )}
    </main>
  );
}
