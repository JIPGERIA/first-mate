import type { Route } from "@/lib/brands";
import type { Order } from "@/lib/commerce/cafe24";
import { kbIssuesFor } from "@/lib/kb";
import type { Draft, Triage } from "./schemas";

export const ORDER_REQUIRED = new Set(["shipping_status", "damaged_defect", "exchange_return", "cancel_change", "refund_status"]);

export type RouteInput = {
  triage: Triage;
  order: { status: "found"; order: Order } | { status: "not_found" | "not_provided" | "lookup_failed" | "brand_mismatch" };
  draft: Draft | null;
  ungroundedQuotes: string[];
};

export type RouteDecision = { route: Route; reasons: string[] };

/**
 * "자동화할 부분 vs 사람이 할 부분"을 코드로 명시한 규칙. LLM이 아니라 규칙이 최종 결정을 내린다.
 * - human_only: 사람이 처음부터 직접 응대해야 하는 경우 (초안은 참고용)
 * - human_review: 초안은 쓸 만하지만 사람이 확인·수정해야 하는 경우
 * - auto_ready: 원클릭 승인 후보 (MVP에서는 자동 발송하지 않는다)
 */
export function decideRoute({ triage, order, draft, ungroundedQuotes }: RouteInput): RouteDecision {
  const only: string[] = [];
  const review: string[] = [];
  const f = new Set(triage.risk_flags);

  if (f.has("legal_threat")) only.push("법적 대응 언급");
  if (f.has("safety")) only.push("신체 안전 이슈");
  if (f.has("abusive")) only.push("욕설·공격적 표현");
  if (triage.intent === "complaint_escalation") only.push("강한 불만·보상 요구");
  if (!draft && triage.brand !== "unknown") only.push("초안 생성 실패");

  if (f.has("compensation_request")) review.push("정책 외 보상 요구");
  if (f.has("privacy")) review.push("개인정보 변경 요청 — 본인 확인 필요");
  if (f.has("multiple_issues")) review.push("요청이 2개 이상");
  if (triage.brand === "unknown") review.push("브랜드 식별 불가");
  if (triage.confidence < 0.7) review.push(`분류 확신도 낮음 (${triage.confidence.toFixed(2)})`);

  if (ORDER_REQUIRED.has(triage.intent) && triage.order_specific !== false) {
    if (order.status === "not_provided") review.push("주문번호 없음 — 주문 특정 필요");
    if (order.status === "not_found") review.push("주문번호 조회 결과 없음");
    if (order.status === "lookup_failed") review.push("주문 조회 API 실패 (재시도 소진)");
    if (order.status === "brand_mismatch") review.push("주문 브랜드와 문의 브랜드 불일치");
  }
  if (order.status === "found" && triage.intent === "cancel_change" && ["N20", "N21", "N22", "N30", "N40"].includes(order.order.order_status)) {
    review.push("배송준비 이후 취소·변경 — 물류 확인 필요");
  }
  for (const issue of kbIssuesFor(triage.brand, triage.intent)) review.push(`KB 결함 ${issue.id}: ${issue.title}`);
  if (triage.intent === "damaged_defect") review.push("파손·불량 — 사진 증빙 확인과 재발송 처리 필요");
  if (draft?.needs_human_reason) review.push(`코파일럿 판단: ${draft.needs_human_reason}`);
  if (draft && draft.citations.length === 0 && triage.intent !== "product_question") review.push("정책 근거 인용 없음");
  if (ungroundedQuotes.length > 0) review.push(`KB에 없는 인용 ${ungroundedQuotes.length}건`);
  if (triage.emotion === "angry") review.push("고객 감정 격앙");

  if (only.length) return { route: "human_only", reasons: [...only, ...review] };
  if (review.length) return { route: "human_review", reasons: review };
  return { route: "auto_ready", reasons: ["규칙 위반 없음 · 정책 근거 확인됨"] };
}
