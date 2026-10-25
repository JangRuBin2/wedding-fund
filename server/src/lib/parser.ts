/**
 * 카드사/은행 결제·입금 알림 파서.
 * 카드사 앱 푸시, 카톡 알림톡, 문자(삼성 메시지) 어디서 오든 텍스트만 보고 판단한다.
 * 파서는 서버에 있어서, 포맷이 바뀌어도 앱 재배포 없이 여기만 고치면 됨.
 */

export type ParsedNotification = {
  type: "EXPENSE" | "INCOME";
  amount: number;
  merchant: string;
  issuer: string | null;
  cancelled: boolean;
  /** HIGH면 바로 확정, LOW면 대시보드 '확인 필요'로 */
  confidence: "HIGH" | "LOW";
};

export type NotificationInput = {
  packageName: string;
  title: string;
  text: string;
};

const ISSUERS: [RegExp, string][] = [
  [/KB국민|국민카드|KB카드|KB pay|KB Pay|국민은행/i, "KB국민"],
  [/신한/, "신한"],
  [/삼성카드|삼성\d{4}|^삼성/m, "삼성"],
  [/현대카드/, "현대"],
  [/롯데카드|롯데\d{4}/, "롯데"],
  [/하나카드|하나은행|하나\d{4}/, "하나"],
  [/우리카드|우리은행|우리\d{4}/, "우리"],
  [/NH|농협/, "NH농협"],
  [/BC카드|비씨카드|BC\d{4}/i, "BC"],
  [/카카오뱅크/, "카카오뱅크"],
  [/토스뱅크|토스\s?페이|토스/, "토스"],
  [/케이뱅크/, "케이뱅크"],
  [/IBK|기업은행/, "IBK기업"],
  [/씨티/, "씨티"],
  [/네이버페이|Npay/i, "네이버페이"],
  [/카카오페이/, "카카오페이"],
];

/** 카톡/문자에서 친구 대화가 섞여 들어오는 걸 막기 위한 발신자 힌트 */
const FINANCE_SENDER = /카드|은행|뱅크|페이|pay|증권|금융|토스|BC|NH|KB|IBK/i;
const CHAT_PACKAGES = new Set(["com.kakao.talk"]);

const AMOUNT_RE = /(\d{1,3}(?:,\d{3})+|\d+)\s*원/g;
/** 이 단어 바로 뒤 금액은 결제금액이 아님 */
const NON_PAYMENT_PREFIX = /(누적|잔액|잔고|한도|가능|포인트|적립|캐시백|합계)[\s:]*$/;

const CANCEL_RE = /취소/;
const INCOME_RE = /입금|급여|이자\s*지급|환급/;
const EXPENSE_RE = /승인|결제|사용|출금|체크|일시불|할부|자동이체/;

export function parseNotification(input: NotificationInput): ParsedNotification | null {
  const title = (input.title ?? "").trim();
  const text = (input.text ?? "").trim();
  const full = `${title}\n${text}`.replace(/\[Web발신\]/g, "").trim();

  if (CHAT_PACKAGES.has(input.packageName) && !FINANCE_SENDER.test(title)) return null;

  // 거절/실패 알림은 무시
  if (/거절|실패|오류|부족/.test(full)) return null;

  const amount = findAmount(full);
  if (amount == null || amount <= 0) return null;

  const cancelled = CANCEL_RE.test(full);
  const kw = full.replace(/입출금/g, ""); // '입출금통장' 때문에 출금으로 오인하지 않게
  let type: "EXPENSE" | "INCOME";
  if (cancelled) type = "EXPENSE";
  else if (INCOME_RE.test(kw) && !/출금/.test(kw)) type = "INCOME";
  else if (EXPENSE_RE.test(kw)) type = "EXPENSE";
  else return null;

  const issuer = ISSUERS.find(([re]) => re.test(full))?.[1] ?? null;
  const { merchant, sure } = findMerchant(full, type);

  return {
    type,
    amount,
    merchant: merchant || (type === "INCOME" ? "입금" : "알 수 없음"),
    issuer,
    cancelled,
    confidence: merchant && sure ? "HIGH" : "LOW",
  };
}

