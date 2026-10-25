"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { normalizeMerchant } from "@/lib/parser";
import { generateWeeklyFeedback } from "@/lib/feedback";
import { categorizeByRules } from "@/lib/categories";

function refresh() {
  for (const p of ["/", "/transactions", "/patterns", "/feedback", "/settings"]) revalidatePath(p);
}

/** 카테고리/가맹점/상태 수정. learn=on이면 같은 가맹점 과거·미래 건 모두 이 카테고리로 */
export async function updateTransaction(form: FormData) {
  const id = String(form.get("id"));
  const category = form.get("category") ? String(form.get("category")) : undefined;
  const merchant = form.get("merchant") ? String(form.get("merchant")).trim() : undefined;
  const status = form.get("status") ? String(form.get("status")) : undefined;
  const learn = form.get("learn") === "on";

  const tx = await prisma.transaction.update({
    where: { id },
    data: { category, merchant, status: status ?? (category || merchant ? "CONFIRMED" : undefined) },
  });

  if (learn && category) {
    const key = normalizeMerchant(tx.merchant);
    await prisma.merchantRule.upsert({
      where: { merchant: key },
      create: { merchant: key, category, source: "USER" },
      update: { category, source: "USER" },
    });
    const same = await prisma.transaction.findMany({ where: { type: tx.type }, select: { id: true, merchant: true } });
    const ids = same.filter((t) => normalizeMerchant(t.merchant) === key).map((t) => t.id);
    await prisma.transaction.updateMany({ where: { id: { in: ids } }, data: { category } });
  }
  refresh();
}

export async function setStatus(id: string, status: "CONFIRMED" | "IGNORED") {
  await prisma.transaction.update({ where: { id }, data: { status } });
  refresh();
}

export async function deleteTransaction(id: string) {
  await prisma.rawNotification.updateMany({ where: { transactionId: id }, data: { transactionId: null } });
  await prisma.transaction.delete({ where: { id } });
  refresh();
}

/** 현금 지출, 알림 안 오는 수입(월급 등) 수동 입력 */
export async function addManual(form: FormData) {
  const type = form.get("type") === "INCOME" ? "INCOME" : "EXPENSE";
  const amount = Math.round(Number(String(form.get("amount")).replace(/[^\d]/g, "")));
  const merchant = String(form.get("merchant") || (type === "INCOME" ? "수입" : "현금 지출")).trim();
  const date = String(form.get("date") || "");
  if (!amount) return;
  const occurredAt = date ? new Date(`${date}T12:00:00+09:00`) : new Date();
  const category = String(form.get("category") || "") || categorizeByRules(merchant, type);
  await prisma.transaction.create({
    data: { type, amount, merchant, category, occurredAt, source: "MANUAL", memo: String(form.get("memo") || "") || null },
  });
  refresh();
}

export async function saveGoal(form: FormData) {
  const n = (k: string) => Math.round(Number(String(form.get(k) ?? "").replace(/[^\d]/g, "")) || 0);
  const d = (k: string) => new Date(`${form.get(k)}T00:00:00+09:00`);
  const data = {
    title: String(form.get("title") || "결혼자금"),
    targetAmount: n("targetAmount"),
    startAmount: n("startAmount"),
    startDate: d("startDate"),
    targetDate: d("targetDate"),
    bigSpendThreshold: n("bigSpendThreshold") || 50000,
  };
  if (!data.targetAmount || isNaN(data.targetDate.getTime()) || isNaN(data.startDate.getTime())) return;
  await prisma.goal.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  refresh();
}

export async function generateFeedbackNow() {
  await generateWeeklyFeedback();
  refresh();
}

export async function deleteRule(id: string) {
  await prisma.merchantRule.delete({ where: { id } });
  refresh();
}
