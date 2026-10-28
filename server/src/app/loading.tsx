/**
 * 페이지를 누르면 서버가 DB를 읽는 동안 바로 보여 주는 뼈대 화면.
 * 링크를 누르자마자 바뀌어서 '이동 중'인 걸 알 수 있고, 미리 받아 둔 뼈대라 즉시 뜸
 */
export default function Loading() {
  return (
    <main className="space-y-7" aria-busy="true" aria-label="불러오는 중">
      <div className="h-7 w-32 animate-pulse rounded-lg bg-card" />
      <div className="hero h-44 animate-pulse opacity-60" />
      <div className="space-y-3">
        <div className="h-4 w-24 animate-pulse rounded bg-card" />
        <div className="card h-28 animate-pulse" />
      </div>
      <div className="space-y-3">
        <div className="h-4 w-20 animate-pulse rounded bg-card" />
        <div className="card h-40 animate-pulse" />
      </div>
    </main>
  );
}
