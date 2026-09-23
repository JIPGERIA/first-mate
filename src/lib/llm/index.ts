import type { LLMProvider } from "./types";

/**
 * LLM_PROVIDER=replay  → 기록된 응답 재생 (키·구독·네트워크 불필요, 평가 재현용)
 * 그 외(기본)          → 로컬 Claude Code 구독. LLM_RECORD=1이면 응답을 data/replay에 기록한다.
 * 운영 전환 시에는 같은 인터페이스로 API 공급자 한 파일을 추가한다 (ADR-9).
 */
export async function getProvider(): Promise<LLMProvider> {
  const { RecordingProvider, ReplayProvider } = await import("./replay");
  if (process.env.LLM_PROVIDER === "replay") return new ReplayProvider();
  const { ClaudeCodeProvider } = await import("./claude-code");
  const live = new ClaudeCodeProvider();
  return process.env.LLM_RECORD === "1" ? new RecordingProvider(live) : live;
}

export type * from "./types";
