import { kstParts, manwon, DAY } from "./time";
import { weddingOverview } from "./wedding";

/**
 * 매일 아침 폰으로 보내는 '오늘의 돈 팁'.
 * 금액·요건은 해마다 바뀔 수 있어서 본문은 '확인해 보세요' 톤으로, 숫자는 꼭 필요한 것만.
 * months: 그 달에만 나옴 (없으면 연중)
 */
export type Tip = { id: string; cat: TipCategory; title: string; body: string; months?: number[] };
export type TipCategory = "절세" | "자산관리" | "결혼 행정" | "건강·복지" | "주거";

export const TIPS: Tip[] = [
  // 절세 · 연말정산
  { id: "tax-preview", cat: "절세", months: [11, 12], title: "연말정산 미리보기 열렸어요", body: "홈택스 '연말정산 미리보기'로 올해 예상 세액을 보고, 12월 안에 연금저축·IRP를 얼마 넣을지 정해 보세요" },
  { id: "tax-pension", cat: "절세", months: [10, 11, 12], title: "연금저축·IRP는 12월 31일까지", body: "연금저축과 IRP를 합쳐 연 900만 원까지 세액공제돼요. 올해 넣은 금액만 올해 공제되니 연말 전에 확인해 보세요" },
  { id: "tax-card-mix", cat: "절세", months: [9, 10, 11, 12], title: "카드 공제, 지금부터는 체크카드", body: "총급여의 25%를 넘게 쓴 다음부터는 신용카드(15%)보다 체크카드·현금영수증(30%) 공제율이 높아요" },
  { id: "tax-market", cat: "절세", title: "전통시장·대중교통은 공제를 더 받아요", body: "전통시장과 대중교통에 쓴 돈은 카드 공제율이 따로 높게 잡혀요. 교통카드 소득공제 등록이 돼 있는지 확인해 보세요" },
  { id: "tax-rent", cat: "절세", title: "월세도 세액공제 받을 수 있어요", body: "무주택이고 소득 요건에 맞으면 월세 세액공제를 받아요. 집주인 동의는 필요 없고 계약서와 이체 내역만 있으면 돼요" },
  { id: "tax-subscription", cat: "절세", title: "청약통장 소득공제 신청했나요?", body: "무주택 세대주라면 주택청약 납입액을 소득공제 받을 수 있어요. 은행에 '무주택 확인서'를 내야 적용돼요" },
  { id: "tax-sme", cat: "절세", title: "중소기업 취업자 소득세 감면", body: "청년이 중소기업에 다니면 소득세를 크게 감면받을 수 있어요. 회사에 신청서를 내야 적용되고, 놓친 기간은 5년 안에 경정청구로 돌려받아요" },
  { id: "tax-hometown", cat: "절세", title: "고향사랑기부 10만 원은 사실상 무료", body: "고향사랑기부금 10만 원까지는 전액 세액공제되고 답례품도 받아요. 지금 사는 곳이 아닌 지역에 기부해야 해요" },
  { id: "tax-glasses", cat: "절세", title: "안경·렌즈 영수증 챙기기", body: "안경과 콘택트렌즈는 1인당 연 50만 원까지 의료비 공제에 들어가요. 간소화 자료에 안 잡히면 안경점에서 영수증을 받아 두세요" },
  { id: "tax-medical", cat: "절세", title: "의료비는 소득이 적은 사람 쪽으로", body: "의료비는 총급여의 3%를 넘는 금액부터 공제돼요. 결혼 후에는 소득이 적은 쪽으로 몰면 공제받기 쉬워요" },
  { id: "tax-docs", cat: "절세", months: [1, 2], title: "이직했다면 전 회사 원천징수영수증", body: "올해 이직했다면 전 회사 근로소득 원천징수영수증을 새 회사에 내야 연말정산이 한 번에 끝나요" },
  { id: "tax-may", cat: "절세", months: [5], title: "놓친 공제는 5월에 다시", body: "연말정산 때 빠뜨린 공제는 5월 종합소득세 신고 때 추가할 수 있어요. 홈택스에서 지난 연말정산 내역부터 확인해 보세요" },
  { id: "tax-marriage", cat: "결혼 행정", title: "혼인신고 연도가 세금에 영향을 줘요", body: "혼인신고를 하면 결혼세액공제(1인당 50만 원, 평생 1회)를 받을 수 있어요. 제도가 해당 연도에도 이어지는지 확인하고 신고 시기를 정해 보세요" },

  // 자산관리
  { id: "asset-emergency", cat: "자산관리", title: "비상금은 생활비 3~6개월치", body: "결혼자금과 비상금은 통장을 나눠 두세요. 갑자기 돈이 필요할 때 결혼자금을 깨지 않게 돼요" },
  { id: "asset-auto", cat: "자산관리", title: "월급날 자동이체가 제일 강해요", body: "월급 들어오는 날 바로 저축 통장으로 자동이체를 걸어 두면, 남는 돈을 모으는 것보다 훨씬 잘 모여요" },
  { id: "asset-parking", cat: "자산관리", title: "잠깐 두는 돈은 파킹통장에", body: "잔금처럼 몇 달 안에 쓸 돈은 언제든 뺄 수 있는 파킹통장이나 CMA에 두면 이자를 조금이라도 더 받아요" },
  { id: "asset-deposit-dates", cat: "자산관리", title: "적금 만기를 잔금 날짜에 맞추기", body: "웨딩홀·스드메 잔금 날짜에 맞춰 적금 만기를 잡으면 중도해지 없이 그대로 쓸 수 있어요" },
  { id: "asset-subscriptions", cat: "자산관리", title: "구독 서비스 한 번 정리해요", body: "분석 탭의 '매달 나가는 돈'에서 안 쓰는 구독을 찾아보세요. 둘이 같은 서비스를 따로 내고 있을 수도 있어요" },
  { id: "asset-youth", cat: "자산관리", title: "청년 정책 적금 확인하기", body: "청년이라면 정부가 기여금을 보태 주는 정책 적금이 있어요. 가입 요건과 신청 기간을 은행 앱에서 확인해 보세요" },
  { id: "asset-isa", cat: "자산관리", title: "ISA 계좌 알아보기", body: "ISA는 계좌 안에서 난 수익에 세금 혜택이 있어요. 만기 자금을 연금계좌로 옮기면 세액공제도 추가로 받을 수 있어요" },
  { id: "asset-irp", cat: "자산관리", title: "퇴직금은 IRP로 받으면 세금이 줄어요", body: "퇴직금을 IRP로 받아 나중에 연금으로 받으면 퇴직소득세를 덜 내요. 급하게 쓸 돈이 아니면 IRP에 두는 걸 고려해 보세요" },
  { id: "asset-insurance", cat: "자산관리", title: "보험 중복 확인하기", body: "결혼 전에 각자 든 실손보험·보장성 보험을 한 번 펼쳐 보세요. 겹치는 보장이 있으면 정리할 수 있어요" },
  { id: "asset-credit", cat: "자산관리", title: "대출 전에 신용점수 확인", body: "전세·주택 대출을 받기 몇 달 전부터 카드 연체가 없도록 관리하고, 신용점수를 한 번 확인해 두세요" },

  // 결혼 행정
  { id: "wed-guests", cat: "결혼 행정", title: "하객 수부터 대략 정해요", body: "하객 수가 정해져야 웨딩홀 보증인원과 청첩장 수를 정할 수 있어요. 양가 부모님께 대략적인 숫자를 먼저 여쭤보세요" },
  { id: "wed-contract", cat: "결혼 행정", title: "계약서는 추가금 항목부터", body: "스드메·웨딩홀 계약 전에 원본, 수정본, 헬퍼비, 연출료 같은 추가금 목록을 꼭 받아 두세요. 예산이 주로 여기서 늘어나요" },
  { id: "wed-passport", cat: "결혼 행정", title: "여권 만료일 확인", body: "신혼여행 가기 전에 두 사람 여권 만료일을 확인해 보세요. 나라에 따라 남은 기간이 6개월 이상이어야 해요" },
  { id: "wed-registration", cat: "결혼 행정", title: "혼인신고와 대출·청약", body: "혼인신고 시기에 따라 신혼부부 대출·청약 자격이 달라질 수 있어요. 두 사람 소득 합계 기준도 같이 확인해 보세요" },
  { id: "wed-gifts", cat: "결혼 행정", title: "축의금은 바로 정리해요", body: "축의금은 받은 날 바로 명단과 금액을 정리해 두세요. 나중에 답례와 경조사 챙길 때 꼭 필요해요" },
  { id: "wed-thanks", cat: "결혼 행정", title: "사회자·축가 사례 미리 준비", body: "사회자, 축가, 축의대 도와준 사람 사례 봉투는 결혼식 전날까지 미리 준비해 두면 당일에 정신없지 않아요" },
  { id: "wed-leave", cat: "결혼 행정", title: "경조휴가 일수 확인", body: "회사 경조휴가가 며칠인지, 연차와 붙여 쓸 수 있는지 미리 확인해서 신혼여행 일정을 잡아 보세요" },
  { id: "wed-address", cat: "결혼 행정", title: "주소 이전은 날짜를 맞춰서", body: "전입신고 날짜가 전세 확정일자, 청약 자격, 지원금 요건에 영향을 줄 수 있어요. 이사하면 바로 전입신고하세요" },

  // 건강·복지
  { id: "health-checkup", cat: "건강·복지", months: [10, 11, 12], title: "올해 건강검진 받았나요?", body: "사무직은 2년에 한 번이고, 짝수 해엔 짝수 연도 출생자가 대상이에요. 연말엔 예약이 몰리니 'The건강보험' 앱에서 대상인지 확인해 보세요" },
  { id: "health-premarital", cat: "건강·복지", title: "예비부부 건강검진", body: "보건소에서 예비부부 건강검진을 무료나 저렴하게 받을 수 있는 곳이 많아요. 사는 지역 보건소에 문의해 보세요" },
  { id: "health-insurance-refund", cat: "건강·복지", months: [4, 5], title: "건강보험료 정산 확인", body: "4월 월급에서 지난해 건강보험료 정산분이 빠지거나 돌려받아요. 금액이 크면 급여명세서를 한 번 확인해 보세요" },
  { id: "welfare-gov24", cat: "건강·복지", title: "받을 수 있는 혜택 한 번에 찾기", body: "정부24 '혜택알리미'에서 내 조건으로 받을 수 있는 지원금과 혜택을 한 번에 찾아볼 수 있어요" },

  // 주거
  { id: "home-deposit", cat: "주거", title: "전세 계약 전 체크 3가지", body: "등기부등본(근저당), 집주인 세금 체납 여부, 전세보증보험 가입 가능 여부를 계약 전에 꼭 확인하세요" },
  { id: "home-fixed-date", cat: "주거", title: "전입신고와 확정일자는 같은 날", body: "전세나 월세로 들어가면 전입신고와 확정일자를 입주 당일 받아 두세요. 보증금을 지키는 가장 기본이에요" },
  { id: "home-loan", cat: "주거", title: "신혼부부 전세·구입 대출 비교", body: "버팀목(전세), 디딤돌(구입) 같은 정책대출은 금리가 낮은 대신 소득·자산 요건이 있어요. 은행 대출과 같이 비교해 보세요" },
  { id: "home-happy", cat: "주거", title: "행복주택·신혼희망타운 공고", body: "신혼부부 대상 공공임대·분양 공고는 LH청약플러스와 지역 공사 홈페이지에 올라와요. 알림 신청을 해 두면 놓치지 않아요" },
  { id: "home-appliance", cat: "주거", title: "혼수 가전은 한 번에 견적", body: "가전은 매장에서 묶어서 견적을 받으면 할인 폭이 커져요. 카드사 혼수 할인 행사도 같이 비교해 보세요" },
];

