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

export function TxRow({ t, timeOnly }: { t: Tx; timeOnly?: boolean }) {
  const income = t.type === "INCOME";
  const color = income ? "var(--color-save)" : colorOf(t.category);
  const meta = [t.category, t.issuer, t.member?.name].filter(Boolean).join(", ");
  return (
    <div className={`flex items-center gap-3 py-3 ${t.cancelled || t.status === "IGNORED" ? "opacity-50" : ""}`}>
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl text-[12px] font-bold">
        <span className="absolute inset-0 opacity-15" style={{ background: color }} />
        <span className="relative" style={{ color }}>
          {(income ? "입금" : t.category).slice(0, 2)}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className={`flex items-center gap-1.5 text-[15px] font-semibold ${t.cancelled ? "line-through" : ""}`}>
          <span className="truncate">{t.merchant}</span>
          {t.status === "REVIEW" && (
            <span className="shrink-0 rounded-md bg-spend-soft px-1.5 py-0.5 text-[10px] font-bold text-spend">확인</span>
          )}
          {t.cancelled && <span className="shrink-0 text-[11px] font-medium text-sub no-underline">취소됨</span>}
          {!t.cancelled && t.status === "IGNORED" && (
            <span className="shrink-0 rounded-md bg-paper px-1.5 py-0.5 text-[10px] font-semibold text-sub">
              {t.category === "저축" ? "저축 이동" : "집계 제외"}
            </span>
          )}
        </p>
        <p className="truncate text-[12px] text-sub">
          <span className="num">{timeOnly ? fmtKst(t.occurredAt).split(" ")[1] : fmtKst(t.occurredAt)}</span>
          <span className="ml-1.5">{meta}</span>
        </p>
      </div>
      <p className={`num shrink-0 text-[15px] font-bold ${income ? "text-save" : ""}`}>
        {income ? "+" : "−"}
        {t.amount.toLocaleString("ko-KR")}
      </p>
    </div>
  );
}
