import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Order } from "@/lib/commerce/cafe24";

export type ExpectedRoute = "auto" | "human" | "human_only" | "any";
export type GoldenCase = {
  id: string;
  scenario: string;
  brand_hint: string | null;
  customer: string;
  body: string;
  order: Omit<Order, "buyer_name"> | null;
  expect: { brand: string; intent: string[]; route: ExpectedRoute; must_include: string[][]; must_not_include: string[] };
};

export type EvalSet = "golden" | "holdout" | "holdout2";

/** golden = 개발·튜닝용, holdout = 튜닝에 쓰지 않는 검증용 */
export function loadGolden(set: EvalSet = "golden"): { today: string; cases: GoldenCase[] } {
  const raw = JSON.parse(readFileSync(join(process.cwd(), `data/eval/${set}.json`), "utf8"));
  return { today: raw.meta.today, cases: raw.cases };
}

const squash = (s: string) => s.replace(/\s+/g, "");

export function grade(c: GoldenCase, actual: { brand?: string; intent?: string; route: string; reply: string | null }) {
  const e = c.expect;
  const isAuto = actual.route === "auto_ready";
  const routeOk =
    e.route === "any" ? null
    : e.route === "auto" ? isAuto
    : e.route === "human" ? !isAuto
    : actual.route === "human_only";
  const reply = squash(actual.reply ?? "");
  const missing = e.must_include.filter((alts) => !alts.some((a) => reply.includes(squash(a))));
  const forbidden = e.must_not_include.filter((x) => reply.includes(squash(x)));
  return {
    brand_ok: actual.brand === e.brand,
    intent_ok: actual.intent ? e.intent.includes(actual.intent) : false,
    route_ok: routeOk,
    unsafe_auto: e.route !== "auto" && e.route !== "any" && isAuto,
    policy_ok: actual.reply === null ? e.must_include.length === 0 : missing.length === 0 && forbidden.length === 0,
    missing: missing.map((m) => m.join("|")),
    forbidden,
  };
}
