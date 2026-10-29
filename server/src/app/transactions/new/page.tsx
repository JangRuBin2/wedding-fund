import { prisma } from "@/lib/db";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/categories";
import { getMe } from "@/lib/me";
import { safeBack } from "@/lib/back";
import { SubmitButton } from "@/components/SubmitButton";
import { WriteHeader } from "@/components/WriteHeader";
import { addManual } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewTransactionPage({ searchParams }: { searchParams: Promise<{ back?: string | string[] }> }) {
  const back = safeBack((await searchParams).back, "/transactions");
  const [me, members] = await Promise.all([getMe(), prisma.member.findMany({ orderBy: { createdAt: "asc" } })]);
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  return (
    <main className="space-y-6">
      <WriteHeader back={back} backLabel="돌아가기" title="직접 입력" sub="현금·계좌이체·월급처럼 알림이 안 온 내역을 적어 주세요" />
      <form action={addManual} className="card space-y-4">
        <input type="hidden" name="back" value={back} />
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="label">구분</span>
            <select name="type" className="input">
              <option value="EXPENSE">지출</option>
              <option value="INCOME">수입</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="label">날짜</span>
            <input name="date" type="date" defaultValue={today} className="input" />
          </label>
          <label className="space-y-1">
            <span className="label">금액 (원)</span>
            <input name="amount" inputMode="numeric" placeholder="0" required autoFocus className="input num" />
          </label>
          <label className="space-y-1">
            <span className="label">어디서, 무엇을</span>
            <input name="merchant" placeholder="예: 시장" className="input" />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="label">카테고리</span>
          <select name="category" className="input" defaultValue="">
            <option value="">자동 분류</option>
            <optgroup label="지출">{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</optgroup>
            <optgroup label="수입">{INCOME_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</optgroup>
          </select>
        </label>
        <label className="block space-y-1">
          <span className="label">메모 (선택)</span>
          <input name="memo" className="input" />
        </label>
        {members.length > 1 && (
          <label className="block space-y-1">
            <span className="label">누가 쓴 돈</span>
            <select name="member" defaultValue={me ?? ""} className="input">
              {!me && <option value="">모름</option>}
              {members.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name}
                  {m.name === me ? " (나)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <SubmitButton className="w-full" pendingText="저장 중…">내역에 추가</SubmitButton>
      </form>
    </main>
  );
}
