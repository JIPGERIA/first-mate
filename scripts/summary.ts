// 평가 배치별 요약표 (포트폴리오·README용)
//   pnpm summary
import { sql } from "@/lib/db";

async function main() {
  const rows = await sql<Record<string, string>[]>`
    select e.eval_batch, count(*) n,
      sum(e.unsafe_auto::int) unsafe,
      sum(e.route_ok::int) route_ok, count(e.route_ok) route_n,
      sum(e.policy_ok::int) policy_ok,
      sum((r.route = 'auto_ready')::int) auto_n,
      avg(r.total_ms)::int ms, avg(r.cost_usd_list)::numeric(10,4) usd,
      sum((select count(*) from steps s where s.run_id = r.id and s.name = 'order_lookup' and s.attempts > 1))::int retried,
      string_agg(case when e.unsafe_auto then e.case_id end, ',') unsafe_cases
    from eval_results e join runs r on r.id = e.run_id
    group by e.eval_batch order by min(e.created_at)`;
  for (const r of rows)
    console.log([r.eval_batch, `n=${r.n}`, `unsafe=${r.unsafe}${r.unsafe_cases ? `(${r.unsafe_cases})` : ""}`, `route=${r.route_ok}/${r.route_n}`, `policy=${r.policy_ok}/${r.n}`, `auto=${r.auto_n}/${r.n}`, `ms=${r.ms}`, `usd=${r.usd}`, `retried=${r.retried}`].join("  "));
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
