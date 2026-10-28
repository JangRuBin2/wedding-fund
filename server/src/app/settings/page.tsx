import { SubmitButton } from "@/components/SubmitButton";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { fmtKst, toKst } from "@/lib/time";
import { deleteRule, renameUser, saveGoal, saveProfile, setMe, setUserStatus } from "../actions";
import { currentSession, getMe } from "@/lib/me";
import { kakaoEnabled } from "@/lib/session";
import { colorOf } from "@/lib/colors";

export const dynamic = "force-dynamic";

const dateInput = (d: Date) => toKst(d).toISOString().slice(0, 10);

export default async function Settings() {
  const [goal, rules, raws, members, profiles, me] = await Promise.all([
    prisma.goal.findUnique({ where: { id: 1 } }),
    prisma.merchantRule.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.rawNotification.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.member.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.profile.findMany(),
    getMe(),
  ]);
  const kakao = kakaoEnabled();
  const session = kakao ? await currentSession() : null;
  const users = kakao ? await prisma.user.findMany({ orderBy: { createdAt: "asc" } }) : [];
  const isOwner = users.some((u) => u.id === session?.uid && u.role === "OWNER");
  const triValue = (v: boolean | null | undefined) => (v === true ? "yes" : v === false ? "no" : "");
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
            모은 돈은 이미 모아둔 돈에 시작일 이후 (수입 − 지출)을 더해서 계산해요. 적금 납입이나 내 계좌 간 이체는 내역에서 집계 제외해 주세요
          </p>
          <SubmitButton className="col-span-2" pendingText="저장 중…">목표 저장</SubmitButton>
        </form>
      </section>

      {kakao ? (
        <section>
          <h2 className="section-title">
            로그인 계정
            <a href="/api/auth/logout" className="text-[13px] font-semibold text-sub">로그아웃</a>
          </h2>
          <ul className="card ledger !py-1">
            {users
              .filter((u) => isOwner || u.id === session?.uid)
              .map((u) => (
                <li key={u.id} className="space-y-2 py-3">
                  <div className="flex items-center gap-2 text-[14px]">
                    <span className="font-semibold">{u.name}</span>
                    {u.nickname && u.nickname !== u.name && <span className="text-[12px] text-sub">카카오 {u.nickname}</span>}
                    {u.role === "OWNER" && <span className="rounded-md bg-save-soft px-1.5 py-0.5 text-[10px] font-bold text-save">관리자</span>}
                    {u.status === "PENDING" && <span className="rounded-md bg-spend-soft px-1.5 py-0.5 text-[10px] font-bold text-spend">승인 대기</span>}
                    {u.status === "REJECTED" && <span className="rounded-md bg-paper px-1.5 py-0.5 text-[10px] font-bold text-sub">막음</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={renameUser} className="flex flex-1 gap-2">
                      <input type="hidden" name="id" value={u.id} />
                      <input name="name" defaultValue={u.name} list="member-names" aria-label="이름" className="input !py-1.5 text-[14px]" />
                      <SubmitButton base="btn-ghost" className="shrink-0 !bg-paper" pendingText="…">이름 저장</SubmitButton>
                    </form>
                    {isOwner && u.id !== session?.uid && u.status !== "APPROVED" && (
                      <form action={setUserStatus.bind(null, u.id, "APPROVED")}>
                        <SubmitButton base="btn-ghost" className="!bg-save !text-white" pendingText="…">승인</SubmitButton>
                      </form>
                    )}
                    {isOwner && u.id !== session?.uid && u.status !== "REJECTED" && (
                      <form action={setUserStatus.bind(null, u.id, "REJECTED")}>
                        <SubmitButton base="btn-ghost" className="!text-spend" pendingText="…">{u.status === "PENDING" ? "거절" : "막기"}</SubmitButton>
                      </form>
                    )}
                  </div>
                </li>
              ))}
          </ul>
          <datalist id="member-names">
            {members.map((m) => (
              <option key={m.id} value={m.name} />
            ))}
          </datalist>
          <p className="mt-2 px-1 text-[12px] leading-relaxed text-sub">
            이름을 폰 앱에 입력한 이름({members.map((m) => m.name).join(", ") || "아직 없음"})과 같게 맞추면 체크 기록과 팁 맞춤이 이어져요
          </p>
        </section>
      ) : (
        members.length > 0 && (
        <section>
          <h2 className="section-title">
            이 기기는 누구
            <small>체크리스트에 체크한 사람으로 남아요</small>
          </h2>
          <form action={setMe} className="card flex flex-wrap gap-2 !py-3.5">
            {members.map((m) => (
              <button
                key={m.id}
                name="name"
                value={m.name}
                className={`btn-ghost ${me === m.name ? "!bg-save !text-white" : "!bg-paper"}`}
                aria-pressed={me === m.name}
              >
                {m.name}
              </button>
            ))}
          </form>
        </section>
        )
      )}

      {members.length > 0 && (
        <section>
          <h2 className="section-title">
            팁 맞춤 정보
            <small>모르면 비워 두세요</small>
          </h2>
          <div className="space-y-3">
            {members.map((m) => {
              const p = profiles.find((x) => x.name === m.name);
              const Tri = ({ name, label }: { name: string; label: string }) => (
                <label className="space-y-1">
                  <span className="label">{label}</span>
                  <select name={name} defaultValue={triValue(p?.[name as "married"])} className="input">
                    <option value="">모름</option>
                    <option value="yes">예</option>
                    <option value="no">아니요</option>
                  </select>
                </label>
              );
              return (
                <details key={m.id} className="card group" open={!p && m.name === me}>
                  <summary className="flex cursor-pointer list-none items-center justify-between font-semibold [&::-webkit-details-marker]:hidden">
                    {m.name}
                    <span className="text-[12px] font-medium text-sub">{p ? "입력됨 · 고치기" : "입력하기"}</span>
                  </summary>
                  <form action={saveProfile} className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3">
                    <input type="hidden" name="name" value={m.name} />
                    <label className="space-y-1">
                      <span className="label">출생 연도</span>
                      <input name="birthYear" inputMode="numeric" placeholder="1995" defaultValue={p?.birthYear ?? ""} className="input num" />
                    </label>
                    <label className="space-y-1">
                      <span className="label">지금 사는 집</span>
                      <select name="housing" defaultValue={p?.housing ?? ""} className="input">
                        <option value="">모름</option>
                        <option>월세</option>
                        <option>전세</option>
                        <option>자가</option>
                        <option>가족과 함께</option>
                      </select>
                    </label>
                    <Tri name="smallCompany" label="중소기업 다녀요" />
                    <Tri name="householder" label="세대주예요" />
                    <Tri name="changedJobThisYear" label="올해 이직·퇴사했어요" />
                    <Tri name="married" label="혼인신고 했어요" />
                    <SubmitButton className="col-span-2" pendingText="저장 중…">저장</SubmitButton>
                  </form>
                </details>
              );
            })}
          </div>
          <p className="mt-2 px-1 text-[12px] leading-relaxed text-sub">
            매일 아침 팁에서 해당 없는 내용을 빼는 데만 써요. 예를 들어 자가면 월세·전세 팁을, 짝수 해에 홀수 연도생이면 건강검진 팁을 빼요
          </p>
        </section>
      )}

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
              <dd className="text-right">서버 환경변수 <code className="rounded bg-paper px-1.5 py-0.5 text-[13px]">INGEST_TOKEN</code></dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-3">
              <dt className="text-sub">연결된 사람</dt>
              <dd className="font-semibold">{members.length ? members.map((m) => m.name).join(", ") : "아직 없어요"}</dd>
            </div>
          </dl>
        </div>
        <p className="mt-2 px-1 text-[12px] text-sub">둘이 함께 쓰려면 각자 폰에 앱을 설치하고 이름만 다르게 입력해 주세요</p>
      </section>

      <section>
        <h2 className="section-title">최근 받은 알림</h2>
        <p className="mb-2 px-1 text-[12px] leading-relaxed text-sub">결제 알림인데 SKIPPED로 표시됐다면 파서가 인식하지 못한 거예요. 원문을 scripts/test-parser.ts에 케이스로 추가해 주세요</p>
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
          {raws.length === 0 && <li className="py-6 text-center text-sm text-sub">폰 앱을 연결하면 받은 알림 원문이 여기에 표시돼요</li>}
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
          {rules.length === 0 && <li className="py-6 text-center text-sm text-sub">내역에서 카테고리를 고치면 여기에 쌓여요</li>}
        </ul>
      </section>
    </main>
  );
}
