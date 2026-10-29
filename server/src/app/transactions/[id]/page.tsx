import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/categories";
import { getMe } from "@/lib/me";
import { isMine } from "@/lib/ownership";
import { safeBack } from "@/lib/back";
import { SubmitButton } from "@/components/SubmitButton";
import { WriteHeader } from "@/components/WriteHeader";
import { TxRow } from "@/components/TxRow";
import { deleteTransaction, setStatus, updateTransaction } from "../../actions";

export const dynamic = "force-dynamic";

/** 내역 하나 고치기 (작성 화면). 남의 결제면 보기만 */
export default async function EditTransactionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string | string[] }>;
}) {
  const { id } = await params;
  const back = safeBack((await searchParams).back, "/transactions");
  const [t, me] = await Promise.all([
    prisma.transaction.findUnique({ where: { id }, include: { member: true, raws: { take: 1, orderBy: { createdAt: "asc" } } } }),
    getMe(),
  ]);
  if (!t) notFound();
  const mine = isMine(t, me);

  return (
    <main className="space-y-6">
      <WriteHeader back={back} backLabel="내역" title={mine ? "내역 고치기" : "내역 보기"} />
      <div className="card !py-1">
        <TxRow t={t} />
      </div>
      {t.raws[0] && (
        <p className="whitespace-pre-wrap rounded-xl border border-dashed border-line p-3 text-xs leading-relaxed text-sub">
          {t.raws[0].title}
          {"\n"}
          {t.raws[0].text}
        </p>
      )}
      {!mine ? (
        <p className="px-1 text-[13px] text-sub">{t.member?.name}님 결제라 보기만 할 수 있어요. 고치거나 지우는 건 {t.member?.name}님이 해요</p>
      ) : (
        <>
          <form action={updateTransaction} className="card space-y-4">
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="back" value={back} />
            <label className="block space-y-1">
              <span className="label">가맹점</span>
              <input name="merchant" defaultValue={t.merchant} className="input" />
            </label>
            <label className="block space-y-1">
              <span className="label">카테고리</span>
              <select name="category" defaultValue={t.category} className="input">
                {(t.type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                  <option key={c}>{c}</option>
                ))}
                {![...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].includes(t.category as never) && <option>{t.category}</option>}
              </select>
            </label>
            <label className="flex items-center gap-2 text-[13px] text-sub">
              <input type="checkbox" name="learn" defaultChecked /> 다음부터 이 가맹점은 이 카테고리로 분류하기
            </label>
            <SubmitButton className="w-full" pendingText="저장 중…">저장</SubmitButton>
            <p className="text-[11px] text-sub">
              적금·청약 이체는 카테고리를 &apos;저축&apos;으로 바꾸면 집계에서 자동으로 빠져요. 계약금·잔금은 &apos;결혼준비&apos;로 바꿔 주세요
            </p>
          </form>
          <div className="flex justify-center gap-2">
            {t.status !== "IGNORED" ? (
              <form action={setStatus.bind(null, t.id, "IGNORED")}>
                <SubmitButton base="btn-ghost" pendingText="…">집계 제외</SubmitButton>
              </form>
            ) : (
              <form action={setStatus.bind(null, t.id, "CONFIRMED")}>
                <SubmitButton base="btn-ghost" pendingText="…">다시 포함</SubmitButton>
              </form>
            )}
            <form action={deleteTransaction.bind(null, t.id, back)}>
              <SubmitButton base="btn-ghost" className="!text-spend" pendingText="지우는 중…">삭제</SubmitButton>
            </form>
          </div>
        </>
      )}
    </main>
  );
}