function findAmount(full: string): number | null {
  for (const m of full.matchAll(AMOUNT_RE)) {
    const before = full.slice(Math.max(0, (m.index ?? 0) - 8), m.index);
    if (NON_PAYMENT_PREFIX.test(before)) continue;
    return Number(m[1].replace(/,/g, ""));
  }
  return null;
}

const TIME_RE = /\d{1,2}:\d{2}(?::\d{2})?/;
const DATE_RE = /\d{2,4}[./-]\d{1,2}(?:[./-]\d{1,2})?/g;

/** 가맹점명에서 걷어낼 토큰들 */
function clean(s: string): string {
  return s
    .replace(/(누적|잔액|잔고|한도)[\s:]*[\d,]+\s*원?.*/g, "")
    .replace(AMOUNT_RE, "")
    .replace(DATE_RE, "")
    .replace(new RegExp(TIME_RE.source, "g"), "")
    .replace(/\((일시불|\d+개월|할부)\)|일시불|\d+개월|할부/g, "")
    .replace(/[가-힣A-Za-z]\*[가-힣A-Za-z]+님?/g, "") // 마스킹된 이름 홍*동
    .replace(/\(\d{3,4}\)|\d{4}(?=승인|취소|사용)/g, "")
    .replace(/(승인|취소|결제|사용|체크|신용|완료|알림|금액|사용처|가맹점|출금|입금|자동이체)\s*:?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findMerchant(full: string, type: "EXPENSE" | "INCOME"): { merchant: string; sure: boolean } {
  // 1) "가맹점: 스타벅스" / "사용처 : 스타벅스" 같은 명시적 라벨
  const labeled = full.match(/(?:가맹점|사용처|결제처|상호)\s*[:：]\s*([^\n]+)/);
  if (labeled) return { merchant: tidy(clean(labeled[1])), sure: true };

  // 2) 입금: "보낸분 → 받는계좌" 또는 "홍길동님이 보낸 돈" 패턴
  if (type === "INCOME") {
    const arrow = full.match(/([^\n→>]+?)\s*(?:→|->|>)/);
    if (arrow) {
      const m = tidy(clean(arrow[1]));
      if (m) return { merchant: m, sure: true };
    }
    const sender = full.match(/([^\s\n]+?)님?(?:이|께서)?\s*보낸/);
    if (sender) return { merchant: tidy(sender[1]), sure: true };
    const fromLine = full.match(/입금\s*[\d,]*\s*원?\s*\n?\s*([^\n]+)/);
    if (fromLine) {
      const m = tidy(clean(fromLine[1]));
      if (m) return { merchant: m, sure: false };
    }
  }

  // 3) 시간(22:30) 바로 뒤에 가맹점이 오는 국내 카드 표준 포맷
  const t = full.match(TIME_RE);
  if (t && t.index != null) {
    const after = full.slice(t.index + t[0].length);
    const firstChunk = after.split(/\n|누적|잔액/)[0];
    const m = tidy(clean(firstChunk));
    if (m) return { merchant: m, sure: true };
    // 시간 다음 줄에 있는 경우
    const nextLine = after.split("\n").map((l) => tidy(clean(l))).find(Boolean);
    if (nextLine) return { merchant: nextLine, sure: true };
  }

  // 4) 남은 줄 중 의미 있는 마지막 줄
  const lines = full
    .split("\n")
    .map((l) => tidy(clean(l)))
    .filter((l) => l && !ISSUERS.some(([re]) => re.test(l) && l.length < 12));
  if (lines.length) return { merchant: lines[lines.length - 1], sure: false };
  return { merchant: "", sure: false };
}

function tidy(s: string): string {
  return s
    .replace(/^[\s\-|·:,]+|[\s\-|·:,]+$/g, "")
    .replace(/^(주식회사|\(주\)|㈜)\s*/, "")
    .slice(0, 60)
    .trim();
}

/** 같은 결제가 앱 푸시 + 문자로 두 번 오는 경우 비교용 정규화 */
export function normalizeMerchant(s: string): string {
  return s.replace(/[\s()㈜]|주식회사|코리아|KOREA/gi, "").toLowerCase();
}
