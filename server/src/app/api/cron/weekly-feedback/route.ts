import { NextResponse } from "next/server";
import { generateWeeklyFeedback } from "@/lib/feedback";

/** 매주 월요일 아침 외부 크론(홈서버 crontab, Vercel Cron 등)이 호출. Authorization: Bearer <CRON_SECRET> */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const fb = await generateWeeklyFeedback();
  return NextResponse.json({ ok: true, id: fb.id, model: fb.model });
}
