import Link from "next/link";
import { prisma } from "@/lib/db";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/categories";
import { kstMonthStart, kstParts, manwon, WEEKDAYS } from "@/lib/time";
import { TxRow } from "@/components/TxRow";
import { addManual, deleteTransaction, setStatus, updateTransaction } from "../actions";

export const dynamic = "force-dynamic";

type SP = Promise<{ month?: string; status?: string; type?: string; q?: string }>;

export default async function Transactions({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const now = new Date();
  const base = sp.month ? new Date(`${sp.month}-15T00:00:00+09:00`) : now;
  const from = kstMonthStart(base);
  const to = kstMonthStart(base, 1);
  const { year, month } = kstParts(base);
  const ym = (offset: number) => {
    const d = kstMonthStart(base, offset);
    const p = kstParts(new Date(d.getTime() + 10 * 3600_000));
    return `${p.year}-${String(p.month + 1).padStart(2, "0")}`;
  };

  const reviewMode = sp.status === "REVIEW";
  const txs = await prisma.transaction.findMany({
    where: {
      ...(reviewMode ? { status: "REVIEW" } : { occurredAt: { gte: from, lt: to } }),
      ...(sp.type === "INCOME" || sp.type === "EXPENSE" ? { type: sp.type } : {}),
      ...(sp.q ? { merchant: { contains: sp.q } } : {}),
    },
    orderBy: { occurredAt: "desc" },
    include: { member: true, raws: { take: 1, orderBy: { createdAt: "asc" } } },
  });

  const active = txs.filter((t) => !t.cancelled && t.status !== "IGNORED");
  const income = active.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
  const expense = active.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);
  const today = new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);

  return (
    <main className="space-y-5">
      <header className="flex items-center justify-between">
        {reviewMode ? (
          <>
            <h1 className="text-[22px] font-bold">확인할 결제</h1>
            <Link href="/transactions" className="btn-ghost">전체 내역</Link>
          </>
        ) : (
          <div className="flex w-full items-center justify-between">
            <Link href={`/transactions?month=${ym(-1)}`} aria-label="이전 달" className="btn-ghost !px-3">‹</Link>
            <h1 className="num text-[20px] font-bold">{year}년 {month + 1}월</h1>
            <Link href={`/transactions?month=${ym(1)}`} aria-label="다음 달" className="btn-ghost !px-3">›</Link>
          </div>
        )}
      </header>

      {!reviewMode && (
        <section className="card grid grid-cols-3 divide-x divide-line !px-0 !py-3.5 text-center">
          <div><p className="label">들어온 돈</p><p className="num mt-0.5 text-[17px] font-bold text-save">+{manwon(income)}</p></div>
          <div><p className="label">나간 돈</p><p className="num mt-0.5 text-[17px] font-bold">−{manwon(expense)}</p></div>
          <div><p className="label">남은 돈</p><p className={`num mt-0.5 text-[17px] font-bold ${income - expense < 0 ? "text-spend" : ""}`}>{manwon(income - expense)}</p></div>
        </section>
      )}

      <form className="flex gap-2">
        {sp.month && <input type="hidden" name="month" value={sp.month} />}
        <input name="q" defaultValue={sp.q} placeholder="가맹점 검색" className="input !bg-card" />
        <select name="type" defaultValue={sp.type ?? ""} className="input !w-24 !bg-card">
          <option value="">전체</option>
          <option value="EXPENSE">지출</option>
          <option value="INCOME">수입</option>
        </select>
        <button className="btn shrink-0">검색</button>
      </form>

      <details className="card group">
        <summary className="flex cursor-pointer list-none items-center justify-between font-semibold [&::-webkit-details-marker]:hidden">
          <span>직접 입력</span>
          <span className="text-[13px] font-medium text-sub group-open:hidden">현금, 월급처럼 알림 안 오는 것</span>
        </summary>
        <form action={addManual} className="mt-4 grid grid-cols-2 gap-2">
          <select name="type" className="input">
            <option value="EXPENSE">지출</option>
            <option value="INCOME">수입</option>
          </select>
          <input name="date" type="date" defaultValue={today} className="input" />
          <input name="amount" inputMode="numeric" placeholder="금액" required className="input num" />
          <input name="merchant" placeholder="어디서, 무엇을" className="input" />
          <select name="category" className="input col-span-2" defaultValue="">
            <option value="">카테고리 자동 분류</option>
            <optgroup label="지출">{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</optgroup>
            <optgroup label="수입">{INCOME_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</optgroup>
          </select>
          <input name="memo" placeholder="메모 (선택)" className="input col-span-2" />
          <button className="btn col-span-2">내역에 추가</button>
        </form>
      </details>

      <section className="card !py-1">
        {txs.length === 0 && <p className="py-10 text-center text-sm text-sub">{reviewMode ? "확인할 결제 없음" : sp.q ? `"${sp.q}" 검색 결과 없음` : "이 달은 내역이 없어"}</p>}
        <ul>
          {txs.map((t, i) => {
            const day = dayLabel(t.occurredAt);
            const showDay = i === 0 || dayLabel(txs[i - 1].occurredAt) !== day;
            return (
            <li key={t.id}>
              {showDay && <p className="pt-4 pb-1 text-[12px] font-semibold text-sub">{day}</p>}
              <details>
                <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <TxRow t={t} timeOnly={!reviewMode} />
                </summary>
                <div className="mb-3 space-y-3 rounded-xl bg-paper p-3">
                  {t.raws[0] && (
                    <p className="whitespace-pre-wrap rounded-lg border border-dashed border-line p-2.5 text-xs leading-relaxed text-sub">
                      {t.raws[0].title}
                      {"\n"}
                      {t.raws[0].text}
                    </p>
                  )}
                  <form action={updateTransaction} className="grid grid-cols-2 gap-2">
                    <input type="hidden" name="id" value={t.id} />
                    <input name="merchant" defaultValue={t.merchant} className="input !bg-card" />
                    <select name="category" defaultValue={t.category} className="input !bg-card">
                      {(t.type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                      {![...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].includes(t.category as never) && <option>{t.category}</option>}
                    </select>
                    <label className="col-span-2 flex items-center gap-2 text-[13px] text-sub">
                      <input type="checkbox" name="learn" defaultChecked /> 다음부터 이 가맹점은 이 카테고리로 분류
                    </label>
                    <button className="btn col-span-2">저장</button>
                  </form>
                  <div className="flex gap-2">
                    {t.status !== "IGNORED" ? (
                      <form action={setStatus.bind(null, t.id, "IGNORED")}>
                        <button className="btn-ghost">집계 제외</button>
                      </form>
                    ) : (
                      <form action={setStatus.bind(null, t.id, "CONFIRMED")}>
                        <button className="btn-ghost">다시 포함</button>
                      </form>
                    )}
                    <form action={deleteTransaction.bind(null, t.id)}>
                      <button className="btn-ghost !text-spend">삭제</button>
                    </form>
                  </div>
                  <p className="text-[11px] text-sub">
                    내 계좌끼리 이체나 적금 납입처럼 실제로 쓴 돈이 아니면 '집계 제외'
                  </p>
                </div>
              </details>
            </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}

function dayLabel(d: Date) {
  const p = kstParts(d);
  return `${p.month + 1}월 ${p.date}일 ${WEEKDAYS[p.weekday]}요일`;
}
