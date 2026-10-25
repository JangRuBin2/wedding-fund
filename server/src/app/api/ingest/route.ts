import { NextResponse } from "next/server";
import { z } from "zod";
import { ingestNotification } from "@/lib/ingest";

const Body = z.object({
  packageName: z.string().max(200),
  title: z.string().max(500).default(""),
  text: z.string().max(4000).default(""),
  postedAt: z.number().int().positive(),
  memberName: z.string().max(30).optional(),
});

/** 폰 앱이 결제 알림을 보내는 엔드포인트. Authorization: Bearer <INGEST_TOKEN> */
export async function POST(req: Request) {
  const token = process.env.INGEST_TOKEN;
  if (!token || req.headers.get("authorization") !== `Bearer ${token}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const json = await req.json().catch(() => null);
  const items = Array.isArray(json) ? json : [json];
  const results = [];
  for (const item of items.slice(0, 100)) {
    const parsed = Body.safeParse(item);
    if (!parsed.success) {
      results.push({ result: "INVALID", error: parsed.error.issues[0]?.message });
      continue;
    }
    results.push(await ingestNotification(parsed.data));
  }
  return NextResponse.json(Array.isArray(json) ? results : results[0]);
}
