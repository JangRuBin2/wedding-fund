import { WEDDING_GROUPS, WEDDING_SUGGESTIONS } from "@/lib/wedding";

type Item = { name: string; group: string; budget: number; paid: number; dueDate: string; memo: string | null };

/** 예산 항목 추가·수정 작성 화면의 입력 칸 (form 안에 넣어서 씀) */
export function WeddingItemFields({ initial, autoFocus }: { initial: Item; autoFocus?: boolean }) {
  return (
    <>
      <label className="block space-y-1">
        <span className="label">항목</span>
        <input name="name" list="wedding-suggestions" defaultValue={initial.name} placeholder="예: 본식 스냅" required autoFocus={autoFocus} className="input" />
        <datalist id="wedding-suggestions">
          {WEDDING_SUGGESTIONS.map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="label">분류</span>
          <select name="group" defaultValue={initial.group} className="input">
            {WEDDING_GROUPS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="label">잔금일</span>
          <input name="dueDate" type="date" defaultValue={initial.dueDate} className="input" />
        </label>
        <label className="space-y-1">
          <span className="label">예산 (원)</span>
          <input name="budget" inputMode="numeric" defaultValue={initial.budget || ""} placeholder="미정" className="input num" />
        </label>
        <label className="space-y-1">
          <span className="label">낸 돈 (원)</span>
          <input name="paid" inputMode="numeric" defaultValue={initial.paid || ""} placeholder="0" className="input num" />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="label">메모</span>
        <input name="memo" defaultValue={initial.memo ?? ""} placeholder="업체, 계약 조건, 연락처" className="input" />
      </label>
    </>
  );
}
