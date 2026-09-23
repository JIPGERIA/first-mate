import { z } from "zod";
import { BRAND_KEYS, INTENT_KEYS } from "@/lib/brands";

export const RISK_FLAGS = ["compensation_request", "legal_threat", "safety", "abusive", "privacy", "multiple_issues"] as const;

export const TriageSchema = z.object({
  brand: z.enum([...BRAND_KEYS, "unknown"]).describe("문의 대상 브랜드. 단서가 없으면 unknown"),
  intent: z.enum(INTENT_KEYS as [string, ...string[]]).describe("주된 문의 의도 1개"),
  order_id: z.string().nullable().describe("본문에 있는 주문번호(YYYYMMDD-NNNNNNN). 없으면 null"),
  emotion: z.enum(["calm", "frustrated", "angry"]),
  risk_flags: z.array(z.enum(RISK_FLAGS)).describe("해당하는 위험 신호 전부. 없으면 빈 배열"),
  summary: z.string().describe("상담원이 3초 안에 파악할 한 줄 요약"),
  confidence: z.number().min(0).max(1).describe("분류 확신도"),
});
export type Triage = z.infer<typeof TriageSchema>;

export const DraftSchema = z.object({
  reply: z.string().describe("고객에게 보낼 답변 전문"),
  citations: z
    .array(z.object({ section: z.string(), quote: z.string().describe("KB에서 그대로 복사한 문장") }))
    .describe("답변 근거가 된 정책 문장. KB 원문 그대로"),
  needs_human_reason: z
    .string()
    .nullable()
    .describe("KB로 답할 수 없거나, 정책이 모호·상충하거나, 사람의 판단이 필요한 이유. 없으면 null"),
});
export type Draft = z.infer<typeof DraftSchema>;
