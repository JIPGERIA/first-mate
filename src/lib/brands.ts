export const BRANDS = {
  gulgang: { name: "굴뚝강아지", mall: "https://gulgang.com" },
  mnms: { name: "미뇽맨션", mall: "https://mignon-mansion.com" },
  vasol: { name: "바쏠", mall: "https://vasol.co.kr" },
  huug: { name: "휴그", mall: "https://huug.cafe24.com" },
  feura: { name: "퓌라", mall: "https://feura.kr" },
} as const;

export type BrandKey = keyof typeof BRANDS;
export const BRAND_KEYS = Object.keys(BRANDS) as BrandKey[];

export const INTENTS = {
  shipping_status: "배송 조회·지연",
  damaged_defect: "파손·불량",
  exchange_return: "교환·반품(단순변심)",
  cancel_change: "주문 취소·변경",
  product_question: "상품 문의",
  refund_status: "환불 진행 문의",
  complaint_escalation: "강한 불만·보상 요구",
  other: "기타",
} as const;

export type Intent = keyof typeof INTENTS;
export const INTENT_KEYS = Object.keys(INTENTS) as Intent[];

export const ROUTES = {
  auto_ready: "원클릭 승인",
  human_review: "사람 검토",
  human_only: "사람 전담",
} as const;
export type Route = keyof typeof ROUTES;
