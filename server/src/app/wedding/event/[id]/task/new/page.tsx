import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { SubmitButton } from "@/components/SubmitButton";
import { WriteHeader } from "@/components/WriteHeader";
import { addTask } from "../../../../../actions";

export const dynamic = "force-dynamic";

export default async function NewWeddingTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await prisma.weddingStep.findUnique({ where: { id }, select: { id: true, title: true } });
  if (!s) notFound();
  return (
    <main className="space-y-6">
      <WriteHeader back={`/wedding/event/${s.id}`} backLabel={s.title} title="할 일 추가" />
      <form action={addTask} className="card space-y-4">
        <input type="hidden" name="stepId" value={s.id} />
        <label className="block space-y-1">
          <span className="label">할 일</span>
          <input name="content" placeholder="예: 촬영용 옷 구매" required autoFocus maxLength={200} className="input" />
        </label>
        <label className="block space-y-1">
          <span className="label">날짜 (선택)</span>
          <input name="dueDate" type="date" className="input" />
          <span className="block text-[12px] text-sub">날짜를 넣으면 캘린더에도 보여요</span>
        </label>
        <SubmitButton pendingText="저장 중…" className="w-full">저장</SubmitButton>
      </form>
    </main>
  );
}
