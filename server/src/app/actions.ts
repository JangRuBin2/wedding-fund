"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { normalizeMerchant } from "@/lib/parser";
import { generateWeeklyFeedback } from "@/lib/feedback";
import { WEDDING_GROUPS, WEDDING_TEMPLATE, weddingOverview } from "@/lib/wedding";
import { SUGGESTED_TASKS, WEDDING_STEPS } from "@/lib/checklist";
import { PAY_METHODS, PAYERS, WEDDING_CATEGORIES } from "@/lib/wedding-meta";
import { currentSession, getMe, ME_COOKIE } from "@/lib/me";
import { cookies } from "next/headers";
import { assertMine } from "@/lib/ownership";
import { safeBack } from "@/lib/back";
import { categorizeByRules, SAVINGS_CATEGORY, statusForCategory } from "@/lib/categories";

function refresh() {
  for (const p of ["/", "/patterns", "/feedback", "/settings"]) revalidatePath(p);
  revalidatePath("/transactions", "layout"); // 목록과 직접 입력·고치기 화면
  revalidatePath("/wedding", "layout"); // 할 일·예산·이벤트 세부 전부
}

/** 작성 화면에서 저장한 뒤 보던 화면으로 (폼의 back 값, 없으면 fallback) */
function goBack(form: FormData, fallback: string): never {
  redirect(safeBack(form.get("back"), fallback));
}

/** 카테고리/가맹점/상태 수정. learn=on이면 같은 가맹점 과거·미래 건 모두 이 카테고리로 */
export async function updateTransaction(form: FormData) {
  const id = String(form.get("id"));
  if (!(await assertMine(id))) return;
  const category = form.get("category") ? String(form.get("category")) : undefined;
  const merchant = form.get("merchant") ? String(form.get("merchant")).trim() : undefined;
  const status = form.get("status") ? String(form.get("status")) : undefined;
  const learn = form.get("learn") === "on";

  const nextStatus = status ?? (category || merchant ? "CONFIRMED" : undefined);
  const tx = await prisma.transaction.update({
    where: { id },
    data: { category, merchant, status: category && nextStatus ? statusForCategory(category, nextStatus) : nextStatus },
  });

  if (learn && category) await learnCategory(tx, category);
  refresh();
  goBack(form, "/transactions");
}

