import { NextResponse } from "next/server";
import { kakaoEnabled } from "@/lib/session";

export const dynamic = "force-dynamic";

/** 카카오 로그인 화면으로 보냄. state 쿠키로 다른 사이트에서 콜백을 위조하지 못하게 함 */
export async function GET(req: Request) {
  if (!kakaoEnabled()) return NextResponse.redirect(new URL("/", req.url));
  const origin = new URL(req.url).origin;
  const state = crypto.randomUUID();
  const url = new URL("https://kauth.kakao.com/oauth/authorize");
  url.searchParams.set("client_id", process.env.KAKAO_REST_API_KEY!);
  url.searchParams.set("redirect_uri", `${origin}/api/auth/kakao/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  const res = NextResponse.redirect(url);
  res.cookies.set({ name: "moabom_oauth_state", value: state, httpOnly: true, sameSite: "lax", path: "/", maxAge: 600, secure: origin.startsWith("https") });
  return res;
}
