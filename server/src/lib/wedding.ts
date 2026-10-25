import { prisma } from "./db";
import { DAY } from "./time";

export const WEDDING_GROUPS = ["예식", "스드메", "예물·예단", "신혼여행", "신혼집·혼수", "기타"] as const;

/** 처음 시작할 때 채워넣는 흔한 항목. 예산은 비워둠(0 = 미정) */
export const WEDDING_TEMPLATE: { name: string; group: (typeof WEDDING_GROUPS)[number] }[] = [
  { name: "예식장 (대관·식대)", group: "예식" },
  { name: "청첩장·모바일 청첩장", group: "예식" },
  { name: "스튜디오·드레스·메이크업", group: "스드메" },
  { name: "본식 스냅·영상", group: "스드메" },
  { name: "예물", group: "예물·예단" },
  { name: "예단·한복", group: "예물·예단" },
  { name: "신혼여행", group: "신혼여행" },
  { name: "가전", group: "신혼집·혼수" },
  { name: "가구", group: "신혼집·혼수" },
  { name: "신혼집 (보증금·이사)", group: "신혼집·혼수" },
];

/** 자동완성용: 템플릿 외에 자주 나오는 항목명 */
export const WEDDING_SUGGESTIONS = [
  ...WEDDING_TEMPLATE.map((t) => t.name),
  "상견례",
  "웨딩슈즈",
  "부케",
  "사회·축가 사례",
  "폐백",
  "답례품",
  "헤어·메이크업 (혼주)",
  "웨딩카",
];

export async function weddingOverview(now = new Date()) {
  const items = await prisma.weddingItem.findMany({ orderBy: [{ createdAt: "asc" }] });
  const budget = items.reduce((s, i) => s + i.budget, 0);
  const paid = items.reduce((s, i) => s + i.paid, 0);
  const remaining = items.reduce((s, i) => s + Math.max(0, i.budget - i.paid), 0);
  const undecided = items.filter((i) => i.budget === 0).length;
  // 날짜 잡힌 것 중 아직 덜 낸 것. 지난 날짜도 안 냈으면 '밀림'으로 보여줌
  const upcoming = items
    .filter((i) => i.dueDate && i.budget > i.paid)
    .map((i) => ({
      ...i,
      due: i.budget - i.paid,
      daysUntil: Math.ceil((i.dueDate!.getTime() - now.getTime()) / DAY),
    }))
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime());
  return { items, budget, paid, remaining, undecided, upcoming };
}

export const dueLabel = (days: number) => (days < 0 ? `${-days}일 지남` : days === 0 ? "오늘" : `D-${days}`);

/** 올해면 '11월 15일', 다른 해면 '2027년 8월 21일' */
export function dueDateLabel(d: Date, now = new Date()) {
  const k = new Date(d.getTime() + 9 * 3600_000);
  const y = new Date(now.getTime() + 9 * 3600_000).getUTCFullYear();
  const md = `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일`;
  return k.getUTCFullYear() === y ? md : `${k.getUTCFullYear()}년 ${md}`;
}
