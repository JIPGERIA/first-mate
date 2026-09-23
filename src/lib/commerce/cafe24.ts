import { createHash } from "node:crypto";
import { sql } from "@/lib/db";
import { RetryableError, withRetry } from "@/lib/retry";

export type OrderItem = { product_name: string; option?: string; quantity: number; price: number };
export type Order = {
  order_id: string;
  brand: string;
  buyer_name: string;
  order_date: string;
  payment_amount: number;
  shipping_fee: number;
  order_status: string;
  shipped_date: string | null;
  delivered_date: string | null;
  courier: string | null;
  tracking_no: string | null;
  items: OrderItem[];
};

export const ORDER_STATUS: Record<string, string> = {
  N00: "입금전",
  N10: "상품준비중",
  N20: "배송준비중",
  N30: "배송중",
  N40: "배송완료",
  C00: "취소신청",
  C40: "취소완료",
  R00: "반품신청",
  R40: "반품완료(환불완료)",
};

type HttpLike = { status: number; headers: Record<string, string>; body: unknown };

// ---------------------------------------------------------------------------
// 목업 서버: Cafe24 Admin API처럼 응답한다 (leaky bucket 호출 제한 + 간헐적 5xx).
// 실제 연동 시 이 함수만 fetch(`https://{mall}.cafe24api.com/api/v2/admin/orders/{id}`)로 교체한다.
// ---------------------------------------------------------------------------
// 출처: https://apidocs.cafe24.com/docs/guide/api-quota — Admin API 버킷 용량 40, 초당 2회 감소
const BUCKET_SIZE = Number(process.env.MOCK_BUCKET_SIZE ?? "40");
const LEAK_PER_SEC = 2;
const bucket = { level: 0, at: Date.now() };
const callCount = new Map<string, number>();

/** 장애를 난수가 아니라 (주문번호, 호출 순번)으로 결정한다 → 같은 설정이면 재시도 경로까지 매번 같게 재현된다 */
function injectedFault(orderId: string, rate: number): boolean {
  const n = (callCount.get(orderId) ?? 0) + 1;
  callCount.set(orderId, n);
  const h = createHash("sha256").update(`${orderId}#${n}`).digest().readUInt32BE(0);
  return h / 0xffffffff < rate;
}

function takeToken(): { ok: boolean; level: number } {
  const now = Date.now();
  bucket.level = Math.max(0, bucket.level - ((now - bucket.at) / 1000) * LEAK_PER_SEC);
  bucket.at = now;
  if (bucket.level + 1 > BUCKET_SIZE) return { ok: false, level: bucket.level };
  bucket.level += 1;
  return { ok: true, level: bucket.level };
}

async function mockCafe24GetOrder(orderId: string): Promise<HttpLike> {
  const faultRate = Number(process.env.MOCK_FAULT_RATE ?? "0");
  const token = takeToken();
  const limit = `${Math.ceil(token.level)}/${BUCKET_SIZE}`;
  if (!token.ok) return { status: 429, headers: { "x-api-call-limit": `${BUCKET_SIZE}/${BUCKET_SIZE}` }, body: { error: { code: 429, message: "Too Many Requests" } } };
  if (injectedFault(orderId, faultRate)) return { status: 503, headers: { "x-api-call-limit": limit }, body: { error: { code: 503, message: "Service Unavailable" } } };

  const rows = await sql<Order[]>`select * from orders where order_id = ${orderId}`;
  if (rows.length === 0) return { status: 404, headers: { "x-api-call-limit": limit }, body: { error: { code: 404, message: "No API found" } } };
  return { status: 200, headers: { "x-api-call-limit": limit }, body: { order: rows[0] } };
}

// ---------------------------------------------------------------------------
// 클라이언트: 429/5xx는 지수 백오프로 재시도, 404는 "주문 없음"으로 정상 처리.
// Cafe24 권장대로 X-Api-Call-Limit 사용률이 80%를 넘으면 다음 호출 전에 1초 쉰다(사후 대응보다 사전 감속).
// ---------------------------------------------------------------------------
let lastUsage = 0;

function usageRatio(header: string): number {
  const [used, cap] = header.split("/").map(Number);
  return cap ? used / cap : 0;
}

export type OrderLookup =
  | { found: true; order: Order; attempts: number; callLimit: string }
  | { found: false; attempts: number; callLimit: string };

export async function getOrder(orderId: string): Promise<OrderLookup> {
  let callLimit = "";
  const { value, attempts } = await withRetry(async () => {
    if (lastUsage > 0.8) await new Promise((r) => setTimeout(r, 1000));
    const res = await mockCafe24GetOrder(orderId);
    callLimit = res.headers["x-api-call-limit"] ?? "";
    lastUsage = usageRatio(callLimit);
    if (res.status === 429) throw new RetryableError("cafe24 429");
    if (res.status >= 500) throw new RetryableError(`cafe24 ${res.status}`);
    if (res.status === 404) return null;
    if (res.status !== 200) throw new Error(`cafe24 unexpected ${res.status}`);
    return (res.body as { order: Order }).order;
  });
  return value ? { found: true, order: value, attempts, callLimit } : { found: false, attempts, callLimit };
}
