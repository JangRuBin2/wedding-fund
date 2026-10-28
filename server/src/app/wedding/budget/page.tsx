import Link from "next/link";
import { getGoalStatus } from "@/lib/goal";
import { budgetUsage, dueDateLabel, dueLabel, weddingOverview, WEDDING_GROUPS, WEDDING_SUGGESTIONS } from "@/lib/wedding";
import { BudgetPlanner } from "@/components/BudgetPlanner";
import { UsageBar } from "@/components/UsageBar";
import { manwon, toKst } from "@/lib/time";
import { SubmitButton } from "@/components/SubmitButton";
import { WeddingHeader } from "@/components/WeddingTabs";
import { PHOTOS, photoUrl } from "@/lib/photos";
import {
  addWeddingItem,
  addWeddingTemplate,
  alignGoalToBudget,
  deleteWeddingItem,
  settleWeddingItem,
  updateWeddingItem,
} from "../../actions";

export const dynamic = "force-dynamic";

const dateInput = (d: Date | null) => (d ? toKst(d).toISOString().slice(0, 10) : "");

export default async function WeddingBudgetPage() {
  const now = new Date();
  const [w, status, usage] = await Promise.all([weddingOverview(now), getGoalStatus(now), budgetUsage()]);
  const gap = status ? status.goal.targetAmount - w.budget : 0;

  return (
    <main className="space-y-7">
      <WeddingHeader active="budget" daysLeft={status?.daysLeft} />

      <section className="card">
        <UsageBar rows={usage.rows} total={usage.total} />
        {usage.total > 0 && (
          <ul className="ledger mt-4 border-t border-line">
            {usage.rows.map((r) => (
              <li key={r.name} className="py-2.5">
                <div className="flex items-baseline gap-2 text-[14px]">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.color }} />
                  <span className="font-semibold">{r.name}</span>
                  <span className={`num ml-auto ${r.over ? "font-bold text-spend" : "text-sub"}`}>
                    {manwon(r.spent + r.planned)} / {manwon(r.budget)}원
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${r.budget ? Math.min(1, (r.spent + r.planned) / r.budget) * 100 : 0}%`, background: r.over ? "var(--color-spend)" : r.color }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
        {usage.spent + usage.planned === 0 && (
          <p className="mt-3 text-[12px] text-sub">할 일 탭의 이벤트에서 결제를 기록하면 여기에 쌓여요</p>
        )}
      </section>

      <section>
        <h2 className="section-title">
          예산 나누기
          <small>슬라이더로 조절, 잠그면 고정</small>
        </h2>
        <div className="card">
          <BudgetPlanner initial={Object.fromEntries(usage.rows.map((r) => [r.name, r.budget]))} />
        </div>
      </section>

      <h2 className="section-title">
        세부 예산표
        <small>항목별 예산·잔금 날짜</small>
      </h2>

      {w.items.length === 0 ? (
        <section className="card space-y-4">
          <div>
            <p className="text-[17px] font-bold">예산표부터 만들어 볼까요?</p>
            <p className="mt-1 text-[14px] leading-relaxed text-sub">
              항목별로 예산과 잔금 날짜를 적어 두시면, 언제 얼마가 나가는지 홈에서 미리 알려 드릴게요. 다 정하시면 목표 금액도
              예산 합계로 맞출 수 있어요.
            </p>
          </div>
          <form action={addWeddingTemplate}>
            <SubmitButton pendingText="만드는 중…">자주 쓰는 항목 10개로 시작하기</SubmitButton>
          </form>
          <p className="text-[12px] text-sub">예식장, 스드메, 예물, 신혼여행, 가전 같은 항목이 예산 없이 추가돼요. 필요 없는 항목은 지워 주세요</p>
        </section>
      ) : (
        <>
          <section className="card">
            <div className="flex items-baseline justify-between">
              <p className="text-[15px] text-sub">총 예산</p>
              <p className="num text-[26px] font-extrabold">{manwon(w.budget)}원</p>
            </div>
            <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-paper">
              <span className="bg-save" style={{ width: `${w.budget ? (Math.min(w.paid, w.budget) / w.budget) * 100 : 0}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-2 text-[14px]">
              <div>
                <p className="text-sub">낸 돈</p>
                <p className="num text-[17px] font-bold text-save">{manwon(w.paid)}원</p>
              </div>
              <div className="text-right">
                <p className="text-sub">더 낼 돈</p>
                <p className="num text-[17px] font-bold">{manwon(w.remaining)}원</p>
              </div>
            </div>
            {w.undecided > 0 && (
              <p className="mt-3 rounded-lg bg-paper px-3 py-2 text-[13px] text-sub">
                예산을 정하지 않은 항목이 {w.undecided}개 있어요. 대략이라도 입력하시면 합계가 정확해져요
              </p>
            )}
            {status && w.budget > 0 && Math.abs(gap) >= 10_000 && (
              <form action={alignGoalToBudget} className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                <p className="text-[13px] leading-snug text-sub">
                  목표 금액 <span className="num">{manwon(status.goal.targetAmount)}원</span>이 예산 합계보다{" "}
                  <b className={gap > 0 ? "text-ink" : "text-spend"}>{manwon(Math.abs(gap))}원 {gap > 0 ? "많아요" : "적어요"}</b>
                </p>
                <SubmitButton pendingText="맞추는 중…" className="shrink-0 whitespace-nowrap">목표를 예산에 맞추기</SubmitButton>
              </form>
            )}
            {status && status.weddingSpent > 0 && (
              <p className="mt-3 text-[12px] text-sub">
                내역에서 결혼준비로 분류된 결제 <span className="num">{manwon(status.weddingSpent)}원</span>이에요. 위의 &apos;낸 돈&apos;과 크게
                다르다면 항목별 낸 돈을 고쳐 주세요
              </p>
            )}
          </section>

          <section className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" aria-label="큰 준비 항목">
            {PHOTO_CARDS.map((c) => {
              const items = w.items.filter((i) => i.group === c.group);
              const budget = items.reduce((s, i) => s + i.budget, 0);
              const paid = items.reduce((s, i) => s + i.paid, 0);
              return (
                <a
                  key={c.group}
                  href={`#${encodeURIComponent(c.group)}`}
                  className="photo-card flex h-44 w-[72%] shrink-0 snap-start flex-col justify-end p-4"
                  style={PHOTOS[c.photo] ? ({ "--photo": photoUrl(c.photo) } as React.CSSProperties) : undefined}
                >
                  <p className="text-[12px] font-medium opacity-85">{c.group}</p>
                  <p className="text-[19px] font-bold">{c.title}</p>
                  <p className="num mt-1 text-[13px] opacity-90">
                    {budget ? `${manwon(paid)}원 / ${manwon(budget)}원` : items.length ? "예산 미정" : "항목을 추가해 주세요"}
                  </p>
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white/30">
                    <span className="block h-full rounded-full bg-white" style={{ width: `${budget ? Math.min(1, paid / budget) * 100 : 0}%` }} />
                  </span>
                </a>
              );
            })}
          </section>

          {w.upcoming.length > 0 && (
            <section>
              <h2 className="section-title">
                잔금 일정
                <small>날짜 순</small>
              </h2>
              <ul className="card ledger !py-1">
                {w.upcoming.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 py-3">
                    <span
                      className={`num w-14 shrink-0 text-[13px] font-bold ${
                        i.daysUntil < 0 ? "text-spend" : i.daysUntil <= 30 ? "text-ink" : "text-sub"
                      }`}
                    >
                      {dueLabel(i.daysUntil)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{i.name}</span>
                      <span className="num text-[12px] text-sub">{dueDateLabel(i.dueDate!, now)}</span>
                    </span>
                    <span className="num shrink-0 text-[15px] font-bold">{manwon(i.due)}원</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {WEDDING_GROUPS.map((g) => {
            const items = w.items.filter((i) => i.group === g);
            if (!items.length) return null;
            const sub = items.reduce((s, i) => s + i.budget, 0);
            return (
              <section key={g} id={g} className="scroll-mt-6">
                <h2 className="section-title">
                  {g}
                  <small className="num">{sub ? `${manwon(sub)}원` : "예산 미정"}</small>
                </h2>
                <ul className="card ledger !py-1">
                  {items.map((i) => {
                    const done = i.budget > 0 && i.paid >= i.budget;
                    return (
                      <li key={i.id}>
                        <details className="group">
                          <summary className="flex cursor-pointer list-none items-center gap-3 py-3 [&::-webkit-details-marker]:hidden">
                            <span className="min-w-0 flex-1">
                              <span className={`block truncate text-[15px] font-semibold ${done ? "text-sub" : ""}`}>{i.name}</span>
                              {i.budget > 0 ? (
                                <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-paper">
                                  <span className="block h-full bg-save" style={{ width: `${Math.min(1, i.paid / i.budget) * 100}%` }} />
                                </span>
                              ) : (
                                <span className="text-[12px] text-faint">예산 미정</span>
                              )}
                            </span>
                            <span className="shrink-0 text-right">
                              {done ? (
                                <span className="text-[13px] font-bold text-save">다 냈어요</span>
                              ) : i.budget === 0 ? (
                                <span className="text-[13px] text-faint">미정</span>
                              ) : (
                                <>
                                  <span className="num block text-[15px] font-bold">{manwon(i.budget)}원</span>
                                  {i.paid > 0 && <span className="num block text-[12px] text-sub">{manwon(i.paid)}원 냈어요</span>}
                                </>
                              )}
                            </span>
                          </summary>
                          <div className="mb-3 space-y-3 rounded-xl bg-paper p-3">
                            <form action={updateWeddingItem} className="grid grid-cols-2 gap-2">
                              <input type="hidden" name="id" value={i.id} />
                              <label className="col-span-2 space-y-1">
                                <span className="label">항목</span>
                                <input name="name" defaultValue={i.name} className="input !bg-card" />
                              </label>
                              <label className="space-y-1">
                                <span className="label">예산 (원)</span>
                                <input name="budget" inputMode="numeric" defaultValue={i.budget || ""} placeholder="미정" className="input num !bg-card" />
                              </label>
                              <label className="space-y-1">
                                <span className="label">낸 돈 (원)</span>
                                <input name="paid" inputMode="numeric" defaultValue={i.paid || ""} placeholder="0" className="input num !bg-card" />
                              </label>
                              <label className="space-y-1">
                                <span className="label">잔금일</span>
                                <input name="dueDate" type="date" defaultValue={dateInput(i.dueDate)} className="input !bg-card" />
                              </label>
                              <label className="space-y-1">
                                <span className="label">분류</span>
                                <select name="group" defaultValue={i.group} className="input !bg-card">
                                  {WEDDING_GROUPS.map((x) => (
                                    <option key={x}>{x}</option>
                                  ))}
                                </select>
                              </label>
                              <label className="col-span-2 space-y-1">
                                <span className="label">메모</span>
                                <input name="memo" defaultValue={i.memo ?? ""} placeholder="업체, 계약 조건, 연락처" className="input !bg-card" />
                              </label>
                              <SubmitButton className="col-span-2" pendingText="저장 중…">저장</SubmitButton>
                            </form>
                            <div className="flex gap-2">
                              {!done && i.budget > 0 && (
                                <form action={settleWeddingItem.bind(null, i.id)}>
                                  <SubmitButton base="btn-ghost" pendingText="…">남은 돈 다 냈어요</SubmitButton>
                                </form>
                              )}
                              <form action={deleteWeddingItem.bind(null, i.id)}>
                                <SubmitButton base="btn-ghost" className="!text-spend" pendingText="…">삭제</SubmitButton>
                              </form>
                            </div>
                          </div>
                        </details>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </>
      )}

      <section>
        <h2 className="section-title">항목 추가</h2>
        <form action={addWeddingItem} className="card grid grid-cols-2 gap-2">
          <input name="name" list="wedding-suggestions" placeholder="예: 본식 스냅" required className="input col-span-2" />
          <datalist id="wedding-suggestions">
            {WEDDING_SUGGESTIONS.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
          <select name="group" defaultValue="기타" className="input">
            {WEDDING_GROUPS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <input name="budget" inputMode="numeric" placeholder="예산 (원)" className="input num" />
          <input name="dueDate" type="date" className="input" aria-label="잔금일" />
          <input name="paid" inputMode="numeric" placeholder="이미 낸 돈 (원)" className="input num" />
          <SubmitButton className="col-span-2" pendingText="저장 중…">추가</SubmitButton>
        </form>
      </section>

      <p className="px-1 text-[12px] leading-relaxed text-sub">
        결혼준비 결제는 홈의 생활비, 하루 권장액, 소비 패턴, 큰 지출 알림에서 빠지고, 목표 진행에는 &apos;이미 쓴 결혼자금&apos;으로 들어가요.
        내역에서 카테고리를 결혼준비로 바꿔 주세요.{" "}
        <Link href="/transactions" className="font-semibold text-save underline-offset-2 hover:underline">
          내역 보기
        </Link>
      </p>
    </main>
  );
}

// 사진은 public/photos/<photo>.jpg (lib/photos.ts에서 켜기). 없으면 그라데이션으로 보임
const PHOTO_CARDS = [
  { group: "예물·예단", title: "웨딩링", photo: "ring" },
  { group: "신혼집·혼수", title: "우리의 첫 집", photo: "home" },
  { group: "신혼여행", title: "신혼여행", photo: "trip" },
] as const;
