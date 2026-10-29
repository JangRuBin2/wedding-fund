import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { SubmitButton } from "@/components/SubmitButton";
import { WriteHeader } from "@/components/WriteHeader";
import { saveStepMemo } from "../../../../actions";

export const dynamic = "force-dynamic";

export default async function WeddingEventMemoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await prisma.weddingStep.findUnique({ where: { id }, select: { id: true, title: true, note: true } });
  if (!s) notFound();
  return (
    <main className="space-y-6">
      <WriteHeader back={`/wedding/event/${s.id}`} backLabel={s.title} title={s.note ? "메모 수정" : "메모 쓰기"} />
      <form action={saveStepMemo} className="card space-y-4">
        <input type="hidden" name="id" value={s.id} />
        <textarea
          name="note"
          defaultValue={s.note ?? ""}
          rows={10}
          autoFocus
          maxLength={5000}
          placeholder="예: 머리 시안 어떻게 하지? 업체에 물어볼 것"
          className="input resize-y text-[15px] leading-relaxed"
        />
        <SubmitButton pendingText="저장 중…" className="w-full">저장</SubmitButton>
      </form>
    </main>
  );
}
