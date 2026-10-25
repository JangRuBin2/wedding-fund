import Link from "next/link";
import { prisma } from "@/lib/db";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/categories";
import { kstMonthStart, kstParts, manwon } from "@/lib/time";
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
    <main className="space-y-4">
      <header className="flex items-center justify-between">
        {reviewMode ? (
          <h1 className="text-2xl font-bold">확인 필요한 내역</h1>
        ) : (
          <div className="flex items-center gap-3">
            <Link href={`/transactions?month=${ym(-1)}`} className="btn-ghost">←</Link>
            <h1 className="text-xl font-bold">{year}년 {month + 1}월</h1>
            <Link href={`/transactions?month=${ym(1)}`} className="btn-ghost">→</Link>
          </div>
        )}
        {reviewMode && <Link href="/transactions" className="btn-ghost">전체 보기</Link>}
      </header>

      {!reviewMode && (
        <section className="grid grid-cols-3 gap-2 text-center">
          <div className="card !p-3"><p className="label">수입</p><p className="num font-bold text-save">{manwon(income)}</p></div>
          <div className="card !p-3"><p className="label">지출</p><p className="num font-bold text-spend">{manwon(expense)}</p></div>
          <div className="card !p-3"><p className="label">순</p><p className="num font-bold">{manwon(income - expense)}</p></div>
        </section>
      )}

      <details className="card">
        <summary className="cursor-pointer font-bold">+ 직접 입력 (현금, 월급 등)</summary>
        <form action={addManual} className="mt-3 grid grid-cols-2 gap-2">
          <select name="type" className="input">
            <option value="EXPENSE">지출</option>
            <option value="INCOME">수입</option>
          </select>
          <input name="date" type="date" defaultValue={today} className="input" />
          <input name="amount" inputMode="numeric" placeholder="금액" required className="input" />
          <input name="merchant" placeholder="어디서 / 무엇" className="input" />
          <select name="category" className="input col-span-2" defaultValue="">
            <option value="">카테고리 자동</option>
            <optgroup label="지출">{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</optgroup>
            <optgroup label="수입">{INCOME_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</optgroup>
          </select>
          <input name="memo" placeholder="메모 (선택)" className="input col-span-2" />
          <button className="btn col-span-2">추가</button>
        </form>
      </details>

      <form className="flex gap-2">
        {sp.month && <input type="hidden" name="month" value={sp.month} />}
        <input name="q" defaultValue={sp.q} placeholder="가맹점 검색" className="input" />
        <select name="type" defaultValue={sp.type ?? ""} className="input !w-28">
          <option value="">전체</option>
          <option value="EXPENSE">지출</option>
          <option value="INCOME">수입</option>
        </select>
        <button className="btn">검색</button>
      </form>

      <section className="card !py-2">
        {txs.length === 0 && <p className="py-8 text-center text-sm text-sub">내역 없음</p>}
        <ul className="divide-y divide-line">
          {txs.map((t) => (
            <li key={t.id}>
              <details>
                <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <TxRow t={t} />
                </summary>
                <div className="mb-3 space-y-2 rounded-xl bg-paper p-3">
                  {t.raws[0] && (
                    <p className="whitespace-pre-wrap rounded-lg bg-card p-2 text-xs text-sub">
                      {t.raws[0].title}
                      {"\n"}
                      {t.raws[0].text}
                    </p>
                  )}
                  <form action={updateTransaction} className="grid grid-cols-2 gap-2">
                    <input type="hidden" name="id" value={t.id} />
                    <input name="merchant" defaultValue={t.merchant} className="input" />
                    <select name="category" defaultValue={t.category} className="input">
                      {(t.type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                      {![...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].includes(t.category as never) && <option>{t.category}</option>}
                    </select>
                    <label className="col-span-2 flex items-center gap-2 text-sm">
                      <input type="checkbox" name="learn" defaultChecked /> 이 가맹점은 앞으로도 이 카테고리로
                    </label>
                    <button className="btn col-span-2">저장 (확정)</button>
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
                      <button className="btn-ghost text-spend">삭제</button>
                    </form>
                  </div>
                  <p className="text-[11px] text-sub">
                    내 계좌끼리 이체, 적금 납입처럼 실제 소비가 아닌 건 '집계 제외' 하면 됨
                  </p>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
