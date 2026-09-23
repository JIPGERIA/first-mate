import Link from "next/link";
import { evalBatches, evalCases } from "@/lib/queries";
import { REPO_URL, ROUTE_EXPECT, SETS, VERSIONS, parseBatch } from "@/lib/present";
import { RouteBadge, secs } from "@/components/ui";

export const dynamic = "force-dynamic";

const mark = (v: boolean | null) => (v === null ? <span className="text-muted">·</span> : v ? <span className="text-auto">✓</span> : <span className="text-only">✗</span>);

type Batch = Awaited<ReturnType<typeof evalBatches>>[number];

const METRICS = [
  { name: "위험한 자동화", body: "사람이 봐야 하는 문의를 원클릭 승인 후보로 보낸 건수. 가장 중요한 지표이고 목표는 0입니다. 틀린 초안보다 틀린 초안이 검토 없이 나가는 쪽이 더 비쌉니다." },
  { name: "라우팅", body: "기대 경로(원클릭 / 사람)와 맞은 건수. 기대 경로가 분명한 케이스만 채점합니다." },
  { name: "정책 사실", body: "필수 문구(예: 미뇽맨션 무료배송 3만 원)가 들어가고, 다른 브랜드 기준 같은 금지 문구가 없는지." },
  { name: "원클릭 승인", body: "상담원이 읽고 승인만 하면 되는 비율. 높을수록 좋지만 위험한 자동화 0이 먼저입니다." },
];

