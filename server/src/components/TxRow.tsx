import { colorOf, emojiOf } from "@/lib/colors";
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
  const when = timeOnly ? fmtKst(t.occurredAt).split(" ")[1] : fmtKst(t.occurredAt);
  const meta = [t.category, t.member?.name].filter(Boolean).join(" · ");
  return (
    <div className={`flex items-center gap-3 py-3 ${t.cancelled || t.status === "IGNORED" ? "opacity-55" : ""}`}>
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-[20px]">
        <span className="absolute inset-0 opacity-[0.16]" style={{ background: color }} />
        <span className="relative" aria-hidden>
          {emojiOf(t.category)}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[16px] font-semibold">
          <span className={`truncate ${t.cancelled ? "line-through" : ""}`}>{t.merchant}</span>
          {t.status === "REVIEW" && <span className="pill shrink-0 bg-warn-soft !py-0.5 !text-[11px] text-warn">확인 필요</span>}
          {t.cancelled && <span className="pill shrink-0 bg-fill !py-0.5 !text-[11px] text-sub">취소됨</span>}
          {!t.cancelled && t.status === "IGNORED" && (
            <span className="pill shrink-0 bg-fill !py-0.5 !text-[11px] text-sub">{t.category === "저축" ? "저축 이동" : "집계 제외"}</span>
          )}
        </p>
        <p className="mt-0.5 truncate text-[13px] text-sub">
          <span className="num">{when}</span>
          <span className="mx-1 text-faint">·</span>
          {meta}
        </p>
      </div>
      <p className={`num shrink-0 text-[16px] font-bold ${income ? "text-save" : ""}`}>
        {income ? "+" : "−"}
        {t.amount.toLocaleString("ko-KR")}원
      </p>
    </div>
  );
}
