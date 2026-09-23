import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import type { LLMProvider, StructuredRequest, StructuredResult } from "./types";

/**
 * 로컬 Claude Code(구독 인증)로 추론한다. API 과금이 없고, 로컬 배치 전용이다.
 * 도구·설정·MCP·세션 저장을 모두 꺼서 순수한 "구조화 출력 한 번"으로 만든다.
 */
const MODEL = { fast: "haiku", smart: "sonnet" } as const;
const sandbox = mkdtempSync(join(tmpdir(), "first-mate-"));

type CliResult = {
  is_error: boolean;
  result?: string;
  structured_output?: unknown;
  total_cost_usd: number;
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number };
  modelUsage?: Record<string, unknown>;
};

export class ClaudeCodeProvider implements LLMProvider {
  readonly name = "claude-code" as const;

  async structured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const system = req.stableContext ? `${req.system}\n\n${req.stableContext}` : req.system;
    const args = [
      "-p",
      "--model", MODEL[req.tier],
      "--tools", "",
      "--setting-sources", "",
      "--strict-mcp-config",
      "--no-session-persistence",
      "--disable-slash-commands",
      "--system-prompt", system,
      "--output-format", "json",
      "--json-schema", JSON.stringify(cliSchema(req.schema)),
    ];
    const started = Date.now();
    const raw = await run("claude", args, req.user);
    const out = JSON.parse(raw) as CliResult;
    if (out.is_error) throw new Error(`claude-code error: ${out.result ?? "unknown"}`);
    const data = req.schema.parse(out.structured_output ?? JSON.parse(out.result ?? "null"));
    return {
      data,
      ms: Date.now() - started,
      model: Object.keys(out.modelUsage ?? {})[0] ?? MODEL[req.tier],
      usage: {
        inputTokens: out.usage.input_tokens,
        outputTokens: out.usage.output_tokens,
        cacheReadTokens: out.usage.cache_read_input_tokens ?? 0,
        costUsdList: out.total_cost_usd,
      },
    };
  }
}

// CLI 검증기는 draft 2020-12의 $schema 선언을 인식하지 못하므로 떼고 넘긴다.
function cliSchema(schema: z.ZodType) {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest;
}

function run(cmd: string, args: string[], stdin: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: sandbox, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), 180_000);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(`claude exited ${code}: ${stderr.slice(0, 500) || stdout.slice(0, 500)}`));
    });
    child.stdin.end(stdin);
  });
}
