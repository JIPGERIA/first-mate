import { sql } from "@/lib/db";
import type { BrandKey } from "@/lib/brands";
import { getOrder, ORDER_STATUS, type Order } from "@/lib/commerce/cafe24";
import { isVerbatimInKb, loadKb } from "@/lib/kb";
import type { LLMProvider, LLMUsage } from "@/lib/llm/types";
import { DraftSchema, TriageSchema, type Draft, type Triage } from "./schemas";
import { DRAFT_SYSTEM, PROMPT_VERSION, TRIAGE_SYSTEM, draftUserMessage } from "./prompts";
import { decideRoute, ORDER_REQUIRED, type RouteInput } from "./route";

export type TicketInput = { id?: number; customer: string; body: string; brandHint?: string | null; channel?: string };
export type RunOptions = { evalCaseId?: string; evalBatch?: string; today?: string };

type StepRecord = { seq: number; name: string; status: "ok" | "error" | "skipped"; attempts: number; ms: number; detail?: unknown; error?: string };

/** 문의 1건을 끝까지 처리하고 모든 단계를 runs/steps에 남긴다. 반환값은 run id. */
export async function processTicket(llm: LLMProvider, t: TicketInput, opts: RunOptions = {}) {
  const [{ id: runId }] = await sql<{ id: number }[]>`
    insert into runs (ticket_id, eval_case_id, eval_batch, provider, prompt_version)
    values (${t.id ?? null}, ${opts.evalCaseId ?? null}, ${opts.evalBatch ?? null}, ${llm.name}, ${PROMPT_VERSION})
    returning id`;

  const steps: StepRecord[] = [];
  const usage: LLMUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, costUsdList: 0 };
  const addUsage = (u: LLMUsage) => {
    usage.inputTokens += u.inputTokens;
    usage.outputTokens += u.outputTokens;
    usage.cacheReadTokens += u.cacheReadTokens;
    usage.costUsdList += u.costUsdList;
  };
  async function step<T>(name: string, fn: () => Promise<{ value: T; attempts?: number; detail?: unknown }>): Promise<T | null> {
    const started = Date.now();
    try {
      const r = await fn();
      steps.push({ seq: steps.length + 1, name, status: "ok", attempts: r.attempts ?? 1, ms: Date.now() - started, detail: r.detail });
      return r.value;
    } catch (e) {
      const err = e as Error & { attempts?: number };
      steps.push({ seq: steps.length + 1, name, status: "error", attempts: err.attempts ?? 1, ms: Date.now() - started, error: err.message });
      return null;
    }
  }

  const started = Date.now();
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  let triage: Triage | null = null;
  let order: RouteInput["order"] = { status: "not_provided" };
  let draft: Draft | null = null;
  let ungrounded: string[] = [];

  // 1) 분류 — 빠른 모델
  triage = await step("triage", async () => {
    const hint = t.brandHint ? `[유입 채널] ${t.brandHint} 채널톡\n` : "";
    const r = await llm.structured({ tier: "fast", system: TRIAGE_SYSTEM, user: `${hint}[고객 문의]\n${t.body}`, schema: TriageSchema });
    addUsage(r.usage);
    return { value: r.data, detail: { model: r.model, ms: r.ms, ...r.data } };
  });

  if (triage) {
    const brand = triage.brand === "unknown" ? null : (triage.brand as BrandKey);

    // 2) 주문 조회 — 모델이 아니라 코드가 결정적으로 호출 (워크플로)
    if (triage.order_id && ORDER_REQUIRED.has(triage.intent) && triage.order_specific !== false) {
      const lookup = await step("order_lookup", async () => {
        const r = await getOrder(triage!.order_id!);
        return { value: r, attempts: r.attempts, detail: { order_id: triage!.order_id, found: r.found, x_api_call_limit: r.callLimit } };
      });
      if (!lookup) order = { status: "lookup_failed" };
      else if (!lookup.found) order = { status: "not_found" };
      else if (brand && lookup.order.brand !== brand) order = { status: "brand_mismatch" };
      else order = { status: "found", order: lookup.order };
    } else {
      steps.push({ seq: steps.length + 1, name: "order_lookup", status: "skipped", attempts: 0, ms: 0, detail: { reason: triage.order_id ? "주문 정보가 필요 없는 문의" : "주문번호 없음" } });
    }

    // 3) 초안 — 브랜드 KB 전체를 컨텍스트로 (RAG 없음, ADR-3)
    if (brand) {
      draft = await step("draft", async () => {
        const r = await llm.structured({
          tier: "smart",
          system: DRAFT_SYSTEM,
          stableContext: `[브랜드 KB]\n${loadKb(brand)}`,
          user: draftUserMessage({ today, customer: t.customer, body: t.body, triageSummary: triage!.summary, orderBlock: formatOrder(order) }),
          schema: DraftSchema,
        });
        addUsage(r.usage);
        const clean = { ...r.data, needs_human_reason: stripTags(r.data.needs_human_reason) };
        return { value: clean, detail: { model: r.model, ms: r.ms, citations: clean.citations.length } };
      });
      if (draft) ungrounded = draft.citations.filter((c) => !isVerbatimInKb(brand, c.quote)).map((c) => c.quote);
      steps.push({ seq: steps.length + 1, name: "grounding_check", status: "ok", attempts: 1, ms: 0, detail: { citations: draft?.citations.length ?? 0, ungrounded } });
    } else {
      steps.push({ seq: steps.length + 1, name: "draft", status: "skipped", attempts: 0, ms: 0, detail: { reason: "브랜드 미식별 — 어느 KB로 답할지 알 수 없음" } });
    }
  }

  // 4) 라우팅 — 규칙
  const decision = triage
    ? decideRoute({ triage, order, draft, ungroundedQuotes: ungrounded })
    : { route: "human_only" as const, reasons: ["분류 실패"] };
  steps.push({ seq: steps.length + 1, name: "route", status: "ok", attempts: 1, ms: 0, detail: decision });

  const failed = steps.some((s) => s.status === "error");
  await sql.begin(async (tx) => {
    await tx`
      update runs set
        status = ${failed ? "error" : "ok"},
        error = ${steps.filter((s) => s.error).map((s) => `${s.name}: ${s.error}`).join("\n") || null},
        finished_at = now(), total_ms = ${Date.now() - started},
        input_tokens = ${usage.inputTokens}, output_tokens = ${usage.outputTokens}, cache_read_tokens = ${usage.cacheReadTokens},
        cost_usd_list = ${usage.costUsdList.toFixed(5)},
        triage = ${triage ? tx.json(triage) : null},
        order_snapshot = ${order.status === "found" ? tx.json(order.order as never) : tx.json({ status: order.status })},
        route = ${decision.route}, route_reasons = ${tx.json(decision.reasons)},
        draft = ${draft?.reply ?? null}, citations = ${draft ? tx.json(draft.citations) : null}
      where id = ${runId}`;
    for (const s of steps) {
      await tx`insert into steps (run_id, seq, name, status, attempts, ms, detail, error)
               values (${runId}, ${s.seq}, ${s.name}, ${s.status}, ${s.attempts}, ${s.ms}, ${s.detail ? tx.json(s.detail as never) : null}, ${s.error ?? null})`;
    }
    if (t.id) await tx`update tickets set status = ${failed && !draft ? "failed" : "drafted"} where id = ${t.id}`;
  });

  return { runId, triage, order, draft, route: decision.route, reasons: decision.reasons, ungrounded };
}

