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
};

export const colorOf = (c: string) => CATEGORY_COLORS[c] ?? "#aab2bd";
