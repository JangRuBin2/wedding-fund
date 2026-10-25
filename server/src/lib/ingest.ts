import { createHash } from "node:crypto";
import { prisma } from "./db";
import { parseNotification, normalizeMerchant } from "./parser";
import { categorize, statusForCategory, SAVINGS_CATEGORY, WEDDING_CATEGORY } from "./categories";
import { buildNudge } from "./goal";
import { DAY } from "./time";

export type IngestInput = {
  packageName: string;
  title: string;
  text: string;
  postedAt: number; // epoch ms
  memberName?: string;
};

export type IngestResult = {
  result: "PARSED" | "DUPLICATE" | "SKIPPED" | "CANCEL_MATCHED" | "ALREADY_SEEN";
  transactionId?: string;
  status?: string;
  nudge?: string | null;
};

const DUP_WINDOW_MS = 3 * 60 * 1000;

export async function ingestNotification(input: IngestInput): Promise<IngestResult> {
  const postedAt = new Date(input.postedAt || Date.now());
  // 같은 알림이 업데이트되며 여러 번 오는 경우 방지 (분 단위 버킷)
  const hash = createHash("sha256")
    .update([input.packageName, input.title, input.text, Math.floor(postedAt.getTime() / 60000)].join("|"))
    .digest("hex");
  if (await prisma.rawNotification.findUnique({ where: { hash } })) return { result: "ALREADY_SEEN" };

  const raw = await prisma.rawNotification.create({
    data: {
      packageName: input.packageName,
      title: input.title ?? "",
      text: input.text ?? "",
      postedAt,
      hash,
      result: "SKIPPED",
      memberName: input.memberName,
    },
  });

  const parsed = parseNotification(input);
  if (!parsed) return { result: "SKIPPED" };

  const member = input.memberName
    ? await prisma.member.upsert({ where: { name: input.memberName }, create: { name: input.memberName }, update: {} })
    : null;

  // 취소: 최근 30일 내 같은 금액 결제를 찾아 취소 처리
  if (parsed.cancelled) {
    const candidates = await prisma.transaction.findMany({
      where: {
        type: "EXPENSE",
        amount: parsed.amount,
        cancelled: false,
        occurredAt: { gte: new Date(postedAt.getTime() - 30 * DAY), lte: postedAt },
      },
      orderBy: { occurredAt: "desc" },
    });
    const key = normalizeMerchant(parsed.merchant);
    const original = candidates.find((c) => normalizeMerchant(c.merchant) === key) ?? candidates[0];
    if (original) {
      await prisma.transaction.update({ where: { id: original.id }, data: { cancelled: true } });
      await prisma.rawNotification.update({
        where: { id: raw.id },
        data: { result: "CANCEL_MATCHED", transactionId: original.id },
      });
      return { result: "CANCEL_MATCHED", transactionId: original.id };
    }
    // 원 결제를 못 찾으면 환불 수입으로 기록
    parsed.type = "INCOME";
  }

  // 같은 결제가 카드앱 푸시 + 문자로 중복 수신된 경우
  const dup = await prisma.transaction.findFirst({
    where: {
      type: parsed.type,
      amount: parsed.amount,
      source: "NOTIFICATION",
      occurredAt: {
        gte: new Date(postedAt.getTime() - DUP_WINDOW_MS),
        lte: new Date(postedAt.getTime() + DUP_WINDOW_MS),
      },
    },
  });
  if (dup) {
    // 기존 건이 애매했고 이번 게 더 확실하면 가맹점 정보 보강
    if (dup.status === "REVIEW" && parsed.confidence === "HIGH") {
      const category = await categorize(parsed.merchant, parsed.type, input.text);
      await prisma.transaction.update({
        where: { id: dup.id },
        data: {
          merchant: parsed.merchant,
          issuer: parsed.issuer ?? dup.issuer,
          status: statusForCategory(category, "CONFIRMED"),
          category,
        },
      });
    }
    await prisma.rawNotification.update({ where: { id: raw.id }, data: { result: "DUPLICATE", transactionId: dup.id } });
    return { result: "DUPLICATE", transactionId: dup.id };
  }

  const category = parsed.cancelled ? "환불" : await categorize(parsed.merchant, parsed.type, `${input.title} ${input.text}`);
  const tx = await prisma.transaction.create({
    data: {
      type: parsed.type,
      amount: parsed.amount,
      merchant: parsed.merchant,
      category,
      issuer: parsed.issuer,
      occurredAt: postedAt,
      source: "NOTIFICATION",
      status: statusForCategory(category, parsed.confidence === "HIGH" ? "CONFIRMED" : "REVIEW"),
      memberId: member?.id,
    },
  });
  await prisma.rawNotification.update({ where: { id: raw.id }, data: { result: "PARSED", transactionId: tx.id } });

  // 결혼준비 결제(계약금·잔금)나 적금 이체로 잔소리하지 않음
  const nudge =
    tx.type === "EXPENSE" && tx.category !== WEDDING_CATEGORY && tx.category !== SAVINGS_CATEGORY
      ? await buildNudge(tx.amount, tx.merchant)
      : null;
  return { result: "PARSED", transactionId: tx.id, status: tx.status, nudge };
}
