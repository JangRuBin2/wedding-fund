/**
 * Gemini API (generateContent) 얇은 래퍼.
 * 키가 없거나, 프리티어 한도(429)에 걸리거나, 에러가 나면 null → 호출부에서 룰 기반으로 폴백한다.
 */
export const LLM_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

export const hasLlmKey = () => !!process.env.GEMINI_API_KEY;

export async function askLLM(opts: { system: string; user: string; maxTokens?: number }): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(LLM_MODEL)}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: opts.system }] },
          contents: [{ role: "user", parts: [{ text: opts.user }] }],
          // thinking 토큰도 출력 한도를 먹으니 짧은 답(분류)이라도 넉넉하게 잡음
          generationConfig: { maxOutputTokens: Math.max(opts.maxTokens ?? 800, 512) },
        }),
      },
    );
    if (!res.ok) {
      if (res.status === 429) console.warn("[llm] Gemini 프리티어 한도 초과, 룰 기반으로 폴백");
      else console.error("[llm]", res.status, await res.text());
      return null;
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts
      ?.filter((p) => !p.thought && p.text)
      .map((p) => p.text)
      .join("")
      .trim();
    return text || null;
  } catch (e) {
    console.error("[llm]", e);
    return null;
  }
}