/** KST 기준 날짜 번호 (둘이 같은 날 같은 팁을 받게) */
const kstDayNumber = (d: Date) => Math.floor((d.getTime() + 9 * 3600_000) / DAY);

/** 그 달에 맞는 팁 중 날짜로 고름. 같은 날엔 항상 같은 팁 */
export function seasonalTip(now = new Date()): Tip {
  const month = kstParts(now).month + 1;
  const pool = TIPS.filter((t) => !t.months || t.months.includes(month));
  // 그 달에만 나오는 팁은 자주 보이게 두 번 넣음
  const weighted = [...pool, ...pool.filter((t) => t.months)];
  return weighted[(kstDayNumber(now) * 7) % weighted.length];
}

/** 오늘 보낼 팁. 일주일 안에 결혼준비 잔금이 있으면 그게 먼저 */
export async function todayTip(now = new Date()): Promise<Tip> {
  const w = await weddingOverview(now);
  const soon = w.upcoming.find((i) => i.daysUntil >= 0 && i.daysUntil <= 7);
  if (soon) {
    const when = soon.daysUntil === 0 ? "오늘" : `${soon.daysUntil}일 뒤`;
    return {
      id: `due-${soon.id}`,
      cat: "결혼 행정",
      title: `${soon.name} 잔금이 ${when}예요`,
      body: `${manwon(soon.due)}원을 낼 차례예요. 통장 잔액과 결제 수단을 미리 확인해 두세요`,
    };
  }
  return seasonalTip(now);
}
