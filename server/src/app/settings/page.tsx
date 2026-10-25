import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { fmtKst, toKst } from "@/lib/time";
import { deleteRule, saveGoal } from "../actions";

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
    <main className="space-y-4">
      <h1 className="text-2xl font-bold">설정</h1>

      <section className="card">
        <p className="mb-3 font-bold">목표</p>
        <form action={saveGoal} className="grid grid-cols-2 gap-3">
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
            <span className="label">목표일</span>
            <input name="targetDate" type="date" required defaultValue={dateInput(goal?.targetDate ?? nextYear)} className="input" />
          </label>
          <label className="col-span-2 space-y-1">
            <span className="label">이 금액 이상 결제 시 폰으로 넛지 (원)</span>
            <input name="bigSpendThreshold" inputMode="numeric" defaultValue={goal?.bigSpendThreshold ?? 50000} className="input num" />
          </label>
          <p className="col-span-2 text-xs text-sub">
            모은 돈 = 이미 모아둔 돈 + 시작일 이후 (수입 − 지출). 적금 납입이나 내 계좌 간 이체는 내역에서 '집계 제외' 처리
          </p>
          <button className="btn col-span-2">저장</button>
        </form>
      </section>

      <section className="card space-y-2 text-sm">
        <p className="font-bold">폰 앱 연결 정보</p>
        <p>서버 주소: <code className="rounded bg-paper px-1.5 py-0.5">{origin}</code></p>
        <p>토큰: 서버 <code className="rounded bg-paper px-1.5 py-0.5">.env</code>의 <code>INGEST_TOKEN</code> 값</p>
        <p className="text-xs text-sub">
          연결된 사람: {members.length ? members.map((m) => m.name).join(", ") : "아직 없음"} — 커플이 같이 쓰려면 각자 폰에 앱 깔고 이름만 다르게
        </p>
      </section>

      <section className="card">
        <p className="mb-1 font-bold">최근 받은 알림 원문</p>
        <p className="mb-3 text-xs text-sub">SKIPPED인데 결제 알림이면 파서가 못 잡은 거. 원문 복사해서 scripts/test-parser.ts에 케이스로 추가</p>
        <ul className="space-y-2">
          {raws.map((r) => (
            <li key={r.id} className="rounded-lg bg-paper p-2 text-xs">
              <div className="mb-1 flex justify-between text-sub">
                <span>{fmtKst(r.createdAt)} · {r.packageName}</span>
                <b className={r.result === "SKIPPED" ? "text-warn" : r.result === "PARSED" ? "text-save" : ""}>{r.result}</b>
              </div>
              <p className="whitespace-pre-wrap">{r.title}{"\n"}{r.text}</p>
            </li>
          ))}
          {raws.length === 0 && <li className="text-sm text-sub">아직 없음</li>}
        </ul>
      </section>

      <section className="card">
        <p className="mb-3 font-bold">학습된 가맹점 규칙</p>
        <ul className="divide-y divide-line text-sm">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2">
              <span>
                {r.merchant} → <b>{r.category}</b> <span className="text-xs text-sub">({r.source === "LLM" ? "AI" : "직접"})</span>
              </span>
              <form action={deleteRule.bind(null, r.id)}>
                <button className="text-xs text-sub">삭제</button>
              </form>
            </li>
          ))}
          {rules.length === 0 && <li className="py-2 text-sub">내역에서 카테고리 고치면 여기 쌓임</li>}
        </ul>
      </section>
    </main>
  );
}
