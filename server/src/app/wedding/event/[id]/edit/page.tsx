import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { toKst } from "@/lib/time";
import { SubmitButton } from "@/components/SubmitButton";
import { WriteHeader } from "@/components/WriteHeader";
import { deleteWeddingStep, updateStep } from "../../../../actions";

export const dynamic = "force-dynamic";

const dateInput = (d: Date | null) => (d ? toKst(d).toISOString().slice(0, 10) : "");

export default async function EditWeddingEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await prisma.weddingStep.findUnique({ where: { id } });
  if (!s) notFound();
  return (
    <main className="space-y-6">
      <WriteHeader back={`/wedding/event/${s.id}`} backLabel={s.title} title="이벤트 수정" />
      <form action={updateStep} className="card space-y-4">
        <input type="hidden" name="id" value={s.id} />
        <label className="block space-y-1">
          <span className="label">이름</span>
          <input name="title" defaultValue={s.title} required maxLength={100} className="input" />
        </label>
        <label className="block space-y-1">
          <span className="label">날짜</span>
          <input name="targetDate" type="date" defaultValue={dateInput(s.targetDate)} className="input" />
        </label>
        <SubmitButton pendingText="저장 중…" className="w-full">저장</SubmitButton>
      </form>
      <form action={deleteWeddingStep.bind(null, s.id)} className="text-center">
        <SubmitButton base="btn-ghost" className="!text-spend" pendingText="지우는 중…">이 이벤트 삭제</SubmitButton>
        <p className="mt-1.5 text-[12px] text-sub">체크리스트도 같이 지워져요. 결제 기록은 예산 탭에 남아요</p>
      </form>
    </main>
  );
}
