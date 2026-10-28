import Link from "next/link";
import { prisma } from "@/lib/db";
import { getGoalStatus } from "@/lib/goal";
import { calendarMonth, checklistOverview } from "@/lib/checklist";
import { dueDateLabel, dueLabel } from "@/lib/wedding";
import { categoryColor } from "@/lib/wedding-meta";
import { getMe } from "@/lib/me";
import { kakaoEnabled } from "@/lib/session";
import { kstMonthStart, kstParts, manwon, DAY } from "@/lib/time";
import { SubmitButton } from "@/components/SubmitButton";
import { WeddingHeader } from "@/components/WeddingTabs";
import { addWeddingStep, createWeddingSteps, fillStepDates, setMe, toggleStep } from "../actions";

export const dynamic = "force-dynamic";

type SP = Promise<{ view?: string | string[]; month?: string | string[]; day?: string | string[] }>;
const one = (v: unknown) => (typeof v === "string" ? v : undefined);
const md = (d: Date) => {
  const p = kstParts(d);
  return `${p.month + 1}/${p.date}`;
};

export default async function WeddingTodoPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const view = one(sp.view) === "calendar" ? "calendar" : "list";
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

          <div className="flex items-center justify-between">
            <div className="flex rounded-[12px] bg-card p-1 shadow-[var(--shadow-card)]" role="tablist" aria-label="보기">
              {(
                [
                  ["list", "리스트"],
                  ["calendar", "캘린더"],
                ] as const
              ).map(([v, label]) => (
                <Link
                  key={v}
                  href={v === "list" ? "/wedding" : "/wedding?view=calendar"}
                  role="tab"
                  aria-selected={view === v}
                  className={`rounded-[9px] px-3.5 py-1.5 text-[13px] font-semibold ${view === v ? "bg-save text-white" : "text-sub"}`}
                >
                  {label}
                </Link>
              ))}
            </div>
            {me && !kakaoEnabled() && (
              <form action={setMe}>
                <button name="name" value="" className="text-[12px] font-medium text-sub">
                  {me}님으로 기록 중 · 바꾸기
                </button>
              </form>
            )}
          </div>

          {view === "calendar" ? (
            <Calendar month={one(sp.month)} day={one(sp.day)} now={now} />
          ) : (
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
                        <form action={toggleStep.bind(null, s.id)} className="relative z-[1] py-2">
                          <button
                            aria-label={s.done ? `${s.title} 완료 취소` : `${s.title} 완료`}
                            className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-[13px] font-bold ${
                              s.done ? "border-save bg-save text-white" : "border-line bg-card text-sub"
                            }`}
                          >
                            {s.done ? "✓" : s.order}
                          </button>
                        </form>
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
          )}

          <section>
            <h2 className="section-title">이벤트 추가</h2>
            <form action={addWeddingStep} className="card grid grid-cols-2 gap-2">
              <input name="title" placeholder="예: 드레스 투어" required className="input col-span-2" />
              <input name="targetDate" type="date" className="input col-span-2" />
              <button className="btn col-span-2">추가</button>
            </form>
          </section>
        </>
      )}
    </main>
  );
}

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

/** 한 달 캘린더. 날짜를 누르면 아래에 그날 일정, 일정을 누르면 이벤트 세부로 */
async function Calendar({ month, day, now }: { month?: string; day?: string; now: Date }) {
  const base = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? new Date(`${month}-15T00:00:00+09:00`) : now;
  const from = kstMonthStart(base);
  const to = kstMonthStart(base, 1);
  const { year, month: m } = kstParts(base);
  const ym = (offset: number) => {
    const p = kstParts(new Date(kstMonthStart(base, offset).getTime() + 10 * 3600_000));
    return `${p.year}-${String(p.month + 1).padStart(2, "0")}`;
  };
  const data = await calendarMonth(from, to);

  type Item = { key: string; date: number; kind: "event" | "task" | "pay"; label: string; href: string; color: string; done?: boolean; sub?: string };
  const items: Item[] = [
    ...data.steps.map((s) => ({
      key: `s${s.id}`,
      date: kstParts(s.targetDate!).date,
      kind: "event" as const,
      label: s.title,
      href: `/wedding/event/${s.id}`,
      color: "var(--color-save)",
      done: s.done,
    })),
    ...data.tasks.map((t) => ({
      key: `t${t.id}`,
      date: kstParts(t.dueDate!).date,
      kind: "task" as const,
      label: t.content,
      sub: t.step.title,
      href: `/wedding/event/${t.step.id}`,
      color: "var(--color-pink)",
      done: t.done,
    })),
    ...data.payments.map((p) => ({
      key: `p${p.id}`,
      date: kstParts(p.paidAt!).date,
      kind: "pay" as const,
      label: `${p.content} ${manwon(p.amount)}원`,
      sub: p.method === "PLANNED" ? "결제 예정" : "결제",
      href: p.stepId ? `/wedding/event/${p.stepId}` : "/wedding/budget",
      color: categoryColor(p.category),
    })),
  ];
  const byDate = new Map<number, Item[]>();
  for (const it of items) byDate.set(it.date, [...(byDate.get(it.date) ?? []), it]);

  const firstWeekday = kstParts(from).weekday;
  const daysInMonth = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
  const today = kstParts(now);
  const isThisMonth = today.year === year && today.month === m;
  const selected = Number(day) || (isThisMonth ? today.date : [...byDate.keys()].sort((a, b) => a - b)[0] ?? 1);
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const monthKey = `${year}-${String(m + 1).padStart(2, "0")}`;
  const dayItems = (byDate.get(selected) ?? []).sort((a, b) => ["event", "task", "pay"].indexOf(a.kind) - ["event", "task", "pay"].indexOf(b.kind));

  return (
    <section className="space-y-3">
      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <Link href={`/wedding?view=calendar&month=${ym(-1)}`} aria-label="이전 달" className="btn-ghost !bg-paper !px-3">‹</Link>
          <p className="num text-[16px] font-bold">
            {year}년 {m + 1}월
          </p>
          <Link href={`/wedding?view=calendar&month=${ym(1)}`} aria-label="다음 달" className="btn-ghost !bg-paper !px-3">›</Link>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-faint">
          {WEEK.map((w, i) => (
            <span key={w} className={i === 0 ? "text-spend/70" : ""}>{w}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-y-1">
          {cells.map((d, i) =>
            d == null ? (
              <span key={`b${i}`} />
            ) : (
              <Link
                key={d}
                href={`/wedding?view=calendar&month=${monthKey}&day=${d}`}
                aria-current={d === selected ? "date" : undefined}
                className={`flex h-12 flex-col items-center justify-start gap-1 rounded-xl pt-1.5 ${
                  d === selected ? "bg-save-soft" : ""
                }`}
              >
                <span
                  className={`num flex h-6 w-6 items-center justify-center rounded-full text-[13px] ${
                    isThisMonth && d === today.date ? "bg-save font-bold text-white" : d === selected ? "font-bold text-save" : ""
                  }`}
                >
                  {d}
                </span>
                <span className="flex gap-[3px]">
                  {(byDate.get(d) ?? []).slice(0, 3).map((it) => (
                    <span key={it.key} className="h-1.5 w-1.5 rounded-full" style={{ background: it.color, opacity: it.done ? 0.4 : 1 }} />
                  ))}
                </span>
              </Link>
            ),
          )}
        </div>
        <ul className="mt-3 flex gap-3 border-t border-line pt-3 text-[11px] text-sub">
          <li className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-save" />이벤트</li>
          <li className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-pink" />할 일 일정</li>
          <li className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-faint" />결제 (예산 구분 색)</li>
        </ul>
      </div>

      <div>
        <h2 className="section-title">
          {m + 1}월 {selected}일
          <small>{dayItems.length ? `${dayItems.length}개` : ""}</small>
        </h2>
        <ul className="card ledger !py-1">
          {dayItems.map((it) => (
            <li key={it.key}>
              <Link href={it.href} className="flex items-center gap-3 py-3">
                <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: it.color }} />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[15px] font-semibold ${it.done ? "text-sub line-through" : ""}`}>{it.label}</span>
                  <span className="block truncate text-[12px] text-sub">
                    {it.kind === "event" ? "이벤트" : it.kind === "task" ? `할 일 · ${it.sub}` : it.sub}
                  </span>
                </span>
                <span className="text-faint" aria-hidden>›</span>
              </Link>
            </li>
          ))}
          {dayItems.length === 0 && <li className="py-6 text-center text-[13px] text-sub">이날은 일정이 없어요</li>}
        </ul>
      </div>
    </section>
  );
}
