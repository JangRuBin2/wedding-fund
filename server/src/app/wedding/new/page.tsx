import { SubmitButton } from "@/components/SubmitButton";
import { WriteHeader } from "@/components/WriteHeader";
import { addWeddingStep } from "../../actions";

export const dynamic = "force-dynamic";

export default function NewWeddingEventPage() {
  return (
    <main className="space-y-6">
      <WriteHeader back="/wedding" backLabel="할 일" title="이벤트 추가" sub="저장하면 이 이벤트 화면으로 가서 체크리스트와 결제를 이어서 채울 수 있어요" />
      <form action={addWeddingStep} className="card space-y-4">
        <label className="block space-y-1">
          <span className="label">이름</span>
          <input name="title" placeholder="예: 드레스 투어" required autoFocus maxLength={100} className="input" />
        </label>
        <label className="block space-y-1">
          <span className="label">날짜 (선택)</span>
          <input name="targetDate" type="date" className="input" />
        </label>
        <SubmitButton pendingText="저장 중…" className="w-full">저장</SubmitButton>
      </form>
    </main>
  );
}
