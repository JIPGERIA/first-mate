import Link from "next/link";
import { inbox } from "@/lib/queries";
import { ROUTES, type Route } from "@/lib/brands";
import { SETS, setOfCase, type SetKey } from "@/lib/present";
import { BrandTag, RouteBadge, intentLabel } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { approved: "승인됨", edited: "수정 후 승인", rejected: "반려됨" };

export default async function InboxPage({ searchParams }: PageProps<"/inbox">) {
  const sp = await searchParams;
  const route = typeof sp.route === "string" && sp.route in ROUTES ? (sp.route as Route) : null;
  const set = typeof sp.set === "string" && sp.set in SETS ? (sp.set as SetKey) : null;
  const all = await inbox();
  const inSet = set ? all.filter((r) => setOfCase(r.case_id) === set) : all;
  const rows = route ? inSet.filter((r) => r.route === route) : inSet;
  const count = (r: Route) => inSet.filter((x) => x.route === r).length;
  const href = (p: { route?: string | null; set?: string | null }) => {
    const q = new URLSearchParams();
    const nr = p.route === undefined ? route : p.route;
    const ns = p.set === undefined ? set : p.set;
    if (nr) q.set("route", nr);
    if (ns) q.set("set", ns);
    return `/inbox${q.size ? `?${q}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">받은함</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          평가셋 {all.length}건을 파이프라인에 통과시킨 결과입니다. 각 문의는 무언가를 시험하도록 만든 합성 케이스이고, &lsquo;시험하는 것&rsquo; 열에 그 의도를 적었습니다. 행을 누르면 초안·근거·라우팅 사유·실행 트레이스를 볼 수 있습니다.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 w-10 text-xs text-muted">경로</span>
          <Chip href={href({ route: null })} on={!route}>전체 {inSet.length}</Chip>
          {(Object.keys(ROUTES) as Route[]).map((r) => (
            <Chip key={r} href={href({ route: r })} on={route === r}>{ROUTES[r]} {count(r)}</Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 w-10 text-xs text-muted">세트</span>
          <Chip href={href({ set: null })} on={!set}>전체</Chip>
          {(Object.keys(SETS) as SetKey[]).map((s) => (
            <Chip key={s} href={href({ set: s })} on={set === s}>{SETS[s].name}</Chip>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-paper text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">케이스</th>
              <th className="px-3 py-2 font-medium">시험하는 것</th>
              <th className="px-3 py-2 font-medium">경로</th>
              <th className="px-3 py-2 font-medium" title="평가셋의 기대 경로와 일치하는지">기대와 일치</th>
              <th className="px-3 py-2 font-medium">브랜드</th>
              <th className="px-3 py-2 font-medium">의도</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line hover:bg-paper/60">
                <td className="px-3 py-2 font-mono text-xs text-muted">{r.case_id ?? `#${r.id}`}</td>
                <td className="px-3 py-2">
                  <Link href={`/tickets/${r.id}`} className="font-medium hover:underline">{r.scenario ?? r.triage?.summary ?? r.body.slice(0, 60)}</Link>
                  <div className="mt-0.5 line-clamp-1 text-xs text-muted">&ldquo;{r.body}&rdquo;</div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <RouteBadge route={r.route} />
                  {STATUS[r.status] && <div className="mt-1 text-xs text-muted">{STATUS[r.status]}</div>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs">
                  {r.unsafe_auto ? <b className="text-only">위험한 자동화</b> : r.route_ok === null ? <span className="text-muted">채점 안 함</span> : r.route_ok ? <span className="text-auto">✓</span> : <span className="text-review">✗ 경로 다름</span>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap"><BrandTag brand={r.triage?.brand ?? r.brand_hint} /></td>
                <td className="px-3 py-2 whitespace-nowrap text-muted">{intentLabel(r.triage?.intent)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-muted">조건에 맞는 문의가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Chip({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`rounded-full px-3 py-1 text-xs ring-1 ${on ? "bg-ink text-white ring-ink" : "bg-white text-ink ring-line hover:ring-muted"}`}>
      {children}
    </Link>
  );
}
