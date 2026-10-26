/** 오른쪽 꺾쇠. rotate면 details가 열릴 때 아래로 돌아감 */
export function Chevron({ rotate, size = 18 }: { rotate?: boolean; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      className={`shrink-0 text-faint ${rotate ? "chev" : ""}`}
      aria-hidden
    >
      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
