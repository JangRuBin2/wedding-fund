import Link from "next/link";
import { prisma } from "@/lib/db";
import { getGoalStatus } from "@/lib/goal";
import { calendarMonth, checklistOverview } from "@/lib/checklist";
import { dueDateLabel, dueLabel } from "@/lib/wedding";
import { categoryColor } from "@/lib/wedding-meta";
import { getMe } from "@/lib/me";
import { kakaoEnabled } from "@/lib/session";
import { kstParts, manwon, toKst, DAY } from "@/lib/time";
import { SubmitButton } from "@/components/SubmitButton";
import { WeddingHeader } from "@/components/WeddingTabs";
import { ViewSwitch } from "@/components/ViewSwitch";
import { OptimisticCheck } from "@/components/OptimisticCheck";
import { WeddingCalendar, type CalItem } from "@/components/WeddingCalendar";
import { addWeddingStep, createWeddingSteps, fillStepDates, setMe, toggleStep } from "../actions";

export const dynamic = "force-dynamic";

type SP = Promise<{ view?: string | string[] }>;
const one = (v: unknown) => (typeof v === "string" ? v : undefined);
const md = (d: Date) => {
  const p = kstParts(d);
  return `${p.month + 1}/${p.date}`;
};

export default async function WeddingTodoPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const view = one(sp.view) === "calendar" ? "calendar" : "list";
  const now = new Date();
  const [c, status, me, members, cal] = await Promise.all([
    checklistOverview(now),
    getGoalStatus(now),
    getMe(),
    prisma.member.findMany({ orderBy: { createdAt: "asc" } }),
    calendarMonth(new Date(now.getTime() - 3 * 365 * DAY), new Date(now.getTime() + 5 * 365 * DAY)),
  ]);
  const ymd = (d: Date) => toKst(d).toISOString().slice(0, 10);
  const calItems: CalItem[] = [
    ...cal.steps.map((x) => ({ key: `s${x.id}`, ymd: ymd(x.targetDate!), kind: "event" as const, label: x.title, href: `/wedding/event/${x.id}`, color: "var(--color-save)", done: x.done })),
    ...cal.tasks.map((x) => ({ key: `t${x.id}`, ymd: ymd(x.dueDate!), kind: "task" as const, label: x.content, sub: x.step.title, href: `/wedding/event/${x.step.id}`, color: "var(--color-pink)", done: x.done })),
    ...cal.payments.map((x) => ({
      key: `p${x.id}`,
      ymd: ymd(x.paidAt!),
      kind: "pay" as const,
      label: `${x.content} ${manwon(x.amount)}원`,
      sub: x.method === "PLANNED" ? "결제 예정" : "결제",
      href: x.stepId ? `/wedding/event/${x.stepId}` : "/wedding/budget",
      color: categoryColor(x.category),
    })),
  ];
  const undated = c.steps.some((s) => !s.done && !s.targetDate && s.templateKey);
  const upNext = [...c.overdue, ...c.soon].slice(0, 4);

  return (
    <main className="space-y-7">
      <WeddingHeader active="todo" daysLeft={status?.daysLeft} />

      {c.total === 0 ? (
        <section className="card space-y-4">
          <div>
            <p className="text-[17px] font-bold">이벤트부터 만들어 볼까요?</p>
            <p className="mt-1 text-[14px] leading-relaxed text-sub">
              양가 인사부터 결혼식 당일, 신혼여행까지 20개 이벤트를 순서대로 만들어 드려요. 이벤트마다 체크리스트, 메모, 결제를 따로 관리할 수 있어요.
            </p>
          </div>
          <form action={createWeddingSteps}>
            <SubmitButton pendingText="만드는 중…">20개 이벤트로 시작하기</SubmitButton>
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
                <b className="text-[24px] font-extrabold text-ink">{c.done}</b> / {c.total}개 이벤트
              </p>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-paper">
              <div className="h-full rounded-full bg-save" style={{ width: `${c.total ? (c.done / c.total) * 100 : 0}%` }} />
            </div>
            {undated && status && (
              <form action={fillStepDates} className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                <p className="text-[13px] leading-snug text-sub">날짜가 없는 이벤트에 결혼식 날짜 기준 추천 일정을 넣을 수 있어요</p>
                <SubmitButton pendingText="채우는 중…" className="shrink-0 whitespace-nowrap">추천 일정 채우기</SubmitButton>
              </form>
            )}
            {!status && (
              <p className="mt-3 border-t border-line pt-3 text-[13px] text-sub">
                <Link href="/settings" className="font-semibold text-save">설정</Link>에서 결혼식 날짜(목표일)를 정하면 추천 일정을 채울 수 있어요
              </p>
            )}
          </section>

          <ViewSwitch
            initial={view}
            aside={
              me && !kakaoEnabled() ? (
                <form action={setMe}>
                  <button name="name" value="" className="text-[12px] font-medium text-sub">
                    {me}님으로 기록 중 · 바꾸기
                  </button>
                </form>
              ) : null
            }
            views={[
              {
                key: "list",
                label: "리스트",
                content: (
            <>
              {(upNext.length > 0 || c.next) && (
                <section>
                  <h2 className="section-title">
                    곧 할 일
                    <small>{upNext.length ? "30일 안, 밀린 것 먼저" : "다음 이벤트"}</small>
                  </h2>
                  <ul className="card ledger !py-1 ring-1 ring-pink">
                    {(upNext.length ? upNext : [c.next!]).map((s) => {
                      const days = s.targetDate ? Math.ceil((s.targetDate.getTime() - now.getTime()) / DAY) : null;
                      return (
                        <li key={s.id}>
                          <Link href={`/wedding/event/${s.id}`} className="flex items-center gap-3 py-3">
                            <span className={`num w-14 shrink-0 text-[13px] font-bold ${days != null && days < 0 ? "text-spend" : "text-sub"}`}>
                              {days == null ? "다음" : dueLabel(days)}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{s.title}</span>
                            <span className="text-faint" aria-hidden>›</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              <section>
                <h2 className="section-title">전체 흐름</h2>
                <ol className="card !py-2">
                  {c.steps.map((s, i) => {
                    const tasksDone = s.tasks.filter((t) => t.done).length;
                    const paid = s.payments.reduce((sum, p) => sum + p.amount, 0);
                    const days = s.targetDate ? Math.ceil((s.targetDate.getTime() - now.getTime()) / DAY) : null;
                    return (
                      <li key={s.id} className="relative flex gap-3">
                        {i < c.steps.length - 1 && <span className="absolute top-10 bottom-0 left-[15px] w-[2px] bg-line" aria-hidden />}
                        <div className="relative z-[1] py-2">
                          <OptimisticCheck variant="step" done={s.done} action={toggleStep.bind(null, s.id)} label={s.title} number={s.order} />
                        </div>
                        <Link href={`/wedding/event/${s.id}`} className="flex min-w-0 flex-1 items-center gap-2 py-2.5">
                          <span className="min-w-0 flex-1">
                            <span className={`block truncate text-[15px] font-semibold ${s.done ? "text-sub line-through decoration-1" : ""}`}>
                              {s.title}
                            </span>
                            <span className="num block truncate text-[12px] text-sub">
                              {s.done
                                ? `완료 ${[s.doneBy, s.doneAt && md(s.doneAt)].filter(Boolean).join(" · ")}`
                                : s.targetDate
                                  ? `${dueDateLabel(s.targetDate, now)} · ${dueLabel(days!)}`
                                  : "날짜 미정"}
                              {s.tasks.length > 0 && ` · 할 일 ${tasksDone}/${s.tasks.length}`}
                              {paid > 0 && ` · ${manwon(paid)}원`}
                              {s.note && " · 메모"}
                            </span>
                          </span>
                          <span className="text-faint" aria-hidden>›</span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </section>
            </>
                ),
              },
              { key: "calendar", label: "캘린더", content: <WeddingCalendar items={calItems} today={ymd(now)} /> },
            ]}
          />

          <section>
            <h2 className="section-title">이벤트 추가</h2>
            <form action={addWeddingStep} className="card grid grid-cols-2 gap-2">
              <input name="title" placeholder="예: 드레스 투어" required className="input col-span-2" />
              <input name="targetDate" type="date" className="input col-span-2" />
              <SubmitButton pendingText="추가 중…" className="col-span-2">추가</SubmitButton>
            </form>
          </section>
        </>
      )}
    </main>
  );
}
