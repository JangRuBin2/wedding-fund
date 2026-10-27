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
    <main className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold">주간 피드백</h1>
        <form action={generateFeedbackNow}>
          <SubmitButton pendingText="분석 중…">지난주 분석하기</SubmitButton>
        </form>
      </header>
      {!hasKey && (
        <p className="rounded-xl bg-card p-3.5 text-[13px] leading-relaxed text-sub">
          지금은 규칙 기반 요약만 보여 드려요. 서버 <code className="rounded bg-paper px-1">.env</code>에 <code className="rounded bg-paper px-1">GEMINI_API_KEY</code>를 넣으면 Gemini가 소비 패턴을 보고 코멘트를 써 드려요
        </p>
      )}
      {list.length === 0 && (
        <p className="card py-10 text-center text-sm leading-relaxed text-sub">
          아직 피드백이 없어요. 위 버튼으로 지금 바로 만들 수 있어요.
          <br />매주 월요일 아침에는 자동으로 만들어 드릴게요
        </p>
      )}
      {list.map((f) => {
        const s = kstParts(f.weekStart);
        const e = kstParts(new Date(f.weekStart.getTime() + 6 * DAY));
        const [head, ...rest] = f.content.split("\n").filter(Boolean);
        return (
          <article key={f.id} className="card">
            <p className="num text-[12px] font-semibold text-sub">
              {s.month + 1}월 {s.date}일 ~ {e.month + 1}월 {e.date}일
            </p>
            <p className="mt-1.5 text-[18px] leading-snug font-bold">{head}</p>
            <div className="mt-3 space-y-2 text-[15px] leading-relaxed text-ink/85">
              {rest.map((line, i) => (
                <p key={i} className={line.startsWith("다음 주") ? "!mt-4 border-l-[3px] border-save pl-3 font-semibold text-ink" : ""}>
                  {line}
                </p>
              ))}
            </div>
          </article>
        );
      })}
    </main>
  );
}
