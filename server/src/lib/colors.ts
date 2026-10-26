// 채도 중간 톤으로 맞춘 카테고리 팔레트 (라이트/다크 둘 다에서 읽히는 값)
export const CATEGORY_COLORS: Record<string, string> = {
  식비: "#e08a2c",
  배달: "#e5544b",
  카페: "#9a6b4b",
  편의점: "#cfa125",
  마트: "#4f9a5a",
  쇼핑: "#c4508f",
  교통: "#2f86c4",
  구독: "#7a5bd0",
  통신: "#56789e",
  의료: "#23a094",
  "술/유흥": "#b23a5e",
  여가: "#3ab0d6",
  생활: "#8a94a3",
  결혼준비: "#5b6ee0",
  경조사: "#a1824f",
  기타: "#aab2bd",
  환불: "#1f5fd1",
  저축: "#1f5fd1",
};

export const colorOf = (c: string) => CATEGORY_COLORS[c] ?? "#aab2bd";

// 목록 아이콘. 글자 두 개보다 한눈에 들어옴
const CATEGORY_EMOJI: Record<string, string> = {
  식비: "🍚",
  배달: "🛵",
  카페: "☕️",
  편의점: "🏪",
  마트: "🛒",
  쇼핑: "🛍️",
  교통: "🚇",
  구독: "📺",
  통신: "📱",
  의료: "💊",
  "술/유흥": "🍺",
  여가: "🎬",
  생활: "🧺",
  결혼준비: "💍",
  경조사: "🎁",
  저축: "🏦",
  급여: "💰",
  부수입: "💵",
  이체: "🔁",
  환불: "↩️",
  기타수입: "💵",
};

export const emojiOf = (c: string) => CATEGORY_EMOJI[c] ?? "💳";
