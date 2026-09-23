import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { LLMProvider, LLMUsage, StructuredRequest, StructuredResult } from "./types";

/**
 * 기록·재생. 구독(claude-code)으로 실행한 모델 응답을 data/replay/*.jsonl에 남기고,
 * API 키·구독 없이도 같은 입력이면 같은 응답을 돌려준다 → 누구나 평가 수치를 재현할 수 있다.
 *
 * 키는 요청 전체(tier + 시스템 프롬프트 + KB + 사용자 메시지)의 해시다.
 * 프롬프트나 KB가 한 글자라도 바뀌면 기록이 없다고 멈춘다. 재생 결과가 현재 코드와 어긋날 수 없다.
 */
export const REPLAY_FILE = join(process.cwd(), "data/replay/responses.jsonl");

type Entry = { key: string; tier: string; model: string; ms: number; usage: LLMUsage; data: unknown };

export function requestKey(req: StructuredRequest<unknown>): string {
  return createHash("sha256").update(JSON.stringify([req.tier, req.system, req.stableContext ?? "", req.user])).digest("hex").slice(0, 32);
}

/** 실제 공급자를 감싸 응답을 기록한다 (LLM_RECORD=1) */
export class RecordingProvider implements LLMProvider {
  readonly name: LLMProvider["name"];
  constructor(private inner: LLMProvider) {
    this.name = inner.name;
    mkdirSync(dirname(REPLAY_FILE), { recursive: true });
  }
  async structured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const r = await this.inner.structured(req);
    const entry: Entry = { key: requestKey(req as StructuredRequest<unknown>), tier: req.tier, model: r.model, ms: r.ms, usage: r.usage, data: r.data };
    appendFileSync(REPLAY_FILE, JSON.stringify(entry) + "\n");
    return r;
  }
}

/** 기록된 응답만으로 동작한다 (LLM_PROVIDER=replay). 네트워크를 쓰지 않는다. */
export class ReplayProvider implements LLMProvider {
  readonly name = "replay" as const;
  private entries = new Map<string, Entry>();

  constructor(file = REPLAY_FILE) {
    if (!existsSync(file)) throw new Error(`재생 기록이 없습니다: ${file}`);
    for (const line of readFileSync(file, "utf8").split("\n")) {
      if (!line.trim()) continue;
      const e = JSON.parse(line) as Entry;
      this.entries.set(e.key, e); // 같은 키가 여러 번이면 마지막 기록을 쓴다
    }
  }

  async structured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const key = requestKey(req as StructuredRequest<unknown>);
    const e = this.entries.get(key);
    if (!e) throw new Error(`재생 기록 없음(${key}) — 프롬프트·KB·입력이 기록 이후 바뀌었습니다. 구독으로 다시 기록하세요: LLM_RECORD=1 pnpm eval`);
    return { data: req.schema.parse(e.data), usage: e.usage, ms: 0, model: e.model };
  }
}
