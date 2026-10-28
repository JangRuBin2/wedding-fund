import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sessionCookie, signSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** 카카오가 돌려준 code로 토큰 → 사용자 정보. 처음 로그인한 사람은 OWNER로 바로 승인, 그다음은 승인 대기 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, url.origin));
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = req.headers.get("cookie")?.match(/(?:^|;\s*)moabom_oauth_state=([^;]+)/)?.[1];
  if (url.searchParams.get("error")) return fail("카카오 로그인을 취소했어요");
  if (!code || !state || state !== savedState) return fail("로그인 요청이 만료됐어요. 다시 시도해 주세요");

  const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.KAKAO_REST_API_KEY!,
      redirect_uri: `${url.origin}/api/auth/kakao/callback`,
      code,
      ...(process.env.KAKAO_CLIENT_SECRET ? { client_secret: process.env.KAKAO_CLIENT_SECRET } : {}),
    }),
  });
  if (!tokenRes.ok) return fail("카카오 인증에 실패했어요. Redirect URI 설정을 확인해 주세요");
  const { access_token } = (await tokenRes.json()) as { access_token?: string };

  const meRes = await fetch("https://kapi.kakao.com/v2/user/me", { headers: { Authorization: `Bearer ${access_token}` } });
  if (!meRes.ok) return fail("카카오 사용자 정보를 받지 못했어요");
  const me = (await meRes.json()) as { id: number; properties?: { nickname?: string }; kakao_account?: { profile?: { nickname?: string } } };
  const kakaoId = String(me.id);
  const nickname = me.kakao_account?.profile?.nickname ?? me.properties?.nickname ?? null;

  const isFirst = (await prisma.user.count()) === 0;
  const user = await prisma.user.upsert({
    where: { kakaoId },
    create: {
      kakaoId,
      nickname,
      name: nickname || `카카오 ${kakaoId.slice(-4)}`,
      role: isFirst ? "OWNER" : "MEMBER",
      status: isFirst ? "APPROVED" : "PENDING",
      lastLoginAt: new Date(),
    },
    update: { nickname, lastLoginAt: new Date() },
  });

  const res = NextResponse.redirect(new URL(user.status === "APPROVED" ? "/" : "/login/pending", url.origin));
  res.cookies.set(sessionCookie(await signSession({ uid: user.id, name: user.name, role: user.role, status: user.status })));
  res.cookies.delete("moabom_oauth_state");
  return res;
}
