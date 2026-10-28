/** 하트 로고 (아이콘과 같은 모양) */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-[14px] bg-card shadow-[var(--shadow-card)]" style={{ width: size, height: size }}>
      <img src="/heart.svg" alt="" width={size * 0.72} height={size * 0.72} />
    </span>
  );
}
