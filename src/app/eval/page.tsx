import Link from "next/link";
import { evalBatches, evalCases } from "@/lib/queries";
import { Card, RouteBadge, Stat, pct, secs } from "@/components/ui";

export const dynamic = "force-dynamic";

const mark = (v: boolean | null) => (v === null ? <span className="text-muted">·</span> : v ? <span className="text-auto">✓</span> : <span className="text-only">✗</span>);

export default async function EvalPage({ searchParams }: PageProps<"/eval">) {
  const sp = await searchParams;
  const batches = await evalBatches();
  if (batches.length === 0) return <p className="text-sm text-muted">아직 평가 실행이 없습니다. <code>pnpm eval</code></p>;
  const current = batches.find((b) => b.eval_batch === sp.batch) ?? batches[0];
  const cases = await evalCases(current.eval_batch);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">평가</h1>
        <p className="mt-1 text-sm text-muted">
          골든셋 {current.n}건(합성 문의, 함정 케이스 포함)을 파이프라인에 통과시켜 채점합니다. 가장 중요한 지표는 <b>위험한 자동화</b>, 즉 사람이 봐야 하는 문의를 원클릭 승인 후보로 보낸 건수입니다.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Stat label="위험한 자동화" value={`${current.unsafe}건`} sub="목표 0건" />
        <Stat label="라우팅 정확도" value={pct(current.route)} sub="auto/human 구분" />
        <Stat label="정책 사실 정확도" value={pct(current.policy)} sub="필수 포함·금지 문구" />
        <Stat label="브랜드 / 의도" value={`${pct(current.brand)} / ${pct(current.intent)}`} />
        <Stat label="원클릭 승인 비율" value={pct(current.auto_rate)} sub="자동화 커버리지" />
        <Stat label="건당 시간 · 정가환산" value={secs(current.ms)} sub={`$${Number(current.usd).toFixed(4)} / 건`} />
      </div>

      <Card title="실행 이력">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr><th className="py-1">배치</th><th>프롬프트</th><th>위험 자동화</th><th>라우팅</th><th>정책</th><th>브랜드</th><th>의도</th><th>자동화율</th><th>에러</th></tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.eval_batch} className={`border-t border-line ${b.eval_batch === current.eval_batch ? "bg-paper" : ""}`}>
                <td className="py-1.5"><Link className="font-mono text-xs hover:underline" href={`/eval?batch=${b.eval_batch}`}>{b.eval_batch}</Link></td>
                <td>{b.prompt_version}</td>
                <td className={Number(b.unsafe) > 0 ? "text-only font-semibold" : "text-auto"}>{b.unsafe}</td>
                <td>{pct(b.route)}</td><td>{pct(b.policy)}</td><td>{pct(b.brand)}</td><td>{pct(b.intent)}</td><td>{pct(b.auto_rate)}</td><td>{b.errors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title={`케이스별 결과 · ${current.eval_batch}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr><th className="py-1">ID</th><th>기대</th><th>결과</th><th>브랜드</th><th>의도</th><th>라우팅</th><th>정책</th><th>메모</th></tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id} className={`border-t border-line align-top ${c.unsafe_auto ? "bg-only/5" : ""}`}>
                  <td className="py-1.5"><Link className="hover:underline" href={`/tickets/${c.ticket_id}`}>{c.case_id}</Link></td>
                  <td className="text-xs text-muted">{c.expected.route}</td>
                  <td><RouteBadge route={c.route} /></td>
                  <td>{mark(c.brand_ok)}</td><td>{mark(c.intent_ok)}</td><td>{mark(c.route_ok)}</td><td>{mark(c.policy_ok)}</td>
                  <td className="text-xs text-muted">
                    {c.unsafe_auto && <b className="text-only">위험한 자동화 </b>}
                    {[...(c.actual?.missing ?? []).map((m: string) => `누락: ${m}`), ...(c.actual?.forbidden ?? []).map((f: string) => `금지어: ${f}`), ...(c.actual?.ungrounded ?? []).map((u: string) => `근거없는 인용: ${u.slice(0, 20)}…`)].join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
