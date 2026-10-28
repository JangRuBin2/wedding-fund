import { cookies } from "next/headers";
import { kakaoEnabled, readSession, SESSION_COOKIE } from "./session";

/**
 * 대시보드는 비밀번호 하나로 들어와서 누가 보고 있는지 모름.
 * 기기마다 '이 기기는 누구'를 골라 쿠키에 저장해서, 체크한 사람을 남길 때 씀.
 * 카카오 로그인을 켜면 로그인한 사람으로 대신함
 */
export async function currentSession() {
  return readSession((await cookies()).get(SESSION_COOKIE)?.value);
}
export const ME_COOKIE = "moabom_me";

export async function getMe(): Promise<string | null> {
  const jar = await cookies();
  // 카카오로 로그인했으면 로그인한 사람 이름이 곧 '나'
  if (kakaoEnabled()) return (await readSession(jar.get(SESSION_COOKIE)?.value))?.name ?? null;
  const v = jar.get(ME_COOKIE)?.value;
  return v ? decodeURIComponent(v) : null;
}
