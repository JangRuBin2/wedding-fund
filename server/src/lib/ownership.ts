import { prisma } from "./db";
import { getMe } from "./me";

/**
 * 결제는 같이 보지만, 확인(스와이프)·수정·삭제는 그 결제를 한 사람만.
 * - '나'를 모르면(로그인·기기 선택 안 함) 예전처럼 다 됨
 * - 누구 폰에서 왔는지 모르는 결제(memberId 없음)는 누구나
 */
export function isMine(tx: { member?: { name: string } | null; memberId?: string | null }, me: string | null) {
  if (!me) return true;
  if (!tx.memberId && !tx.member) return true;
  return tx.member?.name === me;
}

export async function assertMine(id: string) {
  const [tx, me] = await Promise.all([prisma.transaction.findUnique({ where: { id }, include: { member: true } }), getMe()]);
  if (!tx) return null;
  if (!isMine(tx, me)) throw new Error(`${tx.member?.name ?? "다른 사람"}님의 결제는 그 사람만 고칠 수 있어요`);
  return tx;
}

/** 확인할 결제 중 내 것(과 주인 없는 것)만 고르는 조건 */
export async function mineWhere() {
  const me = await getMe();
  return me ? { OR: [{ memberId: null }, { member: { name: me } }] } : {};
}
