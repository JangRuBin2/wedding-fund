/**
 * 카카오 로그인 세션 쿠키. 미들웨어(엣지)에서도 읽어야 해서 DB 없이 Web Crypto HMAC으로 서명만 확인.
 * 승인 상태는 로그인할 때 쿠키에 넣고, 바뀌면 /api/auth/refresh 로 다시 발급
 */
export const SESSION_COOKIE = "moabom_session";
export const SESSION_DAYS = 30;

export type Session = { uid: string; name: string; role: string; status: string; exp: number };

/** 카카오 로그인을 쓰는지 (REST API 키가 있으면 켜짐) */
export const kakaoEnabled = () => !!process.env.KAKAO_REST_API_KEY;

const secret = () => process.env.AUTH_SECRET || process.env.CRON_SECRET || process.env.INGEST_TOKEN || "";

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function hmac(data: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
}

export async function signSession(s: Omit<Session, "exp">): Promise<string> {
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ ...s, exp: Date.now() + SESSION_DAYS * 86400_000 })));
  return `${payload}.${b64url(await hmac(payload))}`;
}

export async function readSession(token: string | undefined): Promise<Session | null> {
  if (!token || !secret()) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = b64url(await hmac(payload));
  // 길이가 같은 문자열끼리 끝까지 비교 (타이밍 차이 줄이기)
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff) return null;
  try {
    const s = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as Session;
    return s.exp > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export const sessionCookie = (value: string) => ({
  name: SESSION_COOKIE,
  value,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DAYS * 86400,
});
