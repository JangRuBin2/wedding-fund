/**
 * 작성 화면에서 저장한 뒤 돌아갈 주소. 우리 사이트 안 경로만 받음 (//evil.com 같은 바깥 주소는 fallback)
 */
export function safeBack(v: unknown, fallback: string) {
  return typeof v === "string" && /^\/(?![/\\])/.test(v) ? v : fallback;
}
