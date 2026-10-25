import { colorOf } from "@/lib/colors";
import { fmtKst } from "@/lib/time";

type Tx = {
  id: string;
  type: string;
  amount: number;
  merchant: string;
  category: string;
  occurredAt: Date;
  issuer: string | null;
  status: string;
  cancelled: boolean;
  member?: { name: string } | null;
};

export function TxRow({ t }: { t: Tx }) {
  const income = t.type === "INCOME";
  return (
    <div className={`flex items-center gap-3 py-2.5 ${t.cancelled || t.status === "IGNORED" ? "opacity-40" : ""}`}>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
        style={{ background: income ? "var(--color-save)" : colorOf(t.category) }}
      >
        {(income ? "입" : t.category).slice(0, 2)}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[15px] font-semibold ${t.cancelled ? "line-through" : ""}`}>
          {t.merchant}
          {t.status === "REVIEW" && <span className="ml-1.5 rounded bg-spend-soft px-1.5 py-0.5 text-[10px] text-spend">확인</span>}
        </p>
        <p className="truncate text-xs text-sub">
          {fmtKst(t.occurredAt)} · {t.category}
          {t.issuer ? ` · ${t.issuer}` : ""}
          {t.member ? ` · ${t.member.name}` : ""}
        </p>
      </div>
      <p className={`num shrink-0 text-[15px] font-bold ${income ? "text-save" : ""}`}>
        {income ? "+" : "-"}
        {t.amount.toLocaleString("ko-KR")}
      </p>
    </div>
  );
}
