import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BRAND_KEYS, type BrandKey } from "./brands";

const cache = new Map<BrandKey, string>();

export function loadKb(brand: BrandKey): string {
  if (!cache.has(brand)) cache.set(brand, readFileSync(join(process.cwd(), "data/kb", `${brand}.md`), "utf8"));
  return cache.get(brand)!;
}

export function allKb(): Record<BrandKey, string> {
  return Object.fromEntries(BRAND_KEYS.map((b) => [b, loadKb(b)])) as Record<BrandKey, string>;
}

const norm = (s: string) => s.replace(/\s+/g, " ").replace(/[“”"']/g, "").trim();

/** 초안이 인용한 문장이 KB 원문에 실제로 존재하는지 (근거 없는 정책 생성 방지) */
export function isVerbatimInKb(brand: BrandKey, quote: string): boolean {
  const q = norm(quote);
  return q.length >= 6 && norm(loadKb(brand)).includes(q);
}

export type KbIssue = { id: string; brand: BrandKey; intents: string[]; title: string; evidence: string[]; action: string };

let issues: KbIssue[] | null = null;

/** 정책 담당자가 확정하기 전까지 사람이 봐야 하는 KB 결함 (data/kb/_issues.json) */
export function kbIssuesFor(brand: string, intent: string): KbIssue[] {
  issues ??= JSON.parse(readFileSync(join(process.cwd(), "data/kb/_issues.json"), "utf8")).issues as KbIssue[];
  return issues.filter((i) => i.brand === brand && i.intents.includes(intent));
}
