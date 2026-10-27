/**
 * 파서 회귀 테스트. 실제 알림이 이상하게 잡히면 여기에 케이스 추가하고 `npm run test:parser`.
 * (카드 알림 문구는 카드사/앱 버전마다 조금씩 달라서, 실제 원문을 모아두는 게 제일 좋음)
 */
import { parseNotification } from "../src/lib/parser";

type Case = {
  name: string;
  packageName?: string;
  title: string;
  text: string;
  expect: null | { type: "EXPENSE" | "INCOME"; amount: number; merchant?: string; cancelled?: boolean; issuer?: string };
};

const cases: Case[] = [
  {
    name: "카드 청구 예정 안내는 무시",
    title: "신한카드",
    text: "[신한카드] 11월 결제예정금액은 1,234,560원입니다.",
    expect: null,
  },
  {
    name: "결제하실 금액 안내는 무시",
    title: "KB국민카드",
    text: "[KB국민카드] 11/14 결제하실 금액 832,000원",
    expect: null,
  },
  {
    name: "할인 마케팅은 무시",
    title: "현대카드",
    text: "(광고) 현대카드로 결제 시 최대 5,000원 할인!",
    expect: null,
  },
  {
    name: "신한 문자 한 줄 포맷",
    packageName: "com.samsung.android.messaging",
    title: "15447200",
    text: "[Web발신]\n신한카드(1234)승인 홍*동 12,000원(일시불)10/25 22:30 스타벅스 누적1,234,567원",
    expect: { type: "EXPENSE", amount: 12000, merchant: "스타벅스", issuer: "신한" },
  },
  {
    name: "현대 여러 줄 포맷",
    title: "현대카드",
    text: "현대카드 승인\n홍*동\n45,900원 일시불\n10/25 19:02\n쿠팡\n누적 1,234,567원",
    expect: { type: "EXPENSE", amount: 45900, merchant: "쿠팡", issuer: "현대" },
  },
  {
    name: "KB 국민 체크",
    title: "KB국민카드",
    text: "KB국민체크(5678)\n홍*동님\n10/24 12:41\n8,500원\n김밥천국강남점 사용",
    expect: { type: "EXPENSE", amount: 8500, merchant: "김밥천국강남점", issuer: "KB국민" },
  },
  {
    name: "삼성 할부",
    title: "삼성카드",
    text: "삼성1234승인 홍*동\n1,290,000원 03개월\n10/23 15:11 삼성전자스토어\n누적2,345,000원",
    expect: { type: "EXPENSE", amount: 1290000, merchant: "삼성전자스토어", issuer: "삼성" },
  },
  {
    name: "가맹점 라벨 포맷 (알림톡)",
    packageName: "com.kakao.talk",
    title: "하나카드",
    text: "[하나카드] 승인 안내\n카드: 하나(9876)\n금액: 23,000원\n가맹점: 교촌치킨 역삼점\n일시: 10/25 20:15",
    expect: { type: "EXPENSE", amount: 23000, merchant: "교촌치킨 역삼점", issuer: "하나" },
  },
  {
    name: "승인 취소",
    title: "신한카드",
    text: "신한카드(1234)승인취소 홍*동 45,900원 10/25 19:30 쿠팡",
    expect: { type: "EXPENSE", amount: 45900, cancelled: true, merchant: "쿠팡" },
  },
  {
    name: "카카오뱅크 급여 입금",
    packageName: "com.kakaobank.channel",
    title: "입금 3,200,000원",
    text: "한빛상사 → 내 입출금통장(1234)",
    expect: { type: "INCOME", amount: 3200000, merchant: "한빛상사" },
  },
  {
    name: "토스 입금 (보낸분)",
    packageName: "viva.republica.toss",
    title: "토스뱅크",
    text: "지수님이 보낸 50,000원이 입금되었어요",
    expect: { type: "INCOME", amount: 50000, merchant: "지수" },
  },
  {
    name: "출금은 지출",
    title: "국민은행",
    text: "10/25 09:00 출금 650,000원 월세 잔액 1,500,000원",
    expect: { type: "EXPENSE", amount: 650000, merchant: "월세" },
  },
  {
    name: "카톡 친구 대화는 무시",
    packageName: "com.kakao.talk",
    title: "민수",
    text: "어제 밥값 15,000원 입금했어",
    expect: null,
  },
  {
    name: "승인 거절은 무시",
    title: "신한카드",
    text: "신한카드(1234) 승인거절 잔액부족 12,000원 스타벅스",
    expect: null,
  },
  {
    name: "금액 없는 마케팅 알림 무시",
    title: "현대카드",
    text: "이번 주말 M포인트 2배 적립 이벤트!",
    expect: null,
  },
];

let fail = 0;
for (const c of cases) {
  const got = parseNotification({ packageName: c.packageName ?? "com.example.card", title: c.title, text: c.text });
  let ok: boolean;
  if (c.expect === null) ok = got === null;
  else
    ok =
      !!got &&
      got.type === c.expect.type &&
      got.amount === c.expect.amount &&
      (c.expect.merchant === undefined || got.merchant === c.expect.merchant) &&
      (c.expect.cancelled === undefined || got.cancelled === c.expect.cancelled) &&
      (c.expect.issuer === undefined || got.issuer === c.expect.issuer);
  if (!ok) fail++;
  console.log(`${ok ? "✅" : "❌"} ${c.name}${ok ? "" : `\n   expected ${JSON.stringify(c.expect)}\n   got      ${JSON.stringify(got)}`}`);
}
console.log(`\n${cases.length - fail}/${cases.length} 통과`);
process.exit(fail ? 1 : 0);
