import { NextResponse } from "next/server";
import { z } from "zod";
import { ingestNotification } from "@/lib/ingest";

/** 한 번에 받는 최대 건수. 앱은 이보다 작게 나눠서 보냄 */
const MAX_BATCH = 100;
const cut = (n: number) => z.string().transform((s) => s.slice(0, n));

const Body = z.object({
  packageName: cut(200),
  // 너무 긴 알림도 거부하지 않고 잘라서 저장 (원문이 남아야 파서를 고칠 수 있음)
  title: cut(500).nullish().transform((s) => s ?? ""),
  text: cut(4000).nullish().transform((s) => s ?? ""),
  // 초 단위로 오거나 말도 안 되는 시각이면 서버 시각으로 대체
  postedAt: z.number().transform((n) => {
    const ms = n > 0 && n < 1e11 ? n * 1000 : n;
    return Number.isFinite(ms) && ms > 1e12 && ms < Date.now() + 86_400_000 ? Math.floor(ms) : Date.now();
  }),
  memberName: cut(30).optional(),
});

/** 폰 앱이 결제 알림을 보내는 엔드포인트. Authorization: Bearer <INGEST_TOKEN> */
export async function POST(req: Request) {
  const token = process.env.INGEST_TOKEN;
  if (!token || req.headers.get("authorization") !== `Bearer ${token}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const json = await req.json().catch(() => null);
  const items = Array.isArray(json) ? json : [json];
  // 조용히 잘라서 버리지 않고 거절 → 앱이 나눠서 다시 보냄
  if (items.length > MAX_BATCH) return NextResponse.json({ error: "too_many", max: MAX_BATCH }, { status: 413 });

  const results = [];
  for (const item of items) {
    const parsed = Body.safeParse(item);
    if (!parsed.success) {
      results.push({ result: "INVALID", error: parsed.error.issues[0]?.message });
      continue;
    }
    // 한 건이 실패해도 나머지는 처리 (앱 큐가 한 건 때문에 막히지 않게)
    try {
      results.push(await ingestNotification(parsed.data));
    } catch (e) {
      console.error("[ingest] failed", e);
      results.push({ result: "ERROR" });
    }
  }
  return NextResponse.json(Array.isArray(json) ? results : results[0]);
}
