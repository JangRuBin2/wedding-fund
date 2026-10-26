import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { fmtKst, toKst } from "@/lib/time";
import { deleteRule, saveGoal } from "../actions";
import { colorOf } from "@/lib/colors";
import { Chevron } from "@/components/Chevron";

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
    <main className="space-y-8">
      <header className="px-1.5">
        <h1 className="page-title">설정</h1>
      </header>

      <section>
        <h2 className="section-title">🎯 모으기 목표</h2>
        <form action={saveGoal} className="card grid grid-cols-2 gap-x-3 gap-y-5">
          <label className="col-span-2 space-y-1.5">
            <span className="label">목표 이름</span>
            <input name="title" defaultValue={goal?.title ?? "결혼자금"} className="input" />
          </label>
          <label className="space-y-1.5">
            <span className="label">모을 금액 (원)</span>
            <input name="targetAmount" inputMode="numeric" required defaultValue={goal?.targetAmount ?? ""} placeholder="50000000" className="input num" />
          </label>
          <label className="space-y-1.5">
            <span className="label">이미 모아둔 돈 (원)</span>
            <input name="startAmount" inputMode="numeric" defaultValue={goal?.startAmount ?? 0} className="input num" />
          </label>
          <label className="space-y-1.5">
            <span className="label">언제부터 셀까요</span>
            <input name="startDate" type="date" required defaultValue={dateInput(goal?.startDate ?? now)} className="input" />
          </label>
          <label className="space-y-1.5">
            <span className="label">결혼식 날</span>
            <input name="targetDate" type="date" required defaultValue={dateInput(goal?.targetDate ?? nextYear)} className="input" />
          </label>
          <label className="col-span-2 space-y-1.5">
            <span className="label">이보다 크게 결제하면 폰으로 알려드려요 (원)</span>
            <input name="bigSpendThreshold" inputMode="numeric" defaultValue={goal?.bigSpendThreshold ?? 50000} className="input num" />
          </label>
          <p className="help col-span-2 flex gap-2 rounded-[16px] bg-fill p-3.5">
            <span aria-hidden>💡</span>
            <span>
              모은 돈 = 이미 모아둔 돈 + 시작일 이후 (들어온 돈 − 쓴 돈). 적금이나 내 다른 계좌로 보낸 돈은 &apos;저축&apos;으로 분류하면 쓴 돈에서 빠져요
            </span>
          </p>
          <button className="btn col-span-2">목표 저장하기</button>
        </form>
      </section>

      <section>
        <h2 className="section-title">📱 폰 앱 연결</h2>
        <div className="card space-y-4">
          <ol className="space-y-3 text-[15px]">
            {[
              <>폰에 결혼자금 앱을 깔고 &apos;알림 접근&apos;을 허용해요</>,
              <>
                서버 주소에 <code className="num rounded-md bg-fill px-1.5 py-0.5 text-[14px] break-all">{origin}</code>를 넣어요
              </>,
              <>
                토큰에는 서버 <code className="rounded-md bg-fill px-1.5 py-0.5 text-[14px]">.env</code>의{" "}
                <code className="rounded-md bg-fill px-1.5 py-0.5 text-[14px]">INGEST_TOKEN</code> 값을 넣어요
              </>,
              <>이름을 넣고 &apos;저장하고 연결 확인&apos;을 누르면 끝!</>,
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-save-soft text-[13px] font-bold text-save">
                  {i + 1}
                </span>
                <span className="leading-snug">{step}</span>
              </li>
            ))}
          </ol>
          <div className="flex items-center justify-between border-t border-line pt-4 text-[15px]">
            <span className="text-sub">연결된 사람</span>
            <span className="font-bold">{members.length ? members.map((m) => m.name).join(", ") : "아직 없어요"}</span>
          </div>
        </div>
        <p className="help mt-2 px-1.5">둘이 같이 쓰려면 각자 폰에 앱을 깔고 이름만 다르게 넣으면 돼요</p>
      </section>

      <section>
        <h2 className="section-title">
          🏷️ 자동 분류 규칙
          <small>{rules.length}개</small>
        </h2>
        <ul className="card ledger !py-1 text-[15px]">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-3">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{r.merchant}</span>
                <span className="text-[13px] text-sub">
                  → <b style={{ color: colorOf(r.category) }}>{r.category}</b>
                  <span className="ml-1.5 text-faint">{r.source === "LLM" ? "AI가 정함" : "직접 정함"}</span>
                </span>
              </span>
              <form action={deleteRule.bind(null, r.id)}>
                <button className="btn-ghost shrink-0 !px-3 !py-1.5 !text-[13px] !text-spend">삭제</button>
              </form>
            </li>
          ))}
          {rules.length === 0 && (
            <li className="py-8 text-center text-[15px] leading-relaxed text-sub">
              내역에서 분류를 고치면
              <br />
              다음부터 자동으로 적용될 규칙이 여기 쌓여요
            </li>
          )}
        </ul>
      </section>

      <details className="card !p-0">
        <summary className="flex cursor-pointer items-center gap-3 px-5 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fill text-[18px]">🛠️</span>
          <span className="flex-1">
            <span className="block text-[16px] font-bold">문제 해결: 최근 받은 알림</span>
            <span className="block text-[13px] text-sub">결제했는데 내역에 안 뜰 때 여기서 확인해요</span>
          </span>
          <Chevron rotate size={16} />
        </summary>
        <div className="space-y-2 px-3 pb-3">
          <p className="help px-2 pb-1">
            결제 알림인데 &apos;건너뜀&apos;이면 아직 그 카드사 문구를 모르는 거예요. 원문을 <code>scripts/test-parser.ts</code>에 추가하면 고칠 수 있어요
          </p>
          {raws.map((r) => {
            const res = RESULT[r.result] ?? { text: r.result, cls: "bg-fill text-sub" };
            return (
              <div key={r.id} className="rounded-[16px] bg-fill p-3 text-[13px]">
                <div className="mb-1.5 flex items-center justify-between gap-2 text-sub">
                  <span className="num truncate">
                    {fmtKst(r.createdAt)} · {r.packageName.split(".").at(-1)}
                  </span>
                  <span className={`pill shrink-0 !py-0.5 !text-[11px] ${res.cls}`}>{res.text}</span>
                </div>
                <p className="leading-relaxed whitespace-pre-wrap">
                  {r.title}
                  {"\n"}
                  {r.text}
                </p>
              </div>
            );
          })}
          {raws.length === 0 && <p className="py-6 text-center text-[15px] text-sub">폰 앱을 연결하면 받은 알림 원문이 여기 보여요</p>}
        </div>
      </details>
    </main>
  );
}

const RESULT: Record<string, { text: string; cls: string }> = {
  PARSED: { text: "기록됨", cls: "bg-save-soft text-save" },
  CANCEL_MATCHED: { text: "취소 반영", cls: "bg-save-soft text-save" },
  DUPLICATE: { text: "이미 받음", cls: "bg-fill text-sub" },
  ALREADY_SEEN: { text: "이미 받음", cls: "bg-fill text-sub" },
  SKIPPED: { text: "건너뜀", cls: "bg-warn-soft text-warn" },
  INVALID: { text: "잘못된 형식", cls: "bg-spend-soft text-spend" },
};
