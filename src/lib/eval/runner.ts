import { sql } from "@/lib/db";
import type { LLMProvider } from "@/lib/llm/types";
import { processTicket } from "@/lib/pipeline/run";
import { PROMPT_VERSION } from "@/lib/pipeline/prompts";
import { grade, loadGolden, type EvalSet } from "./golden";

export type EvalOptions = { set: EvalSet; llm: LLMProvider; concurrency: number; only?: Set<string>; label?: string; quiet?: boolean };

/** 세트 하나를 파이프라인에 통과시키고 채점해 eval_results에 남긴다. 반환값은 배치 이름. */
export async function runEval({ set, llm, concurrency, only, label, quiet }: EvalOptions): Promise<string> {
  const { today, cases } = loadGolden(set);
  const targets = cases.filter((c) => !only?.size || only.has(c.id));
  const batch = `${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}-${set}-${PROMPT_VERSION}${label ? `-${label}` : ""}`;
  if (!quiet) console.log(`eval batch ${batch}: ${targets.length} cases, provider=${llm.name}, concurrency=${concurrency}`);

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
      if (quiet) continue;
      const mark = (b: boolean | null) => (b === null ? "·" : b ? "✓" : "✗");
      console.log(`[${String(done).padStart(2)}/${targets.length}] ${c.id} brand${mark(g.brand_ok)} intent${mark(g.intent_ok)} route${mark(g.route_ok)} policy${mark(g.policy_ok)}${g.unsafe_auto ? " ⚠UNSAFE_AUTO" : ""}  → ${r.route}  ${[...g.missing.map((m) => `missing:${m}`), ...g.forbidden.map((f) => `forbidden:${f}`)].join(" ")}`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return batch;
}

export type BatchSummary = { batch: string; n: number; unsafe: number; unsafeCases: string | null; routeOk: number; routeN: number; policyOk: number; auto: number; ms: number; usd: number; retried: number };

export async function summarize(batchLike = "%"): Promise<BatchSummary[]> {
  const rows = await sql<Record<string, string | null>[]>`
    select e.eval_batch, count(*) n, sum(e.unsafe_auto::int) unsafe, string_agg(case when e.unsafe_auto then e.case_id end, ',') unsafe_cases,
      sum(e.route_ok::int) route_ok, count(e.route_ok) route_n, sum(e.policy_ok::int) policy_ok,
      sum((r.route = 'auto_ready')::int) auto_n, avg(r.total_ms) ms, avg(r.cost_usd_list) usd,
      sum((select count(*) from steps s where s.run_id = r.id and s.name = 'order_lookup' and s.attempts > 1)) retried
    from eval_results e join runs r on r.id = e.run_id
    where e.eval_batch like ${batchLike}
    group by e.eval_batch order by min(e.created_at)`;
  return rows.map((r) => ({
    batch: r.eval_batch!, n: +r.n!, unsafe: +r.unsafe!, unsafeCases: r.unsafe_cases, routeOk: +r.route_ok!, routeN: +r.route_n!,
    policyOk: +r.policy_ok!, auto: +r.auto_n!, ms: Math.round(+r.ms!), usd: +r.usd!, retried: +r.retried!,
  }));
}

export function formatSummary(s: BatchSummary): string {
  return [s.batch.padEnd(34), `n=${s.n}`, `위험한자동화=${s.unsafe}${s.unsafeCases ? `(${s.unsafeCases})` : ""}`, `라우팅=${s.routeOk}/${s.routeN}`, `정책=${s.policyOk}/${s.n}`, `원클릭=${s.auto}/${s.n}`, `재시도발생=${s.retried}`].join("  ");
}
