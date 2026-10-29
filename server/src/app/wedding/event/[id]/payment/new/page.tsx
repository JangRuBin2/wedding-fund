import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { toKst } from "@/lib/time";
import { SubmitButton } from "@/components/SubmitButton";
import { WriteHeader } from "@/components/WriteHeader";
import { PaymentFields } from "@/components/PaymentFields";
import { addPayment } from "../../../../../actions";

export const dynamic = "force-dynamic";

export default async function NewWeddingPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await prisma.weddingStep.findUnique({
    where: { id },
    select: { id: true, title: true, payments: { select: { category: true }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!s) notFound();
  return (
    <main className="space-y-6">
      <WriteHeader back={`/wedding/event/${s.id}`} backLabel={s.title} title="결제 추가" sub="낼 예정인 돈은 결제 방식을 '결제 예정'으로 골라 주세요" />
      <form action={addPayment} className="card space-y-4">
        <input type="hidden" name="stepId" value={s.id} />
        <PaymentFields
          initial={{
            category: s.payments[0]?.category ?? "기타",
            content: "",
            amount: 0,
            method: "CARD",
            payer: "GROOM",
            payerNote: null,
            paidAt: toKst(new Date()).toISOString().slice(0, 10),
          }}
        />
        <SubmitButton pendingText="저장 중…" className="w-full">저장</SubmitButton>
      </form>
    </main>
  );
}