/** 같은 가맹점 규칙 저장 + 과거 건까지 일괄 적용 */
async function learnCategory(tx: { type: string; merchant: string }, category: string) {
  // 가맹점을 못 읽은 건끼리 묶여서 전부 같은 카테고리로 바뀌지 않게
  if (["알 수 없음", "입금", "수입", "현금 지출"].includes(tx.merchant.trim())) return;
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

/** 확인할 결제 스와이프: 오른쪽 = 저장(확정), 왼쪽 = 삭제. 카테고리를 바꿨으면 같은 가맹점에도 학습 */
export async function reviewDecision(id: string, decision: "keep" | "delete", category?: string) {
  const tx = await assertMine(id);
  if (!tx) return;
  if (decision === "delete") {
    await prisma.rawNotification.updateMany({ where: { transactionId: id }, data: { transactionId: null } });
    await prisma.transaction.delete({ where: { id } });
  } else {
    const next = category ?? tx.category;
    await prisma.transaction.update({ where: { id }, data: { category: next, status: statusForCategory(next, "CONFIRMED") } });
    if (category && category !== tx.category) await learnCategory(tx, category);
  }
  refresh();
}

export async function setStatus(id: string, status: "CONFIRMED" | "IGNORED") {
  if (!(await assertMine(id))) return;
  await prisma.transaction.update({ where: { id }, data: { status } });
  refresh();
}

export async function deleteTransaction(id: string, back?: string) {
  if (!(await assertMine(id))) return;
  await prisma.rawNotification.updateMany({ where: { transactionId: id }, data: { transactionId: null } });
  await prisma.transaction.delete({ where: { id } });
  refresh();
  redirect(safeBack(back, "/transactions"));
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
  // 누가 쓴 돈인지 (기본은 나). 그 사람 결제로 남아서 그 사람만 고칠 수 있음
  const who = String(form.get("member") || (await getMe()) || "").trim().slice(0, 30);
  const member = who ? await prisma.member.upsert({ where: { name: who }, create: { name: who }, update: {} }) : null;
  await prisma.transaction.create({
    data: {
      memberId: member?.id ?? null,
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
  goBack(form, "/transactions");
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
  redirect("/wedding/budget");
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
  redirect("/wedding/budget");
}

/** 남은 돈 전부 냄 */
export async function settleWeddingItem(id: string) {
  const item = await prisma.weddingItem.findUnique({ where: { id } });
  if (item) await prisma.weddingItem.update({ where: { id }, data: { paid: Math.max(item.paid, item.budget) } });
  refresh();
  redirect("/wedding/budget");
}

export async function deleteWeddingItem(id: string) {
  await prisma.weddingItem.delete({ where: { id } });
  refresh();
  redirect("/wedding/budget");
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

// ── 결혼 준비 체크리스트 ──

/** 시트 순서대로 20단계 만들기. 이미 있는 단계는 건너뜀 */
export async function createWeddingSteps() {
  const have = new Set((await prisma.weddingStep.findMany({ select: { templateKey: true } })).map((s) => s.templateKey));
  const data = WEDDING_STEPS.filter((s) => !have.has(s.key)).map((s) => ({
    order: s.order,
    title: s.title,
    templateKey: s.key,
    hint: "hint" in s ? s.hint : null,
    note: "note" in s ? s.note : null,
  }));
  if (data.length) await prisma.weddingStep.createMany({ data });
  refresh();
}

/** 결혼식 날짜(목표 날짜) 기준 추천 일정을 날짜 없는 단계에만 채움 */
export async function fillStepDates() {
  const goal = await prisma.goal.findUnique({ where: { id: 1 } });
  if (!goal) return;
  const offsets = new Map<string, number>(WEDDING_STEPS.map((s) => [s.key, s.offset]));
  const steps = await prisma.weddingStep.findMany({ where: { targetDate: null, templateKey: { not: null } } });
  await prisma.$transaction(
    steps
      .filter((s) => offsets.has(s.templateKey!))
      .map((s) =>
        prisma.weddingStep.update({
          where: { id: s.id },
          data: { targetDate: new Date(goal.targetDate.getTime() + offsets.get(s.templateKey!)! * 86400_000) },
        }),
      ),
  );
  refresh();
}

export async function toggleStep(id: string) {
  const step = await prisma.weddingStep.findUnique({ where: { id } });
  if (!step) return;
  const me = await getMe();
  await prisma.weddingStep.update({
    where: { id },
    data: step.done ? { done: false, doneAt: null, doneBy: null } : { done: true, doneAt: new Date(), doneBy: me },
  });
  refresh();
}

export async function updateStep(form: FormData) {
  const id = String(form.get("id"));
  await prisma.weddingStep.update({
    where: { id },
    data: {
      title: String(form.get("title") || "").trim() || undefined,
      targetDate: dateOrNull(form.get("targetDate")),
    },
  });
  refresh();
  redirect(`/wedding/event/${id}`);
}

export async function addWeddingStep(form: FormData) {
  const title = String(form.get("title") || "").trim();
  if (!title) return;
  const last = await prisma.weddingStep.findFirst({ orderBy: { order: "desc" } });
  const step = await prisma.weddingStep.create({ data: { title, order: (last?.order ?? 0) + 1, targetDate: dateOrNull(form.get("targetDate")) } });
  refresh();
  redirect(`/wedding/event/${step.id}`); // 만든 이벤트로 가서 체크리스트·결제를 이어서 채움
}

export async function deleteWeddingStep(id: string) {
  await prisma.weddingStep.delete({ where: { id } });
  refresh();
  redirect("/wedding"); // 세부 화면에서 지웠으면 목록으로
}

export async function addTask(form: FormData) {
  const stepId = String(form.get("stepId"));
  const content = String(form.get("content") || "").trim();
  if (!content) return;
  await prisma.weddingTask.create({ data: { stepId, content, dueDate: dateOrNull(form.get("dueDate")), createdBy: await getMe() } });
  refresh();
  redirect(`/wedding/event/${stepId}`);
}

/** 그 단계의 추천 할 일 넣기. 이미 같은 내용이 있으면 건너뜀 */
export async function addSuggestedTasks(stepId: string) {
  const step = await prisma.weddingStep.findUnique({ where: { id: stepId }, include: { tasks: true } });
  if (!step?.templateKey) return;
  const have = new Set(step.tasks.map((t) => t.content));
  const me = await getMe();
  const data = SUGGESTED_TASKS.filter((t) => t.stepKey === step.templateKey && !have.has(t.content)).map((t, i) => ({
    stepId,
    section: t.section,
    content: t.content,
    createdBy: me,
    sortOrder: step.tasks.length + i,
  }));
  if (data.length) await prisma.weddingTask.createMany({ data });
  refresh();
}

export async function toggleTask(id: string) {
  const task = await prisma.weddingTask.findUnique({ where: { id } });
  if (!task) return;
  const me = await getMe();
  await prisma.weddingTask.update({
    where: { id },
    data: task.done ? { done: false, doneAt: null, doneBy: null } : { done: true, doneAt: new Date(), doneBy: me },
  });
  refresh();
}

export async function deleteTask(id: string) {
  const task = await prisma.weddingTask.delete({ where: { id } });
  refresh();
  redirect(`/wedding/event/${task.stepId}`);
}

/** 이 기기는 누구 (체크한 사람 기록용) */
export async function setMe(form: FormData) {
  const name = String(form.get("name") || "").trim().slice(0, 30);
  const jar = await cookies();
  if (name) jar.set(ME_COOKIE, encodeURIComponent(name), { maxAge: 365 * 86400, httpOnly: true, sameSite: "lax", path: "/" });
  else jar.delete(ME_COOKIE);
  refresh();
}

/** 팁 맞춤용 내 정보. 빈 값은 '모름'으로 저장 */
export async function saveProfile(form: FormData) {
  const name = String(form.get("name") || "").trim();
  if (!name) return;
  const tri = (k: string) => (form.get(k) === "yes" ? true : form.get(k) === "no" ? false : null);
  const year = Number(form.get("birthYear"));
  const housing = String(form.get("housing") || "");
  const data = {
    birthYear: year >= 1940 && year <= 2015 ? year : null,
    smallCompany: tri("smallCompany"),
    housing: ["월세", "전세", "자가", "가족과 함께"].includes(housing) ? housing : null,
    householder: tri("householder"),
    changedJobThisYear: tri("changedJobThisYear"),
    married: tri("married"),
  };
  await prisma.profile.upsert({ where: { name }, create: { name, ...data }, update: data });
  refresh();
}

// ── 이벤트 세부: 할 일 날짜, 메모, 결제관리 ──

export async function updateTask(form: FormData) {
  const task = await prisma.weddingTask.update({
    where: { id: String(form.get("id")) },
    data: {
      content: String(form.get("content") || "").trim() || undefined,
      dueDate: dateOrNull(form.get("dueDate")),
    },
  });
  refresh();
  redirect(`/wedding/event/${task.stepId}`);
}

export async function saveStepMemo(form: FormData) {
  const id = String(form.get("id"));
  await prisma.weddingStep.update({
    where: { id },
    data: { note: String(form.get("note") || "").trim().slice(0, 5000) || null },
  });
  refresh();
  redirect(`/wedding/event/${id}`);
}

const oneOf = <T extends string>(v: FormDataEntryValue | null, keys: readonly T[], fallback: T): T =>
  (keys as readonly string[]).includes(String(v)) ? (String(v) as T) : fallback;
const CATEGORY_NAMES = WEDDING_CATEGORIES.map((c) => c.name);

/** 결제 추가·수정 폼에서 공통으로 읽는 값. 내용이나 금액이 없으면 null */
function paymentFields(form: FormData) {
  const content = String(form.get("content") || "").trim();
  const amount = won(form.get("amount"));
  if (!content || !amount) return null;
  const payer = oneOf(form.get("payer"), Object.keys(PAYERS) as (keyof typeof PAYERS)[], "GROOM");
  return {
    category: oneOf(form.get("category"), CATEGORY_NAMES, "기타"),
    content: content.slice(0, 100),
    amount,
    method: oneOf(form.get("method"), Object.keys(PAY_METHODS) as (keyof typeof PAY_METHODS)[], "CARD"),
    payer,
    payerNote: payer === "OTHER" ? String(form.get("payerNote") || "").trim().slice(0, 30) || null : null,
    paidAt: dateOrNull(form.get("paidAt")),
  };
}

const paymentBack = (stepId: string | null) => (stepId ? `/wedding/event/${stepId}` : "/wedding/budget");

export async function addPayment(form: FormData) {
  const data = paymentFields(form);
  if (!data) return;
  const stepId = String(form.get("stepId") || "") || null;
  await prisma.weddingPayment.create({ data: { ...data, stepId, createdBy: await getMe() } });
  refresh();
  redirect(paymentBack(stepId));
}

export async function updatePayment(form: FormData) {
  const data = paymentFields(form);
  if (!data) return;
  const p = await prisma.weddingPayment.update({ where: { id: String(form.get("id")) }, data });
  refresh();
  redirect(paymentBack(p.stepId));
}

/** 결제 예정 → 냈어요 (카드로 표시, 날짜는 오늘) */
export async function markPaymentPaid(id: string) {
  await prisma.weddingPayment.update({ where: { id }, data: { method: "CARD", paidAt: new Date() } });
  refresh();
}

export async function deletePayment(id: string) {
  const p = await prisma.weddingPayment.delete({ where: { id } });
  refresh();
  redirect(paymentBack(p.stepId));
}

/** 예산 배분 저장 (예산 탭의 슬라이더). 금액은 원 단위 */
export async function saveBudgetPlan(alloc: Record<string, number>) {
  const ops = CATEGORY_NAMES.map((category) => {
    const amount = Math.max(0, Math.min(10_000_000_000, Math.round(Number(alloc[category]) || 0)));
    return prisma.weddingBudget.upsert({ where: { category }, create: { category, amount }, update: { amount } });
  });
  await prisma.$transaction(ops);
  refresh();
}

// ── 카카오 로그인 사용자 관리 ──

/** 관리자만. 쿠키는 위조 못 하지만 역할이 바뀌었을 수 있어서 DB로 한 번 더 확인 */
async function requireOwner() {
  const s = await currentSession();
  const me = s && (await prisma.user.findUnique({ where: { id: s.uid } }));
  if (!me || me.role !== "OWNER" || me.status !== "APPROVED") throw new Error("관리자만 할 수 있어요");
  return me;
}

export async function setUserStatus(id: string, status: "APPROVED" | "REJECTED") {
  const owner = await requireOwner();
  if (id === owner.id) return; // 자기 자신은 못 막음
  await prisma.user.update({ where: { id }, data: { status } });
  refresh();
}

/** 이름 바꾸기 (본인 또는 관리자). 폰 앱 이름과 맞추면 체크 기록·팁 맞춤이 이어짐 */
export async function renameUser(form: FormData) {
  const s = await currentSession();
  const id = String(form.get("id"));
  const name = String(form.get("name") || "").trim().slice(0, 30);
  if (!s || !name) return;
  if (id !== s.uid) await requireOwner();
  await prisma.user.update({ where: { id }, data: { name } });
  refresh();
  // 본인 이름이면 세션 쿠키도 새 이름으로
  if (id === s.uid) redirect("/api/auth/refresh");
}
