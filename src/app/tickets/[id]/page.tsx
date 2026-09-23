import Link from "next/link";
import { notFound } from "next/navigation";
import { ORDER_STATUS, type Order } from "@/lib/commerce/cafe24";
import { ticketDetail } from "@/lib/queries";
import { BrandTag, Card, RouteBadge, intentLabel, pct, secs } from "@/components/ui";
import { DraftEditor } from "./draft-editor";

export const dynamic = "force-dynamic";

const STEP_LABEL: Record<string, string> = {
  triage: "① 분류 (Haiku)",
  order_lookup: "② 주문 조회 (Cafe24 API)",
  draft: "③ 초안 (Sonnet + 브랜드 KB)",
  grounding_check: "④ 인용 근거 검증",
  route: "⑤ 라우팅 규칙",
};

export default async function TicketPage({ params }: PageProps<"/tickets/[id]">) {
  const { id } = await params;
  const d = await ticketDetail(Number(id));
  if (!d) notFound();
  const { ticket, run, steps, review } = d;
  const triage = run?.triage;
  const order = run?.order_snapshot as (Order & { status?: string }) | null;
  const ungrounded: string[] = steps.find((s) => s.name === "grounding_check")?.detail?.ungrounded ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href="/" className="text-muted hover:text-ink">← 받은함</Link>
        <span className="text-muted">/</span>
        <span className="font-medium">#{ticket.id} {ticket.customer}</span>
        {ticket.case_id && <span className="rounded bg-paper px-1.5 py-0.5 text-xs text-muted ring-1 ring-line">골든셋 {ticket.case_id} · {ticket.scenario}</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-4">
          <Card title="고객 문의" right={<span className="text-xs text-muted">{ticket.channel} · {ticket.brand_hint ?? "채널 정보 없음"}</span>}>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{ticket.body}</p>
          </Card>
          {triage && (
            <Card title="분류" right={<span className="text-xs text-muted">확신도 {pct(triage.confidence)}</span>}>
              <dl className="grid grid-cols-[5rem_1fr] gap-y-1.5 text-sm">
                <dt className="text-muted">브랜드</dt><dd><BrandTag brand={triage.brand} /></dd>
                <dt className="text-muted">의도</dt><dd>{intentLabel(triage.intent)}</dd>
                <dt className="text-muted">감정</dt><dd>{{ calm: "차분", frustrated: "답답함", angry: "격앙" }[triage.emotion as string]}</dd>
                <dt className="text-muted">위험 신호</dt><dd>{triage.risk_flags.length ? triage.risk_flags.join(", ") : "없음"}</dd>
                <dt className="text-muted">요약</dt><dd>{triage.summary}</dd>
              </dl>
            </Card>
          )}
          <Card title="주문 정보 (Cafe24 조회)">
            {order && !order.status ? (
              <dl className="grid grid-cols-[5rem_1fr] gap-y-1.5 text-sm">
                <dt className="text-muted">주문번호</dt><dd className="font-mono text-xs">{order.order_id}</dd>
                <dt className="text-muted">상태</dt><dd>{order.order_status} {ORDER_STATUS[order.order_status]}</dd>
                <dt className="text-muted">결제</dt><dd>{order.payment_amount.toLocaleString()}원</dd>
                <dt className="text-muted">송장</dt><dd>{order.courier ? `${order.courier} ${order.tracking_no}` : "-"}</dd>
                <dt className="text-muted">품목</dt><dd>{order.items.map((i) => `${i.product_name}${i.option ? `(${i.option})` : ""} ×${i.quantity}`).join(", ")}</dd>
              </dl>
            ) : (
              <p className="text-sm text-muted">{{ not_provided: "주문번호 없음", not_found: "조회 결과 없음", lookup_failed: "조회 실패 (재시도 소진)", brand_mismatch: "다른 브랜드의 주문" }[order?.status ?? "not_provided"] ?? "해당 없음"}</p>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          {run ? (
            <Card title="답변 초안" right={<RouteBadge route={run.route} />}>
              <ul className="mb-3 space-y-1 text-xs">
                {(run.route_reasons as string[]).map((r) => (
                  <li key={r} className="flex gap-1.5"><span className="text-muted">•</span>{r}</li>
                ))}
              </ul>
              {review && (
                <div className="mb-3 rounded-md bg-paper px-3 py-2 text-xs ring-1 ring-line">
                  처리됨: {{ approved: "그대로 승인", edited: "수정 후 발송", rejected: "반려" }[review.action as string]} · 수정률 {pct(review.edit_ratio)}
                </div>
              )}
              {run.draft ? (
                <DraftEditor ticketId={ticket.id} runId={run.id} draft={review?.final_text ?? run.draft} disabled={!!review} />
              ) : (
                <p className="text-sm text-muted">초안 없음 — 상담원이 직접 응대합니다.</p>
              )}
            </Card>
          ) : (
            <Card title="답변 초안"><p className="text-sm text-muted">아직 처리되지 않은 문의입니다.</p></Card>
          )}

          {run?.citations?.length > 0 && (
            <Card title="정책 근거" right={<span className="text-xs text-muted">KB 원문 대조</span>}>
              <ul className="space-y-2 text-sm">
                {(run.citations as { section: string; quote: string }[]).map((c, i) => {
                  const bad = ungrounded.includes(c.quote);
                  return (
                    <li key={i} className="flex gap-2">
                      <span className={bad ? "text-only" : "text-auto"}>{bad ? "✗" : "✓"}</span>
                      <div><div className="text-xs text-muted">{c.section}</div><div className="leading-relaxed">{c.quote}</div></div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {run && (
            <Card title="실행 트레이스" right={<span className="text-xs text-muted">{run.provider} · prompt {run.prompt_version} · {secs(run.total_ms)} · 입력 {run.input_tokens.toLocaleString()} / 출력 {run.output_tokens.toLocaleString()} tok · 정가환산 ${Number(run.cost_usd_list).toFixed(4)}</span>}>
              <ol className="space-y-2">
                {steps.map((s) => (
                  <li key={s.id} className="text-sm">
                    <details>
                      <summary className="flex cursor-pointer items-center gap-2">
                        <span className={s.status === "ok" ? "text-auto" : s.status === "error" ? "text-only" : "text-muted"}>{s.status === "ok" ? "●" : s.status === "error" ? "✕" : "○"}</span>
                        <span>{STEP_LABEL[s.name] ?? s.name}</span>
                        <span className="text-xs text-muted">{s.ms ? secs(s.ms) : ""}{s.attempts > 1 ? ` · 시도 ${s.attempts}회` : ""}</span>
                      </summary>
                      <pre className="mt-1 overflow-x-auto rounded bg-paper p-2 text-xs text-muted">{JSON.stringify(s.error ? { error: s.error } : s.detail, null, 2)}</pre>
                    </details>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
