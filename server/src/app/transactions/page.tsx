import Link from "next/link";
import { LinkPending } from "@/components/LinkPending";
import { prisma } from "@/lib/db";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/categories";
import { fmtKst, kstMonthStart, kstParts, manwon, WEEKDAYS } from "@/lib/time";
import { ReviewDeck, type ReviewItem } from "@/components/ReviewDeck";
import { TxRow } from "@/components/TxRow";
import { mineWhere } from "@/lib/ownership";
import { getMe } from "@/lib/me";

export const dynamic = "force-dynamic";

type Param = string | string[] | undefined;
type SP = Promise<{ month?: Param; status?: Param; type?: Param; q?: Param; view?: Param }>;

export default async function Transactions({ searchParams }: { searchParams: SP }) {
  const raw = await searchParams;
  // ?q=a&q=b 처럼 배열로 오거나 형식이 틀린 값은 무시
  const one = (v: unknown) => (typeof v === "string" ? v : undefined);
  const sp = { month: one(raw.month), status: one(raw.status), type: one(raw.type), q: one(raw.q), view: one(raw.view) };
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
  const [me, mine] = await Promise.all([getMe(), mineWhere()]);
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
  // 작성 화면(직접 입력·내역 고치기)에서 저장하면 돌아올 지금 목록 주소
  const listQuery = new URLSearchParams(
    Object.entries({ month: sp.month, status: sp.status, type: sp.type, q: sp.q, view: sp.view }).filter((e): e is [string, string] => !!e[1]),
  ).toString();
  const listUrl = `/transactions${listQuery ? `?${listQuery}` : ""}`;

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
            <Link href="/transactions/new?back=%2Ftransactions%3Fstatus%3DREVIEW" className="btn-ghost">+ 직접 기록</Link>
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

      <Link href={`/transactions/new?back=${encodeURIComponent(listUrl)}`} className="card relative flex items-center justify-between !py-3.5">
        <span className="font-semibold">+ 직접 입력</span>
        <span className="text-[13px] font-medium text-sub">현금·계좌이체·월급처럼 알림이 안 온 내역</span>
        <LinkPending className="rounded-[20px]" />
      </Link>

      <section className="card !py-1">
        {txs.length === 0 && <p className="py-10 text-center text-sm text-sub">{reviewMode ? "확인할 결제가 없어요" : sp.q ? `"${sp.q}" 검색 결과가 없어요` : "이 달은 내역이 없어요"}</p>}
        <ul>
          {txs.map((t, i) => {
            const day = dayLabel(t.occurredAt);
            const showDay = i === 0 || dayLabel(txs[i - 1].occurredAt) !== day;
            return (
            <li key={t.id}>
              {showDay && <p className="pt-4 pb-1 text-[12px] font-semibold text-sub">{day}</p>}
              <Link href={`/transactions/${t.id}?back=${encodeURIComponent(listUrl)}`} className="block">
                <TxRow t={t} timeOnly={!reviewMode} />
              </Link>
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
