import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { LLMProvider, StructuredRequest, StructuredResult } from "./types";

/** ANTHROPIC_API_KEY가 있을 때 쓰는 실시간 공급자. 코드 경로는 구독 공급자와 동일한 인터페이스를 따른다. */
const MODEL = { fast: "claude-haiku-4-5", smart: "claude-sonnet-5" } as const;
// $/1M tokens (input, output, cache read)
const PRICE = {
  "claude-haiku-4-5": [1, 5, 0.1],
  "claude-sonnet-5": [2, 10, 0.2],
} as const;

export class AnthropicApiProvider implements LLMProvider {
  readonly name = "anthropic-api" as const;
  private client = new Anthropic();

  async structured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const model = MODEL[req.tier];
    const system: Anthropic.TextBlockParam[] = [{ type: "text", text: req.system }];
    if (req.stableContext) system.push({ type: "text", text: req.stableContext, cache_control: { type: "ephemeral" } });

    const started = Date.now();
    const res = await this.client.messages.parse({
      model,
      max_tokens: req.tier === "fast" ? 1024 : 4096,
      system,
      messages: [{ role: "user", content: req.user }],
      output_config: { format: zodOutputFormat(req.schema) },
    });
    if (res.stop_reason === "refusal") throw new Error("model refused");
    if (!res.parsed_output) throw new Error(`structured output parse failed (stop_reason=${res.stop_reason})`);

    const [pin, pout, pcache] = PRICE[model];
    const u = res.usage;
    const cacheRead = u.cache_read_input_tokens ?? 0;
    return {
      data: res.parsed_output,
      ms: Date.now() - started,
      model,
      usage: {
        inputTokens: u.input_tokens + cacheRead + (u.cache_creation_input_tokens ?? 0),
        outputTokens: u.output_tokens,
        cacheReadTokens: cacheRead,
        costUsdList: (u.input_tokens * pin + u.output_tokens * pout + cacheRead * pcache) / 1e6,
      },
    };
  }
}
