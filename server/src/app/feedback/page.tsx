import { prisma } from "@/lib/db";
import { kstParts, DAY } from "@/lib/time";
import { generateFeedbackNow } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const list = await prisma.feedback.findMany({ orderBy: { weekStart: "desc" }, take: 12 });
  const hasKey = !!process.env.ANTHROPIC_API_KEY;

  return (
    <main className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">주간 피드백</h1>
        <form action={generateFeedbackNow}>
          <SubmitButton pendingText="분석 중…">지난주 분석</SubmitButton>
        </form>
      </header>
      {!hasKey && (
        <p className="rounded-xl bg-spend-soft p-3 text-sm text-spend">
          ANTHROPIC_API_KEY가 없어서 규칙 기반 요약으로 나옴. 키 넣으면 Claude가 패턴 보고 직접 잔소리해줌
        </p>
      )}
      {list.length === 0 && <p className="card text-center text-sm text-sub">아직 피드백 없음. 매주 월요일 아침 자동 생성되게 크론 걸어두면 됨</p>}
      {list.map((f) => {
        const s = kstParts(f.weekStart);
        const e = kstParts(new Date(f.weekStart.getTime() + 6 * DAY));
        const [head, ...rest] = f.content.split("\n").filter(Boolean);
        return (
          <article key={f.id} className="card">
            <p className="label">
              {s.month + 1}/{s.date} ~ {e.month + 1}/{e.date} · {f.model}
            </p>
            <p className="mt-1 text-lg font-bold leading-snug">{head}</p>
            <div className="mt-2 space-y-1.5 text-[15px] leading-relaxed">
              {rest.map((line, i) => (
                <p key={i} className={line.startsWith("다음 주") ? "mt-3 rounded-lg bg-save-soft px-3 py-2 font-semibold text-save" : ""}>
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
