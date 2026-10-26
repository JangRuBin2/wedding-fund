import Link from "next/link";
import { prisma } from "@/lib/db";
import { kstParts, DAY } from "@/lib/time";
import { generateFeedbackNow } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";
import { hasLlmKey } from "@/lib/llm";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const list = await prisma.feedback.findMany({ orderBy: { weekStart: "desc" }, take: 12 });
  const hasKey = hasLlmKey();

  return (
    <main className="space-y-6">
      <header className="px-1.5">
        <Link href="/patterns" className="text-[15px] font-semibold text-save">
          ‹ 소비 분석
        </Link>
        <h1 className="page-title mt-2">주간 피드백</h1>
        <p className="page-sub">매주 월요일 아침, 지난 한 주 소비를 정리해 드려요</p>
      </header>

      <form action={generateFeedbackNow}>
        <SubmitButton pendingText="지난주 살펴보는 중…" className="w-full">
          ✨ 지금 지난주 정리하기
        </SubmitButton>
      </form>

      {!hasKey && (
        <p className="help glass flex gap-2.5 rounded-[20px] p-4">
          <span aria-hidden>ℹ️</span>
          <span>
            지금은 숫자로만 간단히 정리해요. 서버 <code className="rounded bg-fill px-1">.env</code>에{" "}
            <code className="rounded bg-fill px-1">GEMINI_API_KEY</code>를 넣으면 AI가 소비 습관까지 짚어줘요
          </span>
        </p>
      )}
      {list.length === 0 && (
        <div className="card py-10 text-center">
          <p className="text-[34px]">🗓️</p>
          <p className="mt-2 text-[17px] font-bold">아직 정리한 주가 없어요</p>
          <p className="help mt-1 !text-[14px]">
            위 버튼을 누르면 바로 만들어져요.
            <br />
            매주 자동으로 받으려면 README의 크론 설정을 해 주세요
          </p>
        </div>
      )}
      {list.map((f) => {
        const s = kstParts(f.weekStart);
        const e = kstParts(new Date(f.weekStart.getTime() + 6 * DAY));
        const [head, ...rest] = f.content.split("\n").filter(Boolean);
        return (
          <article key={f.id} className="card">
            <span className="pill num bg-fill text-sub">
              {s.month + 1}월 {s.date}일 ~ {e.month + 1}월 {e.date}일
            </span>
            <p className="mt-3 text-[19px] leading-snug font-bold">{head}</p>
            <div className="mt-3 space-y-2.5 text-[16px] leading-relaxed text-ink/85">
              {rest.map((line, i) =>
                line.startsWith("다음 주") ? (
                  <p key={i} className="!mt-4 flex gap-2.5 rounded-[18px] bg-save-soft p-3.5 font-semibold text-ink">
                    <span aria-hidden>👉</span>
                    <span>{line}</span>
                  </p>
                ) : (
                  <p key={i}>{line}</p>
                ),
              )}
            </div>
          </article>
        );
      })}
    </main>
  );
}
