import { prisma } from "./db";
import { askClaude } from "./llm";
import { normalizeMerchant } from "./parser";

export const EXPENSE_CATEGORIES = [
  "식비",
  "배달",
  "카페",
  "편의점",
  "마트",
  "쇼핑",
  "교통",
  "구독",
  "통신",
  "의료",
  "술/유흥",
  "여가",
  "생활",
  "결혼준비",
  "경조사",
  "기타",
] as const;

export const INCOME_CATEGORIES = ["급여", "부수입", "이체", "환불", "기타수입"] as const;

const RULES: [RegExp, string][] = [
  [/웨딩|스드메|예식|드레스|스튜디오|예물|청첩장|반지|본식|신혼여행|허니문/i, "결혼준비"],
  [/배달의민족|배민|요기요|쿠팡이츠|땡겨요/i, "배달"],
  [/스타벅스|투썸|이디야|메가.?커피|메가엠지씨|컴포즈|빽다방|폴바셋|블루보틀|할리스|커피빈|공차|카페|커피|베이커리|파리바게뜨|뚜레쥬르|던킨|배스킨/i, "카페"],
  [/GS25|지에스25|CU|씨유|세븐일레븐|이마트24|미니스톱|편의점/i, "편의점"],
  [/이마트|홈플러스|롯데마트|코스트코|노브랜드|트레이더스|하나로마트|농협.*마트|컬리|마켓컬리|식자재/i, "마트"],
  [/넷플릭스|NETFLIX|유튜브|YOUTUBE|스포티파이|SPOTIFY|디즈니|DISNEY|티빙|TVING|웨이브|WAVVE|쿠팡플레이|왓챠|멜론|지니뮤직|APPLE\.COM|애플|GOOGLE\s?\*|구글플레이|CHATGPT|OPENAI|ANTHROPIC|CLAUDE|노션|NOTION|GITHUB|와우멤버십|네이버플러스/i, "구독"],
  [/SKT|SK텔레콤|KT\b|케이티|LG유플러스|LGU|유플러스|알뜰폰|헬로모바일/i, "통신"],
  [/택시|카카오T|카카오모빌리티|티머니|코레일|SRT|고속버스|버스|지하철|주유|GS칼텍스|SK에너지|S-OIL|에쓰오일|현대오일뱅크|주차|하이패스|쏘카|그린카|타다/i, "교통"],
  [/병원|의원|약국|치과|한의원|안과|피부과|정형외과|내과|이비인후과/i, "의료"],
  [/포차|호프|주점|이자카야|와인바|펍|PUB|BAR\b|칵테일|맥주|술집|노래|클럽/i, "술/유흥"],
  [/CGV|메가박스|롯데시네마|PC방|피씨방|볼링|당구|방탈출|야놀자|여기어때|에어비앤비|호텔|티켓|인터파크|예스24|교보문고/i, "여가"],
  [/관리비|전기|가스|수도|도시가스|한국전력|보험|월세|다이소|세탁|미용실|헤어/i, "생활"],
  [/쿠팡|11번가|G마켓|지마켓|옥션|무신사|29CM|W컨셉|SSG|신세계|롯데온|올리브영|에이블리|지그재그|알리|테무|TEMU|ALIEXPRESS|네이버페이|스마트스토어|백화점|아울렛|유니클로|자라|ZARA/i, "쇼핑"],
  [/축의|부의|조의|경조/i, "경조사"],
  [/식당|김밥|분식|국밥|치킨|피자|버거|맥도날드|롯데리아|KFC|맘스터치|서브웨이|돈까스|라멘|초밥|스시|고기|갈비|삼겹|족발|보쌈|중국집|짜장|마라|쌀국수|샤브|한식|양식|일식|떡볶이|도시락|본죽|푸드/i, "식비"],
];

export function categorizeByRules(merchant: string, type: "EXPENSE" | "INCOME", rawText = ""): string {
  if (type === "INCOME") {
    if (/급여|월급|상여|성과급/.test(rawText + merchant)) return "급여";
    if (/환불|취소|환급/.test(rawText + merchant)) return "환불";
    return "이체";
  }
  for (const [re, cat] of RULES) if (re.test(merchant)) return cat;
  return "기타";
}

/** 사용자 학습 규칙 → 키워드 룰 → (키 있으면) LLM 순서로 분류 */
export async function categorize(merchant: string, type: "EXPENSE" | "INCOME", rawText = ""): Promise<string> {
  const rule = await prisma.merchantRule.findUnique({ where: { merchant: normalizeMerchant(merchant) } });
  if (rule) return rule.category;

  const byRule = categorizeByRules(merchant, type, rawText);
  if (byRule !== "기타" || type === "INCOME" || merchant === "알 수 없음") return byRule;

  const llm = await askClaude({
    system:
      "너는 한국 카드 결제 가맹점명을 가계부 카테고리로 분류한다. 반드시 주어진 목록 중 하나의 단어만 출력한다.",
    user: `카테고리 목록: ${EXPENSE_CATEGORIES.join(", ")}\n가맹점명: ${merchant}\n정답 카테고리:`,
    maxTokens: 10,
  });
  const picked = EXPENSE_CATEGORIES.find((c) => llm?.trim().startsWith(c));
  if (picked && picked !== "기타") {
    await prisma.merchantRule
      .create({ data: { merchant: normalizeMerchant(merchant), category: picked, source: "LLM" } })
      .catch(() => {});
    return picked;
  }
  return "기타";
}
