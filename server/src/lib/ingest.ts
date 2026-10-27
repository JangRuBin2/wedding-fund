import { createHash } from "node:crypto";
import { prisma } from "./db";
import { Prisma } from "../generated/prisma/client";
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

type Tx = Prisma.TransactionClient;

const DUP_WINDOW_MS = 3 * 60 * 1000;
/** 알림 처리 전체를 직렬화하는 advisory lock 키 (푸시+문자가 동시에 와도 중복 판정이 꼬이지 않게) */
const INGEST_LOCK = 482_901;

export async function ingestNotification(input: IngestInput): Promise<IngestResult> {
  // 분류(Gemini 호출 가능)는 잠금 밖에서 미리 해서 잠금을 짧게 유지
  const parsed = parseNotification(input);
  const category = parsed
    ? parsed.cancelled
      ? "환불"
      : await categorize(parsed.merchant, parsed.type, `${input.title} ${input.text}`)
    : null;

  let res: IngestResult;
  try {
    res = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${INGEST_LOCK})`;
        return ingestLocked(tx, input, parsed, category);
      },
      { maxWait: 20_000, timeout: 20_000 },
    );
  } catch (e) {
    // 같은 알림이 동시에 두 번 들어와 hash unique 제약에 걸린 경우
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { result: "ALREADY_SEEN" };
    throw e;
  }

  // 결혼준비 결제(계약금·잔금)나 적금 이체, 확인 필요 건으로는 잔소리하지 않음
  if (res.result === "PARSED" && parsed?.type === "EXPENSE" && !parsed.cancelled && res.status === "CONFIRMED" &&
      category !== WEDDING_CATEGORY && category !== SAVINGS_CATEGORY) {
    res.nudge = await buildNudge(parsed.amount, parsed.merchant);
  }
  return res;
}

async function ingestLocked(
  tx: Tx,
  input: IngestInput,
  parsed: ReturnType<typeof parseNotification>,
  category: string | null,
): Promise<IngestResult> {
  const postedAt = new Date(input.postedAt || Date.now());
  // 같은 알림이 업데이트되며 여러 번 오는 경우 방지 (분 단위 버킷)
  const hash = createHash("sha256")
    .update([input.packageName, input.title, input.text, Math.floor(postedAt.getTime() / 60000)].join("|"))
    .digest("hex");
  if (await tx.rawNotification.findUnique({ where: { hash } })) return { result: "ALREADY_SEEN" };

  const raw = await tx.rawNotification.create({
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

  if (!parsed || !category) return { result: "SKIPPED" };

  const member = input.memberName
    ? await tx.member.upsert({ where: { name: input.memberName }, create: { name: input.memberName }, update: {} })
    : null;
  const window = {
    gte: new Date(postedAt.getTime() - DUP_WINDOW_MS),
    lte: new Date(postedAt.getTime() + DUP_WINDOW_MS),
  };
  const key = normalizeMerchant(parsed.merchant);
  const similar = (m: string) => {
    const k = normalizeMerchant(m);
    return !!k && !!key && (k === key || k.includes(key) || key.includes(k));
  };

  let type = parsed.type;
  let confidence = parsed.confidence;
  if (parsed.cancelled) {
    // 같은 취소가 푸시+문자로 두 번 온 경우: 방금 취소 처리한 같은 금액 결제가 있으면 중복
    const recentCancel = await tx.rawNotification.findFirst({
      where: {
        result: "CANCEL_MATCHED",
        postedAt: window,
        transaction: { amount: parsed.amount, memberId: member?.id ?? null },
      },
    });
    if (recentCancel) {
      await tx.rawNotification.update({
        where: { id: raw.id },
        data: { result: "DUPLICATE", transactionId: recentCancel.transactionId },
      });
      return { result: "DUPLICATE", transactionId: recentCancel.transactionId ?? undefined };
    }

    // 최근 30일 내 같은 금액·같은 가맹점 결제를 찾아 취소 처리
    const candidates = await tx.transaction.findMany({
      where: {
        type: "EXPENSE",
        amount: parsed.amount,
        cancelled: false,
        occurredAt: { gte: new Date(postedAt.getTime() - 30 * DAY), lte: postedAt },
      },
      orderBy: { occurredAt: "desc" },
    });
    // 가맹점을 못 읽은 취소는 후보가 딱 하나일 때만 연결 (엉뚱한 결제를 취소하지 않게)
    const original =
      candidates.find((c) => similar(c.merchant)) ??
      (parsed.confidence === "LOW" && candidates.length === 1 ? candidates[0] : undefined);
    if (original) {
      await tx.transaction.update({ where: { id: original.id }, data: { cancelled: true } });
      await tx.rawNotification.update({
        where: { id: raw.id },
        data: { result: "CANCEL_MATCHED", transactionId: original.id },
      });
      return { result: "CANCEL_MATCHED", transactionId: original.id };
    }
    // 원 결제를 못 찾으면 환불 수입으로 기록하고 확인 필요로
    type = "INCOME";
    confidence = "LOW";
  }

  // 같은 결제가 카드앱 푸시 + 문자로 중복 수신된 경우.
  // 같은 사람(폰)에서 온 것만 비교해서, 둘이 비슷한 시간에 같은 금액을 쓴 걸 합치지 않음
  const candidates = await tx.transaction.findMany({
    where: { type, amount: parsed.amount, source: "NOTIFICATION", memberId: member?.id ?? null, occurredAt: window },
  });
  // 같은 카드사인데 가맹점이 확실히 다르면 별개의 결제 (같은 카드로 같은 금액을 연달아 결제)
  const dup = candidates.find(
    (d) => !(confidence === "HIGH" && d.status !== "REVIEW" && d.issuer && d.issuer === parsed.issuer && !similar(d.merchant)),
  );
  if (dup) {
    // 기존 건이 애매했고 이번 게 더 확실하면 가맹점 정보 보강
    if (dup.status === "REVIEW" && confidence === "HIGH") {
      await tx.transaction.update({
        where: { id: dup.id },
        data: {
          merchant: parsed.merchant,
          issuer: parsed.issuer ?? dup.issuer,
          status: statusForCategory(category, "CONFIRMED"),
          category,
        },
      });
    }
    await tx.rawNotification.update({ where: { id: raw.id }, data: { result: "DUPLICATE", transactionId: dup.id } });
    return { result: "DUPLICATE", transactionId: dup.id };
  }

  const created = await tx.transaction.create({
    data: {
      type,
      amount: parsed.amount,
      merchant: parsed.merchant,
      category,
      issuer: parsed.issuer,
      occurredAt: postedAt,
      source: "NOTIFICATION",
      status: statusForCategory(category, confidence === "HIGH" ? "CONFIRMED" : "REVIEW"),
      memberId: member?.id,
    },
  });
  await tx.rawNotification.update({ where: { id: raw.id }, data: { result: "PARSED", transactionId: created.id } });
  return { result: "PARSED", transactionId: created.id, status: created.status };
}
