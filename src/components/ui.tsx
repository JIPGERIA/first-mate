import { BRANDS, INTENTS, ROUTES, type BrandKey, type Intent, type Route } from "@/lib/brands";

const ROUTE_STYLE: Record<Route, string> = {
  auto_ready: "bg-auto/10 text-auto ring-auto/30",
  human_review: "bg-review/10 text-review ring-review/30",
  human_only: "bg-only/10 text-only ring-only/30",
};

export function RouteBadge({ route }: { route: string | null }) {
  if (!route) return <span className="text-xs text-muted">미처리</span>;
  const r = route as Route;
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${ROUTE_STYLE[r]}`}>{ROUTES[r]}</span>;
}

export function BrandTag({ brand }: { brand?: string | null }) {
  const name = brand && brand in BRANDS ? BRANDS[brand as BrandKey].name : brand === "unknown" ? "브랜드 미상" : brand ?? "-";
  return <span className="inline-block rounded bg-accent/5 px-1.5 py-0.5 text-xs text-accent">{name}</span>;
}

export const intentLabel = (i?: string | null) => (i && i in INTENTS ? INTENTS[i as Intent] : i ?? "-");

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-line bg-white px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export const pct = (v: string | number | null | undefined) => (v === null || v === undefined ? "-" : `${(Number(v) * 100).toFixed(0)}%`);
export const secs = (ms: string | number | null | undefined) => (ms ? `${(Number(ms) / 1000).toFixed(1)}s` : "-");
