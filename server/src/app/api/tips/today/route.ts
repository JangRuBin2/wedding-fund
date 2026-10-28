import { NextResponse } from "next/server";
import { todayTip } from "@/lib/tips";

export const dynamic = "force-dynamic";

/** 폰 앱이 매일 아침 가져가서 알림으로 띄우는 '오늘의 팁'. Authorization: Bearer <INGEST_TOKEN> */
export async function GET(req: Request) {
  const token = process.env.INGEST_TOKEN;
  if (!token || req.headers.get("authorization") !== `Bearer ${token}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // 폰 앱이 ?member=<이름> 을 붙여 보내면 그 사람 정보로 팁을 거름
  const member = new URL(req.url).searchParams.get("member")?.trim().slice(0, 30) || null;
  const tip = await todayTip(new Date(), member);
  return NextResponse.json({ id: tip.id, category: tip.cat, title: tip.title, body: tip.body });
}
