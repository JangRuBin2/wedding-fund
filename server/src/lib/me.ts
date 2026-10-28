import { cookies } from "next/headers";

/**
 * 대시보드는 비밀번호 하나로 들어와서 누가 보고 있는지 모름.
 * 기기마다 '이 기기는 누구'를 골라 쿠키에 저장해서, 체크한 사람을 남길 때 씀
 */
export const ME_COOKIE = "moabom_me";

export async function getMe(): Promise<string | null> {
  const v = (await cookies()).get(ME_COOKIE)?.value;
  return v ? decodeURIComponent(v) : null;
}
