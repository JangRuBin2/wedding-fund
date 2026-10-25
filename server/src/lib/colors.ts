export const CATEGORY_COLORS: Record<string, string> = {
  식비: "#d9822b",
  배달: "#c4552f",
  카페: "#8a5a3c",
  편의점: "#c9a227",
  마트: "#5b8c3a",
  쇼핑: "#b0477a",
  교통: "#3a78a8",
  구독: "#6e56b8",
  통신: "#4c6a8a",
  의료: "#2f9488",
  "술/유흥": "#a8324a",
  여가: "#3e9bc4",
  생활: "#7c7a72",
  결혼준비: "#1f6b52",
  경조사: "#9a7b4f",
  기타: "#a3a19b",
  환불: "#5cc19a",
};

export const colorOf = (c: string) => CATEGORY_COLORS[c] ?? "#a3a19b";
