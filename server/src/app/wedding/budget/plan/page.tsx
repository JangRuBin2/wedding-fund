import { budgetUsage } from "@/lib/wedding";
import { BudgetPlanner } from "@/components/BudgetPlanner";
import { WriteHeader } from "@/components/WriteHeader";

export const dynamic = "force-dynamic";

export default async function WeddingBudgetPlanPage() {
  const usage = await budgetUsage();
  return (
    <main className="space-y-6">
      <WriteHeader back="/wedding/budget" backLabel="예산" title="예산 나누기" sub="슬라이더로 조절하고, 잠그면 다른 슬라이더를 움직여도 그대로예요" />
      <div className="card">
        <BudgetPlanner initial={Object.fromEntries(usage.rows.map((r) => [r.name, r.budget]))} />
      </div>
    </main>
  );
}
