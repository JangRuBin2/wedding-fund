import Link from "next/link";
import { LinkPending } from "@/components/LinkPending";
import { SubmitButton } from "@/components/SubmitButton";
import { prisma } from "@/lib/db";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/categories";
import { fmtKst, kstMonthStart, kstParts, manwon, WEEKDAYS } from "@/lib/time";
import { ReviewDeck, type ReviewItem } from "@/components/ReviewDeck";
import { TxRow } from "@/components/TxRow";
import { addManual, deleteTransaction, setStatus, updateTransaction } from "../actions";
import { isMine, mineWhere } from "@/lib/ownership";
import { getMe } from "@/lib/me";

export const dynamic = "force-dynamic";

type Param = string | string[] | undefined;
type SP = Promise<{ month?: Param; status?: Param; type?: Param; q?: Param; view?: Param; add?: Param }>;

export default async function Transactions({ searchParams }: { searchParams: SP }) {
  const raw = await searchParams;
  // ?q=a&q=b 처럼 배열로 오거나 형식이 틀린 값은 무시
  const one = (v: unknown) => (typeof v === "string" ? v : undefined);
  const sp = { month: one(raw.month), status: one(raw.status), type: one(raw.type), q: one(raw.q), view: one(raw.view), add: one(raw.add) };
  const now = new Date();
  const base = sp.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month) ? new Date(`${sp.month}-15T00:00:00+09:00`) : now;
  const from = kstMonthStart(base);
  const to = kstMonthStart(base, 1);
  const { year, month } = kstParts(base);
  const ym = (offset: number) => {
    const d = kstMonthStart(base, offset);
    const p = kstParts(new Date(d.getTime() + 10 * 3600_000));
    return `${p.year}-${String(p.month + 1).padStart(2, "0")}`;
  };

  const reviewMode = sp.status === "REVIEW";
  const [me, mine, members] = await Promise.all([getMe(), mineWhere(), prisma.member.findMany({ orderBy: { createdAt: "asc" } })]);
  const txs = await prisma.transaction.findMany({
    where: {
      // 확인할 결제는 내 것만 (다른 사람 결제는 그 사람이 확인)
      ...(reviewMode ? { status: "REVIEW", ...mine } : { occurredAt: { gte: from, lt: to } }),
      ...(sp.type === "INCOME" || sp.type === "EXPENSE" ? { type: sp.type } : {}),
      ...(sp.q ? { merchant: { contains: sp.q, mode: "insensitive" } } : {}),
    },
    orderBy: { occurredAt: "desc" },
    include: { member: true, raws: { take: 1, orderBy: { createdAt: "asc" } } },
  });

  const active = txs.filter((t) => !t.cancelled && t.status !== "IGNORED");
  const income = active.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
  const expense = active.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);
  const today = new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);

  // 확인할 결제는 기본으로 스와이프 카드로 정리 (목록 보기도 가능)
  if (reviewMode && sp.view !== "list") {
    const items: ReviewItem[] = txs.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      merchant: t.merchant,
      category: t.category,
      issuer: t.issuer,
      member: t.member?.name ?? null,
      when: `${dayLabel(t.occurredAt)} ${fmtKst(t.occurredAt).split(" ")[1]}`,
      raw: t.raws[0] ? `${t.raws[0].title}\n${t.raws[0].text}`.trim() : null,
    }));
    return (
      <main className="space-y-5">
        <header className="flex items-center justify-between">
          <h1 className="text-[22px] font-bold">확인할 결제</h1>
          <div className="flex gap-2">
            <Link href="/transactions?add=1" className="btn-ghost">+ 직접 기록</Link>
            <Link href="/transactions" className="btn-ghost">전체 내역</Link>
          </div>
        </header>
        {me && <p className="-mt-2 px-1 text-[12px] text-sub">{me}님 결제만 보여요. 다른 사람 결제는 그 사람이 확인해요</p>}
        <ReviewDeck items={items} expenseCategories={EXPENSE_CATEGORIES} incomeCategories={INCOME_CATEGORIES} />
      </main>
    );
  }

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
            <Link href={`/transactions?month=${ym(-1)}`} scroll={false} replace aria-label="이전 달" className="btn-ghost relative !px-3">‹<LinkPending className="rounded-[12px]" /></Link>
            <h1 className="num text-[20px] font-bold">{year}년 {month + 1}월</h1>
            <Link href={`/transactions?month=${ym(1)}`} scroll={false} replace aria-label="다음 달" className="btn-ghost relative !px-3">›<LinkPending className="rounded-[12px]" /></Link>
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

      <details className="card group" open={!!sp.add}>
        <summary className="flex cursor-pointer list-none items-center justify-between font-semibold [&::-webkit-details-marker]:hidden">
          <span>직접 입력</span>
          <span className="text-[13px] font-medium text-sub group-open:hidden">현금·계좌이체·월급처럼 알림이 안 온 내역</span>
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
          <input name="memo" placeholder="메모 (선택)" className={`input ${members.length > 1 ? "" : "col-span-2"}`} />
          {members.length > 1 && (
            <select name="member" defaultValue={me ?? ""} className="input" aria-label="누가 쓴 돈">
              {!me && <option value="">누가 쓴 돈인지 모름</option>}
              {members.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name}
                  {m.name === me ? " (나)" : ""}
                </option>
              ))}
            </select>
          )}
          <SubmitButton className="col-span-2" pendingText="저장 중…">내역에 추가</SubmitButton>
        </form>
      </details>

      <section className="card !py-1">
        {txs.length === 0 && <p className="py-10 text-center text-sm text-sub">{reviewMode ? "확인할 결제가 없어요" : sp.q ? `"${sp.q}" 검색 결과가 없어요` : "이 달은 내역이 없어요"}</p>}
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
                  {!isMine(t, me) && (
                    <p className="text-[12px] font-semibold text-sub">{t.member?.name}님 결제라 보기만 할 수 있어요. 고치거나 지우는 건 {t.member?.name}님이 해요</p>
                  )}
                  {t.raws[0] && (
                    <p className="whitespace-pre-wrap rounded-lg border border-dashed border-line p-2.5 text-xs leading-relaxed text-sub">
                      {t.raws[0].title}
                      {"\n"}
                      {t.raws[0].text}
                    </p>
                  )}
                  {isMine(t, me) && (
                  <>
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
                      <input type="checkbox" name="learn" defaultChecked /> 다음부터 이 가맹점은 이 카테고리로 분류하기
                    </label>
                    <SubmitButton className="col-span-2" pendingText="저장 중…">저장</SubmitButton>
                  </form>
                  <div className="flex gap-2">
                    {t.status !== "IGNORED" ? (
                      <form action={setStatus.bind(null, t.id, "IGNORED")}>
                        <SubmitButton base="btn-ghost" pendingText="…">집계 제외</SubmitButton>
                      </form>
                    ) : (
                      <form action={setStatus.bind(null, t.id, "CONFIRMED")}>
                        <SubmitButton base="btn-ghost" pendingText="…">다시 포함</SubmitButton>
                      </form>
                    )}
                    <form action={deleteTransaction.bind(null, t.id)}>
                      <SubmitButton base="btn-ghost" className="!text-spend" pendingText="…">삭제</SubmitButton>
                    </form>
                  </div>
                  <p className="text-[11px] text-sub">
                    적금·청약 이체는 카테고리를 '저축'으로 바꾸면 집계에서 자동으로 빠져요. 계약금·잔금은 '결혼준비'로 바꿔 주세요
                  </p>
                  </>
                  )}
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
