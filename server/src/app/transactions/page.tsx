import Link from "next/link";
import { prisma } from "@/lib/db";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/categories";
import { kstMonthStart, kstParts, manwon, WEEKDAYS } from "@/lib/time";
import { TxRow } from "@/components/TxRow";
import { addManual, deleteTransaction, setStatus, updateTransaction } from "../actions";
import { Chevron } from "@/components/Chevron";

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

  // 날짜별로 묶어서 하루 단위 카드로 보여줌
  const groups: { day: string; spent: number; items: typeof txs }[] = [];
  for (const t of txs) {
    const day = dayLabel(t.occurredAt);
    let g = groups.at(-1);
    if (!g || g.day !== day) groups.push((g = { day, spent: 0, items: [] }));
    g.items.push(t);
    if (t.type === "EXPENSE" && !t.cancelled && t.status !== "IGNORED") g.spent += t.amount;
  }
  const link = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { month: sp.month, type: sp.type, q: sp.q, status: sp.status, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    return `/transactions${q.size ? `?${q}` : ""}`;
  };

  return (
    <main className="space-y-6">
      {reviewMode ? (
        <header className="px-1.5">
          <Link href="/transactions" className="text-[15px] font-semibold text-save">
            ‹ 전체 내역
          </Link>
          <h1 className="page-title mt-2">확인할 결제</h1>
          <p className="page-sub">알림만으로는 어디에 쓴 건지 확실하지 않은 결제예요. 눌러서 가맹점이랑 분류를 맞춰 주세요</p>
        </header>
      ) : (
        <header className="flex items-end justify-between px-1.5">
          <h1 className="page-title">내역</h1>
          <div className="glass flex items-center rounded-full p-1">
            <Link href={link({ month: ym(-1) })} aria-label="이전 달" className="flex h-8 w-8 items-center justify-center rounded-full text-[18px] text-sub">
              ‹
            </Link>
            <span className="num px-1 text-[15px] font-bold">
              {year}.{month + 1}
            </span>
            <Link href={link({ month: ym(1) })} aria-label="다음 달" className="flex h-8 w-8 items-center justify-center rounded-full text-[18px] text-sub">
              ›
            </Link>
          </div>
        </header>
      )}

      {!reviewMode && (
        <section className="card grid grid-cols-3 text-center">
          <div>
            <p className="text-[13px] font-semibold text-sub">들어온 돈</p>
            <p className="num mt-1 text-[19px] font-extrabold text-save">+{manwon(income)}</p>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-sub">나간 돈</p>
            <p className="num mt-1 text-[19px] font-extrabold">−{manwon(expense)}</p>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-sub">남은 돈</p>
            <p className={`num mt-1 text-[19px] font-extrabold ${income - expense < 0 ? "text-spend" : ""}`}>{manwon(income - expense)}</p>
          </div>
        </section>
      )}

      <div className="space-y-3">
        <form className="glass flex items-center gap-2 rounded-full py-1.5 pr-1.5 pl-4">
          {sp.month && <input type="hidden" name="month" value={sp.month} />}
          {sp.type && <input type="hidden" name="type" value={sp.type} />}
          {reviewMode && <input type="hidden" name="status" value="REVIEW" />}
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" className="shrink-0 text-faint" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input name="q" defaultValue={sp.q} placeholder="가게 이름으로 찾기" className="min-w-0 flex-1 bg-transparent py-1.5 text-[16px] outline-none" />
          <button className="btn !px-4 !py-2 !text-[14px]">찾기</button>
        </form>
        <div className="flex items-center gap-2">
          <nav className="segment flex-1" aria-label="종류">
            {[
              [undefined, "전체"],
              ["EXPENSE", "쓴 돈"],
              ["INCOME", "들어온 돈"],
            ].map(([v, label]) => (
              <Link key={label} href={link({ type: v })} aria-current={(sp.type ?? undefined) === v ? "page" : undefined}>
                {label}
              </Link>
            ))}
          </nav>
        </div>
        {sp.q && (
          <p className="px-1.5 text-[14px] text-sub">
            &quot;{sp.q}&quot; 검색 결과 {txs.length}건 ·{" "}
            <Link href={link({ q: undefined })} className="font-semibold text-save">
              검색 지우기
            </Link>
          </p>
        )}
      </div>

      {!reviewMode && (
        <details className="card group !p-0">
          <summary className="flex cursor-pointer items-center gap-3 px-5 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-save-soft text-[20px] font-bold text-save">+</span>
            <span className="flex-1">
              <span className="block text-[16px] font-bold">직접 추가하기</span>
              <span className="block text-[13px] text-sub">현금, 월급처럼 알림이 안 오는 돈</span>
            </span>
            <Chevron rotate />
          </summary>
          <form action={addManual} className="grid grid-cols-2 gap-3 px-5 pb-5">
            <div className="segment col-span-2" role="radiogroup">
              <label className="cursor-pointer has-[:checked]:bg-glass-strong has-[:checked]:text-ink has-[:checked]:shadow">
                <input type="radio" name="type" value="EXPENSE" defaultChecked className="sr-only" />
                쓴 돈
              </label>
              <label className="cursor-pointer has-[:checked]:bg-glass-strong has-[:checked]:text-ink has-[:checked]:shadow">
                <input type="radio" name="type" value="INCOME" className="sr-only" />
                들어온 돈
              </label>
            </div>
            <label className="col-span-2 space-y-1.5">
              <span className="label">금액</span>
              <input name="amount" inputMode="numeric" placeholder="예: 12000" required className="input num" />
            </label>
            <label className="space-y-1.5">
              <span className="label">어디서</span>
              <input name="merchant" placeholder="예: 동네 시장" className="input" />
            </label>
            <label className="space-y-1.5">
              <span className="label">날짜</span>
              <input name="date" type="date" defaultValue={today} className="input" />
            </label>
            <label className="col-span-2 space-y-1.5">
              <span className="label">분류</span>
              <select name="category" className="input" defaultValue="">
                <option value="">알아서 분류해 주세요</option>
                <optgroup label="쓴 돈">{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</optgroup>
                <optgroup label="들어온 돈">{INCOME_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</optgroup>
              </select>
            </label>
            <input name="memo" placeholder="메모 (안 써도 돼요)" className="input col-span-2" />
            <button className="btn col-span-2">추가하기</button>
          </form>
        </details>
      )}

      {txs.length === 0 && (
        <p className="card py-12 text-center text-[15px] leading-relaxed text-sub">
          {reviewMode ? "🎉 확인할 결제가 없어요. 깔끔해요!" : sp.q ? `"${sp.q}"로 찾은 결제가 없어요` : "이 달에는 아직 내역이 없어요"}
        </p>
      )}

      {groups.map((g) => (
        <section key={g.day}>
          <h2 className="section-title !text-[15px]">
            {g.day}
            {g.spent > 0 && <small className="num">−{g.spent.toLocaleString("ko-KR")}원</small>}
          </h2>
          <ul className="card ledger !py-1">
            {g.items.map((t) => (
              <li key={t.id}>
                <details>
                  <summary className="cursor-pointer">
                    <TxRow t={t} timeOnly={!reviewMode} />
                  </summary>
                  <div className="mb-3 space-y-3 rounded-[20px] bg-fill p-4">
                    {t.raws[0] && (
                      <div>
                        <p className="label mb-1.5">받은 알림 원문</p>
                        <p className="rounded-[14px] bg-glass-strong p-3 text-[13px] leading-relaxed whitespace-pre-wrap text-sub">
                          {t.raws[0].title}
                          {"\n"}
                          {t.raws[0].text}
                        </p>
                      </div>
                    )}
                    <form action={updateTransaction} className="grid grid-cols-2 gap-3">
                      <input type="hidden" name="id" value={t.id} />
                      <label className="space-y-1.5">
                        <span className="label">가게 이름</span>
                        <input name="merchant" defaultValue={t.merchant} className="input !bg-glass-strong" />
                      </label>
                      <label className="space-y-1.5">
                        <span className="label">분류</span>
                        <select name="category" defaultValue={t.category} className="input !bg-glass-strong">
                          {(t.type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                          {![...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].includes(t.category as never) && <option>{t.category}</option>}
                        </select>
                      </label>
                      <label className="col-span-2 flex items-start gap-2 text-[14px] text-sub">
                        <input type="checkbox" name="learn" defaultChecked className="mt-1 accent-[var(--color-save)]" />
                        다음부터 이 가게는 자동으로 이 분류로 넣기 (지난 결제도 같이 바뀌어요)
                      </label>
                      <button className="btn col-span-2">저장하기</button>
                    </form>
                    <div className="flex flex-wrap gap-2">
                      {t.status !== "IGNORED" ? (
                        <form action={setStatus.bind(null, t.id, "IGNORED")}>
                          <button className="btn-ghost">계산에서 빼기</button>
                        </form>
                      ) : (
                        <form action={setStatus.bind(null, t.id, "CONFIRMED")}>
                          <button className="btn-ghost">다시 계산에 넣기</button>
                        </form>
                      )}
                      <form action={deleteTransaction.bind(null, t.id)}>
                        <button className="btn-ghost !text-spend">삭제</button>
                      </form>
                    </div>
                    <p className="help !text-[12px]">
                      💡 적금·청약으로 보낸 돈은 분류를 &apos;저축&apos;으로, 웨딩홀 계약금·잔금은 &apos;결혼준비&apos;로 바꾸면 생활비에서 빠져요
                    </p>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}

function dayLabel(d: Date) {
  const p = kstParts(d);
  return `${p.month + 1}월 ${p.date}일 ${WEEKDAYS[p.weekday]}요일`;
}