export default async function EvalPage({ searchParams }: PageProps<"/eval">) {
  const sp = await searchParams;
  const batches = await evalBatches();
  if (batches.length === 0) return <p className="text-sm text-muted">아직 평가 실행이 없습니다. <code>pnpm eval</code></p>;

  // 같은 버전·세트 안에서 실행 순서(1회차, 2회차…)를 매긴다.
  const chrono = [...batches].reverse();
  const runNo = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const b of chrono) {
    const p = parseBatch(b.eval_batch);
    const k = `${p.version}-${p.set}`;
    seen.set(k, (seen.get(k) ?? 0) + 1);
    runNo.set(b.eval_batch, seen.get(k)!);
  }
  const versions = [...new Set(chrono.map((b) => parseBatch(b.eval_batch).version))];
  const label = (b: Batch) => {
    const p = parseBatch(b.eval_batch);
    return `${p.version} · ${p.set ? SETS[p.set].name : "?"} · ${runNo.get(b.eval_batch)}회차`;
  };

  const current = batches.find((b) => b.eval_batch === sp.batch) ?? batches.find((b) => parseBatch(b.eval_batch).set === "golden") ?? batches[0];
  const onlyWrong = sp.wrong === "1";
  const all = await evalCases(current.eval_batch);
  const cases = onlyWrong ? all.filter((c) => c.unsafe_auto || c.route_ok === false || c.policy_ok === false || !c.brand_ok || !c.intent_ok) : all;
  const cur = parseBatch(current.eval_batch);
  const q = (p: Record<string, string | null>) => {
    const u = new URLSearchParams({ batch: current.eval_batch, ...(onlyWrong ? { wrong: "1" } : {}) });
    for (const [k, v] of Object.entries(p)) (v === null ? u.delete(k) : u.set(k, v));
    return `/eval?${u}#cases`;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold">평가</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">
          함정 케이스를 섞은 합성 문의 56건(골든 36 + 홀드아웃 20)을 파이프라인 전체에 통과시켜 채점했습니다. 주문 API에는 장애를 20% 주입했습니다.
          프롬프트로 고치려다 데이터 문제라는 걸 알게 된 과정을 버전 순서로 보여 줍니다. 채점 규칙을 바꾼 이유는 모두{" "}
          <a className="underline" href={`${REPO_URL}/blob/main/data/eval/CHANGELOG.md`} target="_blank" rel="noopener">CHANGELOG</a>에 있습니다.
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {METRICS.map((m, i) => (
          <div key={m.name} className={`rounded-lg border bg-white px-4 py-3 ${i === 0 ? "border-auto/40" : "border-line"}`}>
            <dt className="text-sm font-semibold">{m.name}</dt>
            <dd className="mt-1 text-xs leading-relaxed text-muted">{m.body}</dd>
          </div>
        ))}
      </dl>

      <section className="space-y-4">
        <h2 className="text-lg font-bold">버전별 결과</h2>
        {versions.map((v) => {
          const setOrder = (b: Batch) => ["golden", "holdout", "holdout2"].indexOf(parseBatch(b.eval_batch).set ?? "");
          const vb = chrono
            .filter((b) => parseBatch(b.eval_batch).version === v)
            .sort((a, b) => runNo.get(a.eval_batch)! - runNo.get(b.eval_batch)! || setOrder(a) - setOrder(b));
          const info = VERSIONS[v];
          const bad = vb.some((b) => Number(b.unsafe) > 0);
          return (
            <article key={v} className={`rounded-lg border bg-white ${v === versions.at(-1) ? "border-accent/40" : "border-line"}`}>
              <div className="grid gap-x-6 gap-y-2 border-b border-line px-4 py-3 md:grid-cols-[4rem_1fr_1fr]">
                <div className="font-mono text-lg font-bold">{v}</div>
                <div><div className="text-xs text-muted">바꾼 것</div><div className="mt-0.5 text-sm leading-relaxed">{info?.changed ?? "-"}</div></div>
                <div><div className="text-xs text-muted">결과</div><div className={`mt-0.5 text-sm leading-relaxed ${bad ? "text-only" : ""}`}>{info?.lesson ?? "-"}</div></div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="text-left text-xs text-muted">
                    <tr>
                      <th className="px-4 py-2 font-medium">세트 · 실행</th>
                      <th className="px-2 py-2 text-right font-medium">위험한 자동화</th>
                      <th className="px-2 py-2 text-right font-medium">라우팅</th>
                      <th className="px-2 py-2 text-right font-medium">정책 사실</th>
                      <th className="px-2 py-2 text-right font-medium">원클릭 승인</th>
                      <th className="px-4 py-2 text-right font-medium">건당 시간</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {vb.map((b) => {
                      const p = parseBatch(b.eval_batch);
                      const sel = b.eval_batch === current.eval_batch;
                      return (
                        <tr key={b.eval_batch} className={`border-t border-line ${sel ? "bg-accent/5" : "hover:bg-paper/60"}`}>
                          <td className="px-4 py-2">
                            <Link href={`/eval?batch=${b.eval_batch}#cases`} className="hover:underline">
                              {p.set ? SETS[p.set].name : b.eval_batch} <span className="text-muted">· {runNo.get(b.eval_batch)}회차</span>
                            </Link>
                            {p.replayable && <span className="ml-2 rounded bg-auto/10 px-1.5 py-0.5 text-xs text-auto" title="pnpm demo가 이 배치를 그대로 재생합니다">pnpm demo로 재현</span>}
                            {sel && <span className="ml-2 text-xs text-accent">← 아래 케이스</span>}
                          </td>
                          <td className="px-2 py-2 text-right">{Number(b.unsafe) > 0 ? <b className="text-only">{b.unsafe}</b> : <span className="text-auto">0</span>}</td>
                          <td className="px-2 py-2 text-right">{b.route_hit}/{b.route_n}</td>
                          <td className="px-2 py-2 text-right">{b.policy_hit}/{b.n}</td>
                          <td className="px-2 py-2 text-right">{b.auto_n}/{b.n}</td>
                          <td className="px-4 py-2 text-right text-muted">{secs(b.ms)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </article>
          );
        })}
      </section>

      <section id="cases" className="scroll-mt-20 rounded-lg border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">케이스별 결과 · {label(current)}</h2>
            <p className="mt-0.5 text-xs text-muted">{cur.set ? SETS[cur.set].note : ""}</p>
          </div>
          <div className="flex gap-1 text-xs">
            <Link href={q({ wrong: null })} className={`rounded-full px-3 py-1 ring-1 ${!onlyWrong ? "bg-ink text-white ring-ink" : "ring-line"}`}>전체 {all.length}</Link>
            <Link href={q({ wrong: "1" })} className={`rounded-full px-3 py-1 ring-1 ${onlyWrong ? "bg-ink text-white ring-ink" : "ring-line"}`}>틀린 것만</Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">케이스</th>
                <th className="py-2 font-medium">시험하는 것</th>
                <th className="py-2 font-medium">기대</th>
                <th className="py-2 font-medium">결과</th>
                <th className="py-2 text-center font-medium">브랜드</th>
                <th className="py-2 text-center font-medium">의도</th>
                <th className="py-2 text-center font-medium">라우팅</th>
                <th className="py-2 text-center font-medium">정책</th>
                <th className="px-4 py-2 font-medium">메모</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id} className={`border-t border-line align-top ${c.unsafe_auto ? "bg-only/5" : ""}`}>
                  <td className="px-4 py-2 font-mono text-xs">{c.ticket_id ? <Link className="hover:underline" href={`/tickets/${c.ticket_id}`}>{c.case_id}</Link> : c.case_id}</td>
                  <td className="max-w-xs py-2 pr-3 text-xs leading-relaxed">{c.scenario}</td>
                  <td className="py-2 pr-2 text-xs whitespace-nowrap text-muted">{ROUTE_EXPECT[c.expected.route] ?? c.expected.route}</td>
                  <td className="py-2 pr-2 whitespace-nowrap"><RouteBadge route={c.route} /></td>
                  <td className="py-2 text-center">{mark(c.brand_ok)}</td>
                  <td className="py-2 text-center">{mark(c.intent_ok)}</td>
                  <td className="py-2 text-center">{mark(c.route_ok)}</td>
                  <td className="py-2 text-center">{mark(c.policy_ok)}</td>
                  <td className="px-4 py-2 text-xs text-muted">
                    {c.unsafe_auto && <b className="text-only">위험한 자동화 </b>}
                    {[...(c.actual?.missing ?? []).map((m: string) => `누락: ${m}`), ...(c.actual?.forbidden ?? []).map((f: string) => `금지어: ${f}`), ...(c.actual?.ungrounded ?? []).map((u: string) => `근거없는 인용: ${u.slice(0, 20)}…`)].join(" · ")}
                  </td>
                </tr>
              ))}
              {cases.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-muted">이 실행에서 틀린 케이스가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