/** 모델이 구조화 필드 안에 XML 태그 조각을 흘리는 경우가 있어 제거한다 (eval v1에서 발견). 빈 문자열은 null. */
function stripTags(v: string | null): string | null {
  const t = v?.replace(/<\/?[a-z_]+>/gi, "").trim();
  return t ? t : null;
}

function formatOrder(o: RouteInput["order"]): string {
  if (o.status !== "found") {
    const why = { not_provided: "고객이 주문번호를 제공하지 않음", not_found: "해당 주문번호로 조회된 주문 없음", lookup_failed: "주문 시스템 일시 장애로 조회 실패", brand_mismatch: "주문번호가 다른 브랜드 주문임" }[o.status];
    return `(주문 정보 없음: ${why})`;
  }
  const x: Order = o.order;
  const d = (v: string | null) => (v ? new Date(v).toISOString().slice(0, 10) : "-");
  return [
    `주문번호: ${x.order_id}`,
    `주문일: ${d(x.order_date)} / 결제금액: ${x.payment_amount.toLocaleString()}원 (배송비 ${x.shipping_fee.toLocaleString()}원)`,
    `주문상태: ${x.order_status} ${ORDER_STATUS[x.order_status] ?? ""}`,
    `출고일: ${d(x.shipped_date)} / 배송완료일: ${d(x.delivered_date)} / 택배사: ${x.courier ?? "-"} / 송장: ${x.tracking_no ?? "-"}`,
    `품목: ${x.items.map((i) => `${i.product_name}${i.option ? `(${i.option})` : ""} x${i.quantity}`).join(", ")}`,
  ].join("\n");
}
