import { PAY_METHODS, PAYERS, WEDDING_CATEGORIES } from "@/lib/wedding-meta";

type Payment = { category: string; content: string; amount: number; method: string; payer: string; payerNote: string | null; paidAt: string };

/** 결제 추가·수정 작성 화면의 입력 칸 (form 안에 넣어서 씀) */
export function PaymentFields({ initial }: { initial: Payment }) {
  return (
    <>
      <fieldset className="space-y-1">
        <legend className="label mb-1">예산 구분</legend>
        <div className="flex flex-wrap gap-1.5">
          {WEDDING_CATEGORIES.map((c) => (
            <label key={c.name} className="cursor-pointer">
              <input type="radio" name="category" value={c.name} defaultChecked={c.name === initial.category} className="peer sr-only" />
              <span
                className="block rounded-full border-2 border-transparent bg-paper px-3 py-1.5 text-[13px] font-semibold text-sub peer-checked:text-ink peer-focus-visible:outline peer-checked:[border-color:var(--c)]"
                style={{ "--c": c.color } as React.CSSProperties}
              >
                <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: c.color }} />
                {c.name}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block space-y-1">
        <span className="label">내용</span>
        <input name="content" defaultValue={initial.content} placeholder="예: 헤어변형" required maxLength={100} className="input" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="label">금액 (원)</span>
          <input name="amount" inputMode="numeric" defaultValue={initial.amount || ""} placeholder="0" required className="input num" />
        </label>
        <label className="space-y-1">
          <span className="label">결제일 (예정일)</span>
          <input name="paidAt" type="date" defaultValue={initial.paidAt} className="input" />
        </label>
        <label className="space-y-1">
          <span className="label">결제 방식</span>
          <select name="method" defaultValue={initial.method} className="input">
            {Object.entries(PAY_METHODS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="label">결제자</span>
          <select name="payer" defaultValue={initial.payer} className="input">
            {Object.entries(PAYERS).map(([k, v]) => (
              <option key={k} value={k}>{v === "기타" ? "기타 (부모님 등)" : v}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block space-y-1">
        <span className="label">결제자가 기타면 누구인지</span>
        <input name="payerNote" defaultValue={initial.payerNote ?? ""} placeholder="예: 신부 어머니" maxLength={30} className="input" />
      </label>
    </>
  );
}
