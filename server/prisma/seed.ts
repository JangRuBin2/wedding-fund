import "dotenv/config";
/**
 * 데모 데이터: 최근 4개월치 가짜 결제 알림을 실제 ingest 파이프라인(파서→분류→중복제거)에 흘려보냄.
 * 대시보드 생김새 확인용. 실사용 전에 `rm prisma/data.db && npm run db:push` 로 초기화.
 */
import { prisma } from "../src/lib/db";
import { ingestNotification } from "../src/lib/ingest";

const DAY = 86400_000;
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];

const SPOTS: { m: string; min: number; max: number; hours: number[]; p: number; weekend?: number }[] = [
  { m: "스타벅스 역삼점", min: 5000, max: 9800, hours: [8, 9, 13, 15], p: 0.55 },
  { m: "메가MGC커피 선릉", min: 2000, max: 4500, hours: [9, 13], p: 0.35 },
  { m: "GS25 역삼센터", min: 1800, max: 12000, hours: [8, 12, 22, 23, 0], p: 0.45 },
  { m: "배달의민족", min: 16000, max: 38000, hours: [19, 20, 21, 22, 23], p: 0.32, weekend: 0.5 },
  { m: "쿠팡이츠", min: 14000, max: 29000, hours: [22, 23, 0, 1], p: 0.12 },
  { m: "김밥천국 강남점", min: 6500, max: 11000, hours: [12, 13], p: 0.25 },
  { m: "본죽 역삼점", min: 9000, max: 14000, hours: [12], p: 0.1 },
  { m: "카카오T 택시", min: 6800, max: 24000, hours: [0, 1, 23, 8], p: 0.15 },
  { m: "쿠팡", min: 9900, max: 89000, hours: [21, 22, 23, 0], p: 0.18 },
  { m: "무신사", min: 39000, max: 159000, hours: [22, 23, 0], p: 0.04 },
  { m: "올리브영 강남", min: 12000, max: 48000, hours: [18, 19], p: 0.05, weekend: 0.2 },
  { m: "이마트 성수점", min: 32000, max: 98000, hours: [15, 16, 17], p: 0, weekend: 0.35 },
  { m: "CGV 용산", min: 15000, max: 36000, hours: [14, 19], p: 0, weekend: 0.15 },
  { m: "역전할머니맥주", min: 28000, max: 72000, hours: [20, 21, 22], p: 0.06, weekend: 0.2 },
];

const FIXED = [
  { m: "넷플릭스", amount: 17000, day: 3 },
  { m: "유튜브프리미엄", amount: 14900, day: 9 },
  { m: "SKT", amount: 69000, day: 21 },
  { m: "쿠팡와우멤버십", amount: 7890, day: 12 },
];

function cardText(issuer: string, amount: number, merchant: string, at: Date) {
  const k = new Date(at.getTime() + 9 * 3600_000);
  const md = `${String(k.getUTCMonth() + 1).padStart(2, "0")}/${String(k.getUTCDate()).padStart(2, "0")}`;
  const hm = `${String(k.getUTCHours()).padStart(2, "0")}:${String(k.getUTCMinutes()).padStart(2, "0")}`;
  const a = amount.toLocaleString("ko-KR");
  if (issuer === "신한")
    return { packageName: "com.shcard.smartpay", title: "신한카드", text: `신한카드(1234)승인 홍*동 ${a}원(일시불)${md} ${hm} ${merchant} 누적1,234,560원` };
  return { packageName: "com.hyundaicard.appcard", title: "현대카드", text: `현대카드 승인\n홍*동\n${a}원 일시불\n${md} ${hm}\n${merchant}\n누적 987,650원` };
}

async function main() {
  const now = Date.now();
  const start = now - 120 * DAY;

  await prisma.goal.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      title: "결혼자금",
      targetAmount: 50_000_000,
      startAmount: 12_000_000,
      startDate: new Date(start),
      targetDate: new Date(now + 420 * DAY),
      bigSpendThreshold: 50000,
    },
    update: {},
  });

  let n = 0;
  for (let t = start; t <= now + DAY; t += DAY) {
    const d = new Date(t + 9 * 3600_000);
    const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
    for (const s of SPOTS) {
      const p = weekend ? s.weekend ?? s.p * 0.6 : s.p;
      if (rand() > p) continue;
      const hour = pick(s.hours);
      const at = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, Math.floor(rand() * 59)) - 9 * 3600_000);
      if (at.getTime() > now) continue;
      const amount = Math.round((s.min + rand() * (s.max - s.min)) / 100) * 100;
      const msg = cardText(rand() > 0.4 ? "신한" : "현대", amount, s.m, at);
      await ingestNotification({ ...msg, postedAt: at.getTime(), memberName: "민준" });
      // 가끔 같은 결제가 문자로도 들어옴 → 중복 제거 테스트
      if (rand() < 0.08)
        await ingestNotification({ ...msg, packageName: "com.samsung.android.messaging", title: "15447200", postedAt: at.getTime() + 20_000, memberName: "민준" });
      n++;
    }
    for (const f of FIXED) {
      if (d.getUTCDate() === f.day) {
        const at = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 9) - 9 * 3600_000);
        if (at.getTime() <= now) await ingestNotification({ ...cardText("신한", f.amount, f.m, at), postedAt: at.getTime(), memberName: "민준" });
      }
    }
    if (d.getUTCDate() === 25) {
      const at = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 10) - 9 * 3600_000);
      if (at.getTime() <= now) await ingestNotification({
        packageName: "com.kakaobank.channel",
        title: "입금 4,600,000원",
        text: "(주)한빛상사 급여 → 내 입출금통장(1234)",
        postedAt: at.getTime(),
        memberName: "민준",
      });
    }
    if (d.getUTCDate() === 1) {
      const at = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 11) - 9 * 3600_000);
      if (at.getTime() <= now) await ingestNotification({ packageName: "com.kbstar.kbbank", title: "KB국민은행", text: `${String(d.getUTCMonth() + 1).padStart(2, "0")}/01 11:00 출금 650,000원 월세 잔액 2,100,000원`, postedAt: at.getTime(), memberName: "민준" });
    }
  }
  // 파서가 애매하게 잡는 케이스 하나 → '확인 필요' 데모
  await ingestNotification({ packageName: "com.lcacApp", title: "롯데카드", text: "롯데카드 결제 32,000원", postedAt: now - 2 * 3600_000, memberName: "민준" });

  const count = await prisma.transaction.count();
  console.log(`seeded ${n} payments → ${count} transactions`);
}

main().finally(() => prisma.$disconnect());
