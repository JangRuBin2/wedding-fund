/**
 * 결혼 예산 구분. 예산 탭(배분·사용량)과 이벤트 결제관리에서 같은 이름·색을 씀.
 * DB에 안 닿는 상수만 둬서 클라이언트 컴포넌트에서도 import 가능
 *
 * ratio: 추천 배분 비율(%). 여자친구 시트의 최소 예산(웨딩홀 2,660만 · 스드메 316만 · 예물 300만 ·
 * 예복·한복·혼주 287만 · 신혼여행 500만 …)을 기준으로 혼수 몫을 더해 대략 잡은 값
 */
export const WEDDING_CATEGORIES = [
  { name: "예식", color: "#7b8cff", ratio: 50, hint: "웨딩홀 대관·식대, 본식 스냅, 청첩장, 사회·축가" },
  { name: "스드메", color: "#f08cbd", ratio: 8, hint: "스튜디오·드레스·메이크업과 추가금" },
  { name: "예물·예단", color: "#f5b971", ratio: 12, hint: "웨딩밴드, 예복, 한복, 혼주 메이크업" },
  { name: "신혼여행", color: "#4fc3b8", ratio: 10, hint: "항공, 숙소, 여행 경비" },
  { name: "신혼집·혼수", color: "#a78bfa", ratio: 15, hint: "가전, 가구, 이사" },
  { name: "기타", color: "#9ca3af", ratio: 5, hint: "상견례, 답례품, 그 밖의 준비" },
] as const;

export type WeddingCategory = (typeof WEDDING_CATEGORIES)[number]["name"];

export const categoryColor = (name: string) => WEDDING_CATEGORIES.find((c) => c.name === name)?.color ?? "#9ca3af";

export const PAY_METHODS = { CARD: "카드", CASH: "현금", PLANNED: "결제 예정" } as const;
export const PAYERS = { GROOM: "신랑", BRIDE: "신부", OTHER: "기타" } as const;
