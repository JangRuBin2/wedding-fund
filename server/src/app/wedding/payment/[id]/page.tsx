import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { toKst } from "@/lib/time";
import { SubmitButton } from "@/components/SubmitButton";
import { WriteHeader } from "@/components/WriteHeader";
import { PaymentFields } from "@/components/PaymentFields";
import { deletePayment, updatePayment } from "../../../actions";

export const dynamic = "force-dynamic";

export default async function EditWeddingPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await prisma.weddingPayment.findUnique({ where: { id }, include: { step: { select: { id: true, title: true } } } });
  if (!p) notFound();
  return (
    <main className="space-y-6">
      <WriteHeader
        back={p.step ? `/wedding/event/${p.step.id}` : "/wedding/budget"}
        backLabel={p.step?.title ?? "예산"}
        title="결제 수정"
      />
      <form action={updatePayment} className="card space-y-4">
        <input type="hidden" name="id" value={p.id} />
        <PaymentFields initial={{ ...p, paidAt: p.paidAt ? toKst(p.paidAt).toISOString().slice(0, 10) : "" }} />
        <SubmitButton pendingText="저장 중…" className="w-full">저장</SubmitButton>
      </form>
      <form action={deletePayment.bind(null, p.id)} className="text-center">
        <SubmitButton base="btn-ghost" className="!text-spend" pendingText="지우는 중…">이 결제 삭제</SubmitButton>
      </form>
    </main>
  );
}
