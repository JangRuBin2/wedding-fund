/** Anthropic Messages API 얇은 래퍼. 키가 없으면 null을 돌려서 룰 기반으로 폴백한다. */
export const LLM_MODEL = process.env.LLM_MODEL || "claude-haiku-5-5";

export async function askClaude(opts: { system: string; user: string; maxTokens?: number }): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        max_tokens: opts.maxTokens ?? 800,
        system: opts.system,
        messages: [{ role: "user", content: opts.user }],
      }),
    });
    if (!res.ok) {
      console.error("[llm]", res.status, await res.text());
      return null;
    }
    const data = (await res.json()) as { content: { type: string; text?: string }[] };
    return data.content.filter((c) => c.type === "text").map((c) => c.text).join("").trim();
  } catch (e) {
    console.error("[llm]", e);
    return null;
  }
}
