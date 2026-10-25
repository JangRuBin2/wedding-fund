import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { fmtKst, toKst } from "@/lib/time";
import { deleteRule, saveGoal } from "../actions";
import { colorOf } from "@/lib/colors";

export const dynamic = "force-dynamic";

const dateInput = (d: Date) => toKst(d).toISOString().slice(0, 10);

export default async function Settings() {
  const [goal, rules, raws, members] = await Promise.all([
    prisma.goal.findUnique({ where: { id: 1 } }),
    prisma.merchantRule.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.rawNotification.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.member.findMany(),
  ]);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const now = new Date();
  const nextYear = new Date(now.getTime() + 365 * 86400_000);

  return (
    <main className="space-y-7">
      <h1 className="text-[22px] font-bold">설정</h1>

      <section>
        <h2 className="section-title">목표</h2>
        <form action={saveGoal} className="card grid grid-cols-2 gap-x-3 gap-y-4">
          <label className="col-span-2 space-y-1">
            <span className="label">이름</span>
            <input name="title" defaultValue={goal?.title ?? "결혼자금"} className="input" />
          </label>
          <label className="space-y-1">
            <span className="label">목표 금액 (원)</span>
            <input name="targetAmount" inputMode="numeric" required defaultValue={goal?.targetAmount ?? ""} className="input num" />
          </label>
          <label className="space-y-1">
            <span className="label">이미 모아둔 돈 (원)</span>
            <input name="startAmount" inputMode="numeric" defaultValue={goal?.startAmount ?? 0} className="input num" />
          </label>
          <label className="space-y-1">
            <span className="label">추적 시작일</span>
            <input name="startDate" type="date" required defaultValue={dateInput(goal?.startDate ?? now)} className="input" />
          </label>
          <label className="space-y-1">
            <span className="label">목표일 (결혼식 날)</span>
            <input name="targetDate" type="date" required defaultValue={dateInput(goal?.targetDate ?? nextYear)} className="input" />
          </label>
          <label className="col-span-2 space-y-1">
            <span className="label">이 금액 넘게 결제하면 폰으로 알림 (원)</span>
            <input name="bigSpendThreshold" inputMode="numeric" defaultValue={goal?.bigSpendThreshold ?? 50000} className="input num" />
          </label>
          <p className="col-span-2 text-[12px] leading-relaxed text-sub">
            모은 돈은 이미 모아둔 돈에 시작일 이후 수입에서 지출을 뺀 만큼 더한 값. 적금 납입이나 내 계좌 간 이체는 내역에서 집계 제외해줘
          </p>
          <button className="btn col-span-2">목표 저장</button>
        </form>
      </section>

      <section>
        <h2 className="section-title">폰 앱 연결</h2>
        <div className="card !py-1 text-[14px]">
          <dl className="ledger">
            <div className="flex items-center justify-between gap-3 py-3">
              <dt className="text-sub">서버 주소</dt>
              <dd><code className="num rounded bg-paper px-1.5 py-0.5 text-[13px]">{origin}</code></dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-3">
              <dt className="text-sub">토큰</dt>
              <dd className="text-right">서버 .env의 <code className="rounded bg-paper px-1.5 py-0.5 text-[13px]">INGEST_TOKEN</code></dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-3">
              <dt className="text-sub">연결된 사람</dt>
              <dd className="font-semibold">{members.length ? members.map((m) => m.name).join(", ") : "아직 없음"}</dd>
            </div>
          </dl>
        </div>
        <p className="mt-2 px-1 text-[12px] text-sub">둘이 같이 쓰려면 각자 폰에 앱을 깔고 이름만 다르게 넣으면 돼</p>
      </section>

      <section>
        <h2 className="section-title">최근 받은 알림</h2>
        <p className="mb-2 px-1 text-[12px] leading-relaxed text-sub">결제 알림인데 SKIPPED면 파서가 못 잡은 거. 원문을 scripts/test-parser.ts에 케이스로 추가하면 돼</p>
        <ul className="card space-y-2 !p-2">
          {raws.map((r) => (
            <li key={r.id} className="rounded-lg bg-paper p-2.5 text-xs">
              <div className="mb-1 flex justify-between gap-2 text-sub">
                <span className="truncate"><span className="num">{fmtKst(r.createdAt)}</span> {r.packageName}</span>
                <b className={r.result === "SKIPPED" ? "text-warn" : r.result === "PARSED" ? "text-save" : ""}>{r.result}</b>
              </div>
              <p className="whitespace-pre-wrap">{r.title}{"\n"}{r.text}</p>
            </li>
          ))}
          {raws.length === 0 && <li className="py-6 text-center text-sm text-sub">폰 앱을 연결하면 받은 알림 원문이 여기 보여</li>}
        </ul>
      </section>

      <section>
        <h2 className="section-title">가맹점 분류 규칙<small>{rules.length}개</small></h2>
        <ul className="card ledger !py-1 text-[14px]">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0 truncate">
                {r.merchant}
                <b className="ml-2" style={{ color: colorOf(r.category) }}>{r.category}</b>
                <span className="ml-1.5 text-[11px] text-faint">{r.source === "LLM" ? "AI 분류" : "직접 지정"}</span>
              </span>
              <form action={deleteRule.bind(null, r.id)}>
                <button className="shrink-0 rounded-md px-2 py-1 text-[12px] text-sub hover:text-spend">삭제</button>
              </form>
            </li>
          ))}
          {rules.length === 0 && <li className="py-6 text-center text-sm text-sub">내역에서 카테고리를 고치면 여기 쌓여</li>}
        </ul>
      </section>
    </main>
  );
}
