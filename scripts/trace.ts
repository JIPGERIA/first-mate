// 케이스의 최근 실행 트레이스를 터미널에서 본다 (디버깅용).
//   pnpm trace C01 C04
import { sql } from "@/lib/db";

async function main() {
  const ids = process.argv.slice(2);
  const rows = await sql`
    select eval_case_id, prompt_version, route, route_reasons, draft, citations,
      (select json_agg(json_build_object('step', name, 'status', status, 'attempts', attempts, 'detail', detail, 'error', error) order by seq) from steps where run_id = runs.id) steps
    from runs where eval_case_id = any(${ids}) order by id desc`;
  for (const r of rows) {
    console.log(`\n== ${r.eval_case_id} (${r.prompt_version}) → ${r.route}\n사유: ${(r.route_reasons as string[]).join(" / ")}\n\n${r.draft ?? "(초안 없음)"}`);
    console.log(JSON.stringify(r.steps, null, 1));
  }
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
