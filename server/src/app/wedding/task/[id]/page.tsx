import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { toKst } from "@/lib/time";
import { SubmitButton } from "@/components/SubmitButton";
import { WriteHeader } from "@/components/WriteHeader";
import { deleteTask, updateTask } from "../../../actions";

export const dynamic = "force-dynamic";

const dateInput = (d: Date | null) => (d ? toKst(d).toISOString().slice(0, 10) : "");

export default async function EditWeddingTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await prisma.weddingTask.findUnique({ where: { id }, include: { step: { select: { id: true, title: true } } } });
  if (!t) notFound();
  return (
    <main className="space-y-6">
      <WriteHeader back={`/wedding/event/${t.step.id}`} backLabel={t.step.title} title="할 일 수정" />
      <form action={updateTask} className="card space-y-4">
        <input type="hidden" name="id" value={t.id} />
        <label className="block space-y-1">
          <span className="label">할 일</span>
          <input name="content" defaultValue={t.content} required maxLength={200} className="input" />
        </label>
        <label className="block space-y-1">
          <span className="label">날짜</span>
          <input name="dueDate" type="date" defaultValue={dateInput(t.dueDate)} className="input" />
        </label>
        <SubmitButton pendingText="저장 중…" className="w-full">저장</SubmitButton>
      </form>
      <form action={deleteTask.bind(null, t.id)} className="text-center">
        <SubmitButton base="btn-ghost" className="!text-spend" pendingText="지우는 중…">이 할 일 삭제</SubmitButton>
      </form>
    </main>
  );
}
