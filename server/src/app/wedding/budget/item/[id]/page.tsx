import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { toKst } from "@/lib/time";
import { SubmitButton } from "@/components/SubmitButton";
import { WriteHeader } from "@/components/WriteHeader";
import { WeddingItemFields } from "@/components/WeddingItemFields";
import { deleteWeddingItem, settleWeddingItem, updateWeddingItem } from "../../../../actions";

export const dynamic = "force-dynamic";

export default async function EditWeddingItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const i = await prisma.weddingItem.findUnique({ where: { id } });
  if (!i) notFound();
  const done = i.budget > 0 && i.paid >= i.budget;
  return (
    <main className="space-y-6">
      <WriteHeader back="/wedding/budget" backLabel="예산" title="예산 항목 수정" />
      <form action={updateWeddingItem} className="card space-y-4">
        <input type="hidden" name="id" value={i.id} />
        <WeddingItemFields initial={{ ...i, dueDate: i.dueDate ? toKst(i.dueDate).toISOString().slice(0, 10) : "" }} />
        <SubmitButton pendingText="저장 중…" className="w-full">저장</SubmitButton>
      </form>
      <div className="flex justify-center gap-2">
        {!done && i.budget > 0 && (
          <form action={settleWeddingItem.bind(null, i.id)}>
            <SubmitButton base="btn-ghost" pendingText="…">남은 돈 다 냈어요</SubmitButton>
          </form>
        )}
        <form action={deleteWeddingItem.bind(null, i.id)}>
          <SubmitButton base="btn-ghost" className="!text-spend" pendingText="지우는 중…">이 항목 삭제</SubmitButton>
        </form>
      </div>
    </main>
  );
}
