import { SubmitButton } from "@/components/SubmitButton";
import { WriteHeader } from "@/components/WriteHeader";
import { WeddingItemFields } from "@/components/WeddingItemFields";
import { addWeddingItem } from "../../../../actions";

export const dynamic = "force-dynamic";

export default function NewWeddingItemPage() {
  return (
    <main className="space-y-6">
      <WriteHeader back="/wedding/budget" backLabel="예산" title="예산 항목 추가" />
      <form action={addWeddingItem} className="card space-y-4">
        <WeddingItemFields initial={{ name: "", group: "기타", budget: 0, paid: 0, dueDate: "", memo: null }} autoFocus />
        <SubmitButton pendingText="저장 중…" className="w-full">저장</SubmitButton>
      </form>
    </main>
  );
}
