/** 서버가 UTC로 돌아도 한국 시간 기준으로 월/주/시간대를 자르기 위한 헬퍼 */
const KST = 9 * 60 * 60 * 1000;
export const DAY = 24 * 60 * 60 * 1000;

/** UTC Date → KST 벽시계 값이 들어있는 Date (getUTC*로 읽어야 함) */
export function toKst(d: Date): Date {
  return new Date(d.getTime() + KST);
}

export function kstParts(d: Date) {
  const k = toKst(d);
  return {
    year: k.getUTCFullYear(),
    month: k.getUTCMonth(), // 0-based
    date: k.getUTCDate(),
    hour: k.getUTCHours(),
    weekday: k.getUTCDay(), // 0=일
  };
}

/** KST 기준 해당 월 1일 00:00의 UTC 시각 */
export function kstMonthStart(d: Date, offsetMonths = 0): Date {
  const { year, month } = kstParts(d);
  return new Date(Date.UTC(year, month + offsetMonths, 1) - KST);
}

/** KST 기준 그 주 월요일 00:00의 UTC 시각 */
export function kstWeekStart(d: Date, offsetWeeks = 0): Date {
  const { year, month, date, weekday } = kstParts(d);
  const diff = (weekday + 6) % 7; // 월=0
  return new Date(Date.UTC(year, month, date - diff + offsetWeeks * 7) - KST);
}

export function kstDayStart(d: Date): Date {
  const { year, month, date } = kstParts(d);
  return new Date(Date.UTC(year, month, date) - KST);
}

export function monthKey(d: Date): string {
  const { year, month } = kstParts(d);
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function won(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

export function manwon(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(abs % 100_000_000 ? 2 : 0)}억`;
  if (abs >= 10_000) return `${sign}${Math.round(abs / 10_000).toLocaleString("ko-KR")}만`;
  return `${sign}${Math.round(abs).toLocaleString("ko-KR")}`;
}

export function fmtKst(d: Date, withTime = true): string {
  const p = kstParts(d);
  const base = `${p.month + 1}/${p.date}`;
  if (!withTime) return base;
  const k = toKst(d);
  return `${base} ${String(p.hour).padStart(2, "0")}:${String(k.getUTCMinutes()).padStart(2, "0")}`;
}

export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
