import Link from "next/link";
import { getGoalStatus } from "@/lib/goal";
import { dueDateLabel, dueLabel, weddingOverview, WEDDING_GROUPS, WEDDING_SUGGESTIONS } from "@/lib/wedding";
import { manwon, toKst } from "@/lib/time";
import { SubmitButton } from "@/components/SubmitButton";
import {
  addWeddingItem,
  addWeddingTemplate,
  alignGoalToBudget,
  deleteWeddingItem,
  settleWeddingItem,
  updateWeddingItem,
} from "../actions";
import { Chevron } from "@/components/Chevron";

export const dynamic = "force-dynamic";

const dateInput = (d: Date | null) => (d ? toKst(d).toISOString().slice(0, 10) : "");

export default async function WeddingPage() {
  const now = new Date();
  const [w, status] = await Promise.all([weddingOverview(now), getGoalStatus(now)]);
  const gap = status ? status.goal.targetAmount - w.budget : 0;

  const paidRatio = w.budget ? Math.min(1, w.paid / w.budget) : 0;

  return (
    <main className="space-y-8">
      <header className="flex items-end justify-between px-1.5">
        <div>
          <h1 className="page-title">결혼 준비</h1>
          <p className="page-sub">항목별 예산이랑 낼 날짜를 한곳에서 챙겨요</p>
        </div>
        {status && <span className="pill num glass mb-1 shrink-0 !px-3 !py-1.5 !text-[14px]">💍 D-{status.daysLeft}</span>}
      </header>

      {w.items.length === 0 ? (
        <section className="card space-y-4">
          <p className="text-[34px]">📝</p>
          <div>
            <p className="text-[20px] font-bold">예산표부터 만들어 볼까요?</p>
            <p className="help mt-1.5 !text-[15px]">
              항목별로 예산이랑 잔금 날짜를 적어두면, 언제 얼마가 나가는지 홈에서 미리 알려드려요. 다 정하면 목표 금액도 예산 합계에 맞출 수 있어요.
            </p>
          </div>
          <form action={addWeddingTemplate}>
            <SubmitButton pendingText="만드는 중…" className="w-full">
              자주 쓰는 항목 10개로 시작하기
            </SubmitButton>
          </form>
          <p className="help !text-[13px]">예식장, 스드메, 예물, 신혼여행, 가전 같은 항목이 예산 없이 들어가요. 필요 없는 건 지우면 돼요</p>
        </section>
      ) : (
        <>
          <section className="glass-tint">
            <p className="text-[15px] font-semibold text-white/80">결혼 준비 총 예산</p>
            <p className="num mt-1.5 text-[40px] leading-none font-extrabold">
              {manwon(w.budget)}
              <span className="ml-0.5 text-[24px] font-bold">원</span>
            </p>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-white" style={{ width: `${paidRatio * 100}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-[18px] bg-white/15 px-4 py-3">
                <p className="text-[13px] text-white/80">이미 낸 돈</p>
                <p className="num mt-0.5 text-[20px] font-extrabold">{manwon(w.paid)}원</p>
              </div>
              <div className="rounded-[18px] bg-white/15 px-4 py-3">
                <p className="text-[13px] text-white/80">앞으로 낼 돈</p>
                <p className="num mt-0.5 text-[20px] font-extrabold">{manwon(w.remaining)}원</p>
              </div>
            </div>
          </section>

          {(w.undecided > 0 || (status && w.budget > 0 && Math.abs(gap) >= 10_000)) && (
            <section className="card space-y-4">
              {w.undecided > 0 && (
                <p className="flex gap-2.5 text-[15px] leading-snug">
                  <span aria-hidden>✏️</span>
                  <span>
                    아직 예산을 안 정한 항목이 <b>{w.undecided}개</b> 있어요. 대충이라도 넣어야 합계가 맞아요
                  </span>
                </p>
              )}
              {status && w.budget > 0 && Math.abs(gap) >= 10_000 && (
                <form action={alignGoalToBudget} className={`space-y-3 ${w.undecided > 0 ? "border-t border-line pt-4" : ""}`}>
                  <p className="flex gap-2.5 text-[15px] leading-snug">
                    <span aria-hidden>🎯</span>
                    <span>
                      모으기 목표 <span className="num">{manwon(status.goal.targetAmount)}원</span>이 예산 합계보다{" "}
                      <b className={gap > 0 ? "" : "text-spend"}>
                        {manwon(Math.abs(gap))}원 {gap > 0 ? "많아요" : "적어요"}
                      </b>
                    </span>
                  </p>
                  <SubmitButton pendingText="맞추는 중…" className="w-full">
                    목표를 예산 합계({manwon(w.budget)}원)로 맞추기
                  </SubmitButton>
                </form>
              )}
            </section>
          )}

          {w.upcoming.length > 0 && (
            <section>
              <h2 className="section-title">
                낼 날짜가 정해진 것
                <small>가까운 순</small>
              </h2>
              <ul className="card ledger !py-1.5">
                {w.upcoming.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 py-3">
                    <span
                      className={`pill num w-[60px] shrink-0 justify-center ${
                        i.daysUntil < 0 ? "bg-spend-soft text-spend" : i.daysUntil <= 30 ? "bg-warn-soft text-warn" : "bg-fill text-sub"
                      }`}
                    >
                      {dueLabel(i.daysUntil)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-semibold">{i.name}</span>
                      <span className="num text-[13px] text-sub">{dueDateLabel(i.dueDate!, now)}</span>
                    </span>
                    <span className="num shrink-0 text-[16px] font-bold">{manwon(i.due)}원</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="space-y-6">
            <h2 className="section-title !mb-[-4px]">항목별 예산</h2>
            {WEDDING_GROUPS.map((g) => {
              const items = w.items.filter((i) => i.group === g);
              if (!items.length) return null;
              const sub = items.reduce((s, i) => s + i.budget, 0);
              return (
                <section key={g}>
                  <h3 className="mb-2 flex items-baseline justify-between px-1.5 text-[15px] font-bold">
                    <span>
                      <span aria-hidden className="mr-1.5">
                        {GROUP_EMOJI[g]}
                      </span>
                      {g}
                    </span>
                    <span className="num text-[13px] font-medium text-sub">{sub ? `${manwon(sub)}원` : "예산 미정"}</span>
                  </h3>
                  <ul className="card ledger !py-1">
                    {items.map((i) => {
                      const done = i.budget > 0 && i.paid >= i.budget;
                      return (
                        <li key={i.id}>
                          <details>
                            <summary className="flex cursor-pointer items-center gap-3 py-3.5">
                              <span className="min-w-0 flex-1">
                                <span className={`flex items-center gap-1.5 text-[16px] font-semibold ${done ? "text-sub" : ""}`}>
                                  <span className="truncate">{i.name}</span>
                                  {done && <span className="pill shrink-0 bg-save-soft !py-0.5 !text-[11px] text-save">✓ 다 냄</span>}
                                </span>
                                {i.budget > 0 ? (
                                  <span className="bar-track mt-2 block !h-1.5">
                                    <span className="block h-full rounded-full bg-save" style={{ width: `${Math.min(1, i.paid / i.budget) * 100}%` }} />
                                  </span>
                                ) : (
                                  <span className="text-[13px] text-faint">눌러서 예산을 넣어 주세요</span>
                                )}
                              </span>
                              <span className="shrink-0 text-right">
                                {i.budget === 0 ? (
                                  <span className="text-[14px] text-faint">미정</span>
                                ) : (
                                  <>
                                    <span className="num block text-[16px] font-bold">{manwon(i.budget)}원</span>
                                    {i.paid > 0 && !done && <span className="num block text-[12px] text-sub">{manwon(i.paid)}원 냄</span>}
                                  </>
                                )}
                              </span>
                              <Chevron rotate size={16} />
                            </summary>
                            <div className="mb-3 space-y-3 rounded-[20px] bg-fill p-4">
                              <form action={updateWeddingItem} className="grid grid-cols-2 gap-3">
                                <input type="hidden" name="id" value={i.id} />
                                <label className="col-span-2 space-y-1.5">
                                  <span className="label">항목 이름</span>
                                  <input name="name" defaultValue={i.name} className="input !bg-glass-strong" />
                                </label>
                                <label className="space-y-1.5">
                                  <span className="label">예산 (원)</span>
                                  <input name="budget" inputMode="numeric" defaultValue={i.budget || ""} placeholder="미정" className="input num !bg-glass-strong" />
                                </label>
                                <label className="space-y-1.5">
                                  <span className="label">이미 낸 돈 (원)</span>
                                  <input name="paid" inputMode="numeric" defaultValue={i.paid || ""} placeholder="0" className="input num !bg-glass-strong" />
                                </label>
                                <label className="space-y-1.5">
                                  <span className="label">잔금 날짜</span>
                                  <input name="dueDate" type="date" defaultValue={dateInput(i.dueDate)} className="input !bg-glass-strong" />
                                </label>
                                <label className="space-y-1.5">
                                  <span className="label">묶음</span>
                                  <select name="group" defaultValue={i.group} className="input !bg-glass-strong">
                                    {WEDDING_GROUPS.map((x) => (
                                      <option key={x}>{x}</option>
                                    ))}
                                  </select>
                                </label>
                                <label className="col-span-2 space-y-1.5">
                                  <span className="label">메모</span>
                                  <input name="memo" defaultValue={i.memo ?? ""} placeholder="업체, 계약 조건, 연락처" className="input !bg-glass-strong" />
                                </label>
                                <button className="btn col-span-2">저장하기</button>
                              </form>
                              <div className="flex flex-wrap gap-2">
                                {!done && i.budget > 0 && (
                                  <form action={settleWeddingItem.bind(null, i.id)}>
                                    <button className="btn-ghost">✓ 남은 돈 다 냈어요</button>
                                  </form>
                                )}
                                <form action={deleteWeddingItem.bind(null, i.id)}>
                                  <button className="btn-ghost !text-spend">삭제</button>
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
          </div>
        </>
      )}

      <details className="card !p-0">
        <summary className="flex cursor-pointer items-center gap-3 px-5 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-save-soft text-[20px] font-bold text-save">+</span>
          <span className="flex-1 text-[16px] font-bold">항목 추가하기</span>
          <Chevron rotate size={16} />
        </summary>
        <form action={addWeddingItem} className="grid grid-cols-2 gap-3 px-5 pb-5">
          <label className="col-span-2 space-y-1.5">
            <span className="label">항목 이름</span>
            <input name="name" list="wedding-suggestions" placeholder="예: 본식 스냅" required className="input" />
          </label>
          <datalist id="wedding-suggestions">
            {WEDDING_SUGGESTIONS.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
          <label className="space-y-1.5">
            <span className="label">묶음</span>
            <select name="group" defaultValue="기타" className="input">
              {WEDDING_GROUPS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="label">예산 (원)</span>
            <input name="budget" inputMode="numeric" placeholder="모르면 비워두기" className="input num" />
          </label>
          <label className="space-y-1.5">
            <span className="label">잔금 날짜</span>
            <input name="dueDate" type="date" className="input" />
          </label>
          <label className="space-y-1.5">
            <span className="label">이미 낸 돈 (원)</span>
            <input name="paid" inputMode="numeric" placeholder="0" className="input num" />
          </label>
          <button className="btn col-span-2">추가하기</button>
        </form>
      </details>

      <p className="help flex gap-2 px-1.5">
        <span aria-hidden>💡</span>
        <span>
          카드로 낸 계약금·잔금은 내역에서 분류를 &apos;결혼준비&apos;로 바꿔 주세요. 그러면 생활비·하루 쓸 돈 계산에서 빠지고, 모은 돈에는 &apos;이미 쓴
          결혼자금&apos;으로 들어가요.{" "}
          <Link href="/transactions" className="font-semibold text-save">
            내역 보기
          </Link>
          {status && status.weddingSpent > 0 && (
            <>
              {" "}
              (지금까지 결혼준비로 분류된 결제 <span className="num">{manwon(status.weddingSpent)}원</span>)
            </>
          )}
        </span>
      </p>
    </main>
  );
}

const GROUP_EMOJI: Record<string, string> = {
  예식: "⛪️",
  스드메: "👗",
  "예물·예단": "💎",
  신혼여행: "✈️",
  "신혼집·혼수": "🏠",
  기타: "📦",
};

