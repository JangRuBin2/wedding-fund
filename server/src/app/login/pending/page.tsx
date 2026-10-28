import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";

export default function PendingPage() {
  return (
    <main className="flex min-h-[70dvh] flex-col items-center justify-center gap-6 text-center">
      <Logo size={64} />
      <div>
        <h1 className="text-[20px] font-bold">승인을 기다리고 있어요</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-sub">
          함께 쓰는 사람이 설정 → 로그인 요청에서 승인하면 들어올 수 있어요.
          <br />
          승인받은 뒤 아래 버튼을 눌러 주세요
        </p>
      </div>
      <div className="flex gap-2">
        <a href="/api/auth/refresh" className="btn">승인됐는지 확인</a>
        <a href="/api/auth/logout" className="btn-ghost !py-[11px]">다른 계정</a>
      </div>
    </main>
  );
}
