import Link from "next/link";
import { notFound } from "next/navigation";
import { ORDER_STATUS, type Order } from "@/lib/commerce/cafe24";
import { ticketDetail, ticketIdsByCase } from "@/lib/queries";
import { EMOTION_LABEL, RISK_LABEL, ROUTE_EXPECT, TOUR } from "@/lib/present";
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

export default async function TicketPage({ params, searchParams }: PageProps<"/tickets/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const d = await ticketDetail(Number(id));
  if (!d) notFound();
  const { ticket, run, steps, review, evalResult, prev, next } = d;
  const triage = run?.triage;
  const order = run?.order_snapshot as (Order & { status?: string }) | null;
  const ungrounded: string[] = steps.find((s) => s.name === "grounding_check")?.detail?.ungrounded ?? [];

  const tourIdx = TOUR.findIndex((t) => t.caseId === ticket.case_id);
  const inTour = sp.tour !== undefined && tourIdx >= 0;
  const tourIds = inTour ? await ticketIdsByCase(TOUR.map((t) => t.caseId)) : null;
  const tourHref = (i: number) => `/tickets/${tourIds?.get(TOUR[i].caseId)?.id}?tour=${i + 1}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <Link href={inTour ? "/" : "/inbox"} className="shrink-0 text-muted hover:text-ink">← {inTour ? "둘러보기" : "받은함"}</Link>
          <span className="text-muted">/</span>
          <span className="truncate font-medium">{ticket.case_id ?? `#${ticket.id}`}</span>
        </div>
        {!inTour && (
          <div className="flex gap-1 text-xs">
            {prev && <Link href={`/tickets/${prev.id}`} className="rounded-md border border-line bg-white px-2.5 py-1 hover:border-muted">← {prev.case_id ?? `#${prev.id}`}</Link>}
            {next && <Link href={`/tickets/${next.id}`} className="rounded-md border border-line bg-white px-2.5 py-1 hover:border-muted">{next.case_id ?? `#${next.id}`} →</Link>}
          </div>
        )}
      </div>

      {inTour && (
        <section className="rounded-lg border border-accent/30 bg-accent/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-medium text-accent">둘러보기 {tourIdx + 1} / {TOUR.length}</div>
            <div className="flex gap-1.5">
              {TOUR.map((t, i) => (
                <span key={t.caseId} className={`h-1.5 w-8 rounded-full ${i <= tourIdx ? "bg-accent" : "bg-accent/20"}`} />
              ))}
            </div>
          </div>
          <h1 className="mt-2 text-lg font-bold">{TOUR[tourIdx].headline}</h1>
          <div className="mt-2 text-xs font-medium text-muted">여기서 볼 것</div>
          <ol className="mt-1 space-y-1 text-sm leading-relaxed">
            {TOUR[tourIdx].hints.map((h, i) => (
              <li key={i} className="flex gap-2"><span className="font-mono text-xs leading-6 text-accent">{i + 1}</span><span>{h}</span></li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            {tourIdx > 0 && <Link href={tourHref(tourIdx - 1)} className="rounded-md border border-line bg-white px-3 py-1.5 text-sm hover:border-muted">← 이전</Link>}
            {tourIdx < TOUR.length - 1 ? (
              <Link href={tourHref(tourIdx + 1)} className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90">다음: {TOUR[tourIdx + 1].headline} →</Link>
            ) : (
              <Link href="/eval" className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90">마지막: 어떻게 측정했나 (평가) →</Link>
            )}
          </div>
        </section>
      )}

      {ticket.case_id && (
        <section className="flex flex-wrap items-start gap-x-6 gap-y-2 rounded-lg border border-line bg-white px-4 py-3 text-sm">
          <div className="min-w-0 flex-1 basis-64">
            <div className="text-xs text-muted">이 케이스가 시험하는 것</div>
            <div className="mt-0.5 font-medium">{ticket.scenario}</div>
          </div>
          {evalResult && (
            <dl className="flex flex-wrap gap-x-6 gap-y-2">
              <div><dt className="text-xs text-muted">기대 경로</dt><dd className="mt-0.5">{ROUTE_EXPECT[evalResult.expected.route] ?? evalResult.expected.route}</dd></div>
              <div><dt className="text-xs text-muted">실제</dt><dd className="mt-0.5"><RouteBadge route={run?.route ?? null} /></dd></div>
              <div>
                <dt className="text-xs text-muted">채점</dt>
                <dd className="mt-0.5">
                  {evalResult.unsafe_auto ? <b className="text-only">위험한 자동화</b>
                    : evalResult.route_ok === false ? <span className="text-review">경로 다름</span>
                    : evalResult.policy_ok === false ? <span className="text-review">정책 문구 오류</span>
                    : <span className="text-auto">통과 ✓</span>}
                </dd>
              </div>
            </dl>
          )}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-4">
          <Card title="고객 문의" right={<span className="text-xs text-muted">채널톡 · {ticket.customer}</span>}>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{ticket.body}</p>
          </Card>
          {triage && (
            <Card title="① 분류" right={<span className="text-xs text-muted">확신도 {pct(triage.confidence)}</span>}>
              <dl className="grid grid-cols-[5rem_1fr] gap-y-1.5 text-sm">
                <dt className="text-muted">브랜드</dt><dd><BrandTag brand={triage.brand} /></dd>
                <dt className="text-muted">의도</dt><dd>{intentLabel(triage.intent)}{triage.order_specific === false && <span className="ml-1 text-xs text-muted">(특정 주문 문의 아님)</span>}</dd>
                <dt className="text-muted">감정</dt><dd>{EMOTION_LABEL[triage.emotion as string] ?? triage.emotion}</dd>
                <dt className="text-muted">위험 신호</dt>
                <dd className="flex flex-wrap gap-1">
                  {triage.risk_flags.length ? (triage.risk_flags as string[]).map((f) => <span key={f} className="rounded bg-only/10 px-1.5 py-0.5 text-xs text-only">{RISK_LABEL[f] ?? f}</span>) : <span className="text-muted">없음</span>}
                </dd>
                <dt className="text-muted">요약</dt><dd>{triage.summary}</dd>
              </dl>
            </Card>
          )}
          <Card title="② 주문 정보" right={<span className="text-xs text-muted">Cafe24 Admin API 형태 목업</span>}>
            {order && !order.status ? (
              <dl className="grid grid-cols-[5rem_1fr] gap-y-1.5 text-sm">
                <dt className="text-muted">주문번호</dt><dd className="font-mono text-xs leading-5">{order.order_id}</dd>
                <dt className="text-muted">상태</dt><dd>{ORDER_STATUS[order.order_status] ?? order.order_status} <span className="font-mono text-xs text-muted">{order.order_status}</span></dd>
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
            <>
              <Card title="⑤ 라우팅 판단" right={<RouteBadge route={run.route} />}>
                <div className="text-xs text-muted">코드 규칙이 남긴 사유 · 상담원에게 그대로 보입니다</div>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {(run.route_reasons as string[]).map((r) => (
                    <li key={r} className="flex gap-2"><span className="text-muted">•</span><span className="leading-relaxed">{r}</span></li>
                  ))}
                </ul>
              </Card>
              <Card title="③ 답변 초안" right={<span className="text-xs text-muted">시연용 · 실제로 발송되지 않음</span>}>
                {review && (
                  <div className="mb-3 rounded-md bg-paper px-3 py-2 text-xs ring-1 ring-line">
                    최근 처리: {{ approved: "그대로 승인", edited: "수정 후 승인", rejected: "반려" }[review.action as string]} · 수정률 {pct(review.edit_ratio)}
                  </div>
                )}
                {run.draft ? (
                  <DraftEditor ticketId={ticket.id} runId={run.id} draft={run.draft} />
                ) : (
                  <p className="text-sm text-muted">초안 없음 — 상담원이 직접 응대합니다.</p>
                )}
              </Card>
            </>
          ) : (
            <Card title="답변 초안"><p className="text-sm text-muted">아직 처리되지 않은 문의입니다.</p></Card>
          )}

          {run?.citations?.length > 0 && (
            <Card title="④ 정책 근거" right={<span className="text-xs text-muted">✓ = KB 원문에 있음</span>}>
              <ul className="space-y-3 text-sm">
                {(run.citations as { section: string; quote: string }[]).map((c, i) => {
                  const bad = ungrounded.includes(c.quote);
                  return (
                    <li key={i} className="flex gap-2">
                      <span className={bad ? "text-only" : "text-auto"}>{bad ? "✗" : "✓"}</span>
                      <div className="min-w-0"><div className="text-xs text-muted">{c.section}</div><div className="whitespace-pre-line leading-relaxed">{c.quote}</div></div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
      </div>

      {run && (
        <Card title="실행 트레이스" right={<span className="text-xs text-muted">단계를 누르면 입력·출력이 펼쳐집니다</span>}>
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span>{run.provider === "replay" ? "기록 재생" : "Claude Code 구독"} · prompt {run.prompt_version}</span>
            <span>총 {secs(run.total_ms)}</span>
            <span>토큰 입력 {run.input_tokens.toLocaleString()} / 출력 {run.output_tokens.toLocaleString()}</span>
            <span title="구독 실행이라 실제 과금은 0원">API 정가 환산 ${Number(run.cost_usd_list).toFixed(4)}</span>
          </div>
          <ol className="space-y-2">
            {steps.map((s) => (
              <li key={s.id} className="text-sm">
                <details>
                  <summary className="flex cursor-pointer items-center gap-2">
                    <span className={s.status === "ok" ? "text-auto" : s.status === "error" ? "text-only" : "text-muted"}>{s.status === "ok" ? "●" : s.status === "error" ? "✕" : "○"}</span>
                    <span>{STEP_LABEL[s.name] ?? s.name}</span>
                    <span className="text-xs text-muted">{s.status === "skipped" ? "건너뜀" : s.ms ? secs(s.ms) : ""}{s.attempts > 1 ? ` · 재시도 포함 ${s.attempts}회` : ""}</span>
                  </summary>
                  <pre className="mt-1 overflow-x-auto rounded bg-paper p-2 text-xs text-muted">{JSON.stringify(s.error ? { error: s.error } : s.detail, null, 2)}</pre>
                </details>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}
