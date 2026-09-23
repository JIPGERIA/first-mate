// 평가 배치별 요약표
//   pnpm summary
import { sql } from "@/lib/db";
import { formatSummary, summarize } from "@/lib/eval/runner";

async function main() {
  for (const s of await summarize()) console.log(formatSummary(s));
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
