"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { normalizeMerchant } from "@/lib/parser";
import { generateWeeklyFeedback } from "@/lib/feedback";
import { WEDDING_GROUPS, WEDDING_TEMPLATE, weddingOverview } from "@/lib/wedding";
import { categorizeByRules, SAVINGS_CATEGORY, statusForCategory } from "@/lib/categories";

function refresh() {
  for (const p of ["/", "/transactions", "/wedding", "/patterns", "/feedback", "/settings"]) revalidatePath(p);
}

/** 카테고리/가맹점/상태 수정. learn=on이면 같은 가맹점 과거·미래 건 모두 이 카테고리로 */
export async function updateTransaction(form: FormData) {
  const id = String(form.get("id"));
  const category = form.get("category") ? String(form.get("category")) : undefined;
  const merchant = form.get("merchant") ? String(form.get("merchant")).trim() : undefined;
  const status = form.get("status") ? String(form.get("status")) : undefined;
  const learn = form.get("learn") === "on";

  const nextStatus = status ?? (category || merchant ? "CONFIRMED" : undefined);
  const tx = await prisma.transaction.update({
    where: { id },
    data: { category, merchant, status: category && nextStatus ? statusForCategory(category, nextStatus) : nextStatus },
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
    if (category !== SAVINGS_CATEGORY) {
      // 전에 '저축'으로 학습돼서 집계 제외됐던 건은 다시 집계에 포함
      await prisma.transaction.updateMany({
        where: { id: { in: ids }, category: SAVINGS_CATEGORY, status: "IGNORED" },
        data: { status: "CONFIRMED" },
      });
    }
    await prisma.transaction.updateMany({
      where: { id: { in: ids } },
      data: category === SAVINGS_CATEGORY ? { category, status: "IGNORED" } : { category },
    });
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
    data: {
      type,
      amount,
      merchant,
      category,
      occurredAt,
      source: "MANUAL",
      status: statusForCategory(category, "CONFIRMED"),
      memo: String(form.get("memo") || "") || null,
    },
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

// ── 결혼 예산표 ──────────────────────────────────────────

const won = (v: FormDataEntryValue | null) => Math.round(Number(String(v ?? "").replace(/[^\d]/g, "")) || 0);
const dateOrNull = (v: FormDataEntryValue | null) => (v ? new Date(`${v}T09:00:00+09:00`) : null);
const groupOf = (v: FormDataEntryValue | null) =>
  (WEDDING_GROUPS as readonly string[]).includes(String(v)) ? String(v) : "기타";

export async function addWeddingItem(form: FormData) {
  const name = String(form.get("name") || "").trim();
  if (!name) return;
  await prisma.weddingItem.create({
    data: {
      name,
      group: groupOf(form.get("group")),
      budget: won(form.get("budget")),
      paid: won(form.get("paid")),
      dueDate: dateOrNull(form.get("dueDate")),
    },
  });
  refresh();
}

export async function updateWeddingItem(form: FormData) {
  const id = String(form.get("id"));
  await prisma.weddingItem.update({
    where: { id },
    data: {
      name: String(form.get("name") || "").trim() || undefined,
      group: groupOf(form.get("group")),
      budget: won(form.get("budget")),
      paid: won(form.get("paid")),
      dueDate: dateOrNull(form.get("dueDate")),
      memo: String(form.get("memo") || "").trim() || null,
    },
  });
  refresh();
}

/** 남은 돈 전부 냄 */
export async function settleWeddingItem(id: string) {
  const item = await prisma.weddingItem.findUnique({ where: { id } });
  if (item) await prisma.weddingItem.update({ where: { id }, data: { paid: Math.max(item.paid, item.budget) } });
  refresh();
}

export async function deleteWeddingItem(id: string) {
  await prisma.weddingItem.delete({ where: { id } });
  refresh();
}

export async function addWeddingTemplate() {
  if ((await prisma.weddingItem.count()) > 0) return;
  await prisma.weddingItem.createMany({ data: WEDDING_TEMPLATE.map((t) => ({ ...t })) });
  refresh();
}

/** 목표 금액을 예산표 합계로 맞춤 */
export async function alignGoalToBudget() {
  const { budget } = await weddingOverview();
  if (budget > 0) await prisma.goal.update({ where: { id: 1 }, data: { targetAmount: budget } }).catch(() => {});
  refresh();
}
