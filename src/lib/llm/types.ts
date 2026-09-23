import type { z } from "zod";

/** fast = 분류처럼 짧고 많은 호출, smart = 고객에게 나갈 문장 작성 */
export type ModelTier = "fast" | "smart";

export type LLMUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  costUsdList: number; // API 정가 환산. 구독 실행이면 실제 청구액이 아니다.
};

export type StructuredRequest<T> = {
  tier: ModelTier;
  system: string;
  /** 요청마다 바뀌지 않는 긴 맥락(브랜드 KB). API 공급자는 여기에 캐시 브레이크포인트를 둔다. */
  stableContext?: string;
  user: string;
  schema: z.ZodType<T>;
};

export type StructuredResult<T> = { data: T; usage: LLMUsage; ms: number; model: string };

export interface LLMProvider {
  readonly name: "claude-code" | "replay";
  structured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>>;
}
