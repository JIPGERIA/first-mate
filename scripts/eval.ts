// 골든셋(또는 홀드아웃)을 파이프라인으로 처리하고 채점한다.
//   pnpm eval                    → 골든셋 전체
//   pnpm eval C01 C13            → 일부 케이스만
//   EVAL_SET=holdout2 pnpm eval  → 홀드아웃
// 환경변수: LLM_PROVIDER(replay면 기록 재생), LLM_RECORD=1(구독 응답 기록), EVAL_CONCURRENCY(기본 4), MOCK_FAULT_RATE(주문 API 장애율), EVAL_LABEL
import { sql } from "@/lib/db";
import { getProvider } from "@/lib/llm";
import { formatSummary, runEval, summarize } from "@/lib/eval/runner";
import type { EvalSet } from "@/lib/eval/golden";

async function main() {
  const llm = await getProvider();
  const batch = await runEval({
    set: (process.env.EVAL_SET ?? "golden") as EvalSet,
    llm,
    concurrency: Number(process.env.EVAL_CONCURRENCY ?? 4),
    only: new Set(process.argv.slice(2)),
    label: process.env.EVAL_LABEL,
  });
  const [s] = await summarize(batch);
  console.log(`\n== ${formatSummary(s)}`);
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
