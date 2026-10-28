import { NextResponse } from "next/server";
import { todayTip } from "@/lib/tips";

export const dynamic = "force-dynamic";

/** 폰 앱이 매일 아침 가져가서 알림으로 띄우는 '오늘의 팁'. Authorization: Bearer <INGEST_TOKEN> */
export async function GET(req: Request) {
  const token = process.env.INGEST_TOKEN;
  if (!token || req.headers.get("authorization") !== `Bearer ${token}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const tip = await todayTip();
  return NextResponse.json({ id: tip.id, category: tip.cat, title: tip.title, body: tip.body });
}
