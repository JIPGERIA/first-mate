// 골든셋 전체를 파이프라인으로 처리하고 채점한다.
//   pnpm eval               → 전체
//   pnpm eval C01 C13       → 일부 케이스만
//   EVAL_SET=holdout pnpm eval → 홀드아웃 세트
// 환경변수: LLM_PROVIDER(claude-code|anthropic-api), EVAL_CONCURRENCY(기본 4), MOCK_FAULT_RATE(주문 API 장애율)
import { sql } from "@/lib/db";
import { getProvider } from "@/lib/llm";
import { processTicket } from "@/lib/pipeline/run";
import { grade, loadGolden, type EvalSet } from "@/lib/eval/golden";

async function main() {
  const only = new Set(process.argv.slice(2));
  const set = (process.env.EVAL_SET ?? "golden") as EvalSet;
  const { today, cases } = loadGolden(set);
  const targets = cases.filter((c) => only.size === 0 || only.has(c.id));
  const llm = await getProvider();
  const batch = `${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}-${set}-${process.env.PROMPT_VERSION ?? "v2"}`;
  const concurrency = Number(process.env.EVAL_CONCURRENCY ?? 4);
  console.log(`eval batch ${batch}: ${targets.length} cases, provider=${llm.name}, concurrency=${concurrency}`);

  const queue = [...targets];
  let done = 0;
  async function worker() {
    for (let c = queue.shift(); c; c = queue.shift()) {
      const [ticket] = await sql<{ id: number }[]>`select id from tickets where case_id = ${c.id}`;
      if (!ticket) throw new Error(`ticket for ${c.id} not seeded — run pnpm seed`);
      const r = await processTicket(llm, { id: ticket.id, customer: c.customer, body: c.body, brandHint: c.brand_hint }, { evalCaseId: c.id, evalBatch: batch, today });
      const g = grade(c, { brand: r.triage?.brand, intent: r.triage?.intent, route: r.route, reply: r.draft?.reply ?? null });
      await sql`
        insert into eval_results (eval_batch, case_id, run_id, expected, actual, brand_ok, intent_ok, route_ok, unsafe_auto, policy_ok)
        values (${batch}, ${c.id}, ${r.runId}, ${sql.json(c.expect)},
                ${sql.json({ brand: r.triage?.brand, intent: r.triage?.intent, route: r.route, reasons: r.reasons, missing: g.missing, forbidden: g.forbidden, ungrounded: r.ungrounded })},
                ${g.brand_ok}, ${g.intent_ok}, ${g.route_ok}, ${g.unsafe_auto}, ${g.policy_ok})`;
      done++;
      const mark = (b: boolean | null) => (b === null ? "·" : b ? "✓" : "✗");
      console.log(`[${String(done).padStart(2)}/${targets.length}] ${c.id} brand${mark(g.brand_ok)} intent${mark(g.intent_ok)} route${mark(g.route_ok)} policy${mark(g.policy_ok)}${g.unsafe_auto ? " ⚠UNSAFE_AUTO" : ""}  → ${r.route}  ${[...g.missing.map((m) => `missing:${m}`), ...g.forbidden.map((f) => `forbidden:${f}`)].join(" ")}`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));

  const [s] = await sql<Record<string, string>[]>`
    select count(*) n,
      avg(brand_ok::int) brand, avg(intent_ok::int) intent,
      avg(route_ok::int) filter (where route_ok is not null) route,
      sum(unsafe_auto::int) unsafe, avg(policy_ok::int) policy
    from eval_results where eval_batch = ${batch}`;
  const [cost] = await sql<Record<string, string>[]>`select avg(total_ms) ms, avg(cost_usd_list) usd from runs where eval_batch = ${batch}`;
  const pct = (v: string) => `${(Number(v) * 100).toFixed(1)}%`;
  console.log(`\n== ${batch}\nbrand ${pct(s.brand)} · intent ${pct(s.intent)} · route ${pct(s.route)} · policy ${pct(s.policy)} · unsafe_auto ${s.unsafe}건 · 평균 ${(Number(cost.ms) / 1000).toFixed(1)}s · 건당 API정가환산 $${Number(cost.usd).toFixed(4)}`);
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
