import type { LLMProvider } from "./types";

/** LLM_PROVIDER=anthropic-api 이면 API, 아니면 로컬 구독(Claude Code). 전환 비용은 환경변수 한 줄. */
export async function getProvider(): Promise<LLMProvider> {
  if (process.env.LLM_PROVIDER === "anthropic-api") {
    const { AnthropicApiProvider } = await import("./anthropic-api");
    return new AnthropicApiProvider();
  }
  const { ClaudeCodeProvider } = await import("./claude-code");
  return new ClaudeCodeProvider();
}

export type * from "./types";
