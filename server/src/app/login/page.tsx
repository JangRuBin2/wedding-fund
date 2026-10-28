import { redirect } from "next/navigation";
import { kakaoEnabled } from "@/lib/session";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  if (!kakaoEnabled()) redirect("/");
  const { error } = await searchParams;
  return (
    <main className="flex min-h-[70dvh] flex-col items-center justify-center gap-8 text-center">
      <div className="flex flex-col items-center gap-3">
        <Logo size={72} />
        <div>
          <h1 className="text-[26px] font-extrabold">모아봄</h1>
          <p className="mt-1 text-[14px] text-sub">함께 모으는 우리의 봄</p>
        </div>
      </div>
      <div className="w-full max-w-xs space-y-3">
        {/* 카카오 로그인 버튼 가이드: #FEE500 배경, 검정 85% 글씨, 말풍선 심볼 */}
        <a
          href="/api/auth/kakao/login"
          className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-[#FEE500] py-3.5 text-[15px] font-semibold text-black/85"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
            <path fill="#000" d="M12 3C6.48 3 2 6.58 2 11c0 2.83 1.84 5.31 4.6 6.72l-.94 3.44c-.08.3.26.55.53.38l4.12-2.72c.55.07 1.11.11 1.69.11 5.52 0 10-3.58 10-8S17.52 3 12 3z" />
          </svg>
          카카오 로그인
        </a>
        {typeof error === "string" && <p className="text-[13px] font-semibold text-spend">{error}</p>}
        <p className="text-[12px] leading-relaxed text-sub">처음 로그인한 사람이 관리자가 되고, 그다음부터는 관리자가 승인해야 들어올 수 있어요</p>
      </div>
    </main>
  );
}
