// 채점 규칙이 바뀌었을 때, 모델을 다시 부르지 않고 저장된 결과(runs)로 기존 배치를 다시 채점한다.
//   pnpm regrade <batch>
import { sql } from "@/lib/db";
import { grade, loadGolden } from "@/lib/eval/golden";

async function main() {
  const batch = process.argv[2];
  if (!batch) throw new Error("usage: pnpm regrade <batch>");
  const cases = new Map([...loadGolden("golden").cases, ...loadGolden("holdout").cases].map((c) => [c.id, c]));
  const rows = await sql<{ id: number; case_id: string; route: string; triage: { brand: string; intent: string } | null; draft: string | null }[]>`
    select e.id, e.case_id, r.route, r.triage, r.draft from eval_results e join runs r on r.id = e.run_id where e.eval_batch = ${batch}`;
  let changed = 0;
  for (const r of rows) {
    const c = cases.get(r.case_id)!;
    const g = grade(c, { brand: r.triage?.brand, intent: r.triage?.intent, route: r.route, reply: r.draft });
    const res = await sql`
      update eval_results set expected = ${sql.json(c.expect)}, brand_ok = ${g.brand_ok}, intent_ok = ${g.intent_ok}, route_ok = ${g.route_ok},
        unsafe_auto = ${g.unsafe_auto}, policy_ok = ${g.policy_ok},
        actual = actual || ${sql.json({ missing: g.missing, forbidden: g.forbidden, regraded: true })}
      where id = ${r.id} and (policy_ok is distinct from ${g.policy_ok} or route_ok is distinct from ${g.route_ok})`;
    changed += res.count;
  }
  console.log(`${batch}: ${rows.length} rows, ${changed} changed`);
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
