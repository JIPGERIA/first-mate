import { sql } from "@/lib/db";

export type InboxRow = {
  id: number; case_id: string | null; customer: string; body: string; brand_hint: string | null; status: string; received_at: string; scenario: string | null;
  run_id: number | null; route: string | null; triage: { brand: string; intent: string; summary: string; emotion: string } | null; total_ms: number | null;
};

export async function inbox() {
  return sql<InboxRow[]>`
    select t.id, t.case_id, t.customer, t.body, t.brand_hint, t.status, t.received_at, t.scenario,
           r.id run_id, r.route, r.triage, r.total_ms
    from tickets t
    left join lateral (select * from runs where ticket_id = t.id order by started_at desc limit 1) r on true
    order by t.received_at desc`;
}

export async function ticketDetail(id: number) {
  const [ticket] = await sql`select * from tickets where id = ${id}`;
  if (!ticket) return null;
  const [run] = await sql`select * from runs where ticket_id = ${id} order by started_at desc limit 1`;
  const steps = run ? await sql`select * from steps where run_id = ${run.id} order by seq` : [];
  const [review] = await sql`select * from reviews where ticket_id = ${id} order by created_at desc limit 1`;
  return { ticket, run, steps, review };
}

export async function evalBatches() {
  return sql<Record<string, string>[]>`
    select e.eval_batch, min(e.created_at) created_at, count(*) n,
      avg(e.brand_ok::int) brand, avg(e.intent_ok::int) intent,
      avg(e.route_ok::int) filter (where e.route_ok is not null) route,
      sum(e.unsafe_auto::int) unsafe, avg(e.policy_ok::int) policy,
      avg((r.route = 'auto_ready')::int) auto_rate,
      avg(r.total_ms) ms, avg(r.cost_usd_list) usd, max(r.prompt_version) prompt_version,
      sum(case when r.status = 'error' then 1 else 0 end) errors
    from eval_results e join runs r on r.id = e.run_id
    group by e.eval_batch order by min(e.created_at) desc`;
}

export async function evalCases(batch: string) {
  return sql`
    select e.*, r.ticket_id, r.route, r.total_ms from eval_results e left join runs r on r.id = e.run_id
    where e.eval_batch = ${batch} order by e.case_id`;
}

export async function reviewStats() {
  const [s] = await sql<Record<string, string>[]>`
    select count(*) n, avg(edit_ratio) edit, sum((action = 'approved')::int) approved, sum((action = 'edited')::int) edited, sum((action = 'rejected')::int) rejected from reviews`;
  return s;
}
