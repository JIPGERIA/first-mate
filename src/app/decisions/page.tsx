import { DECISIONS } from "@/lib/decisions";

export default function DecisionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">설계 결정 기록</h1>
        <p className="mt-1 text-sm text-muted">공고의 우대 스택이 아니라 이 문제의 목적에서 출발해 고른 이유와, 버린 대안, 다시 볼 조건을 남깁니다.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {DECISIONS.map((d) => (
          <article key={d.id} className="rounded-lg border border-line bg-white p-4 text-sm">
            <div className="text-xs text-muted">{d.id}</div>
            <h2 className="mt-0.5 font-semibold">{d.title}</h2>
            <dl className="mt-3 space-y-2">
              {([["상황", d.context], ["결정", d.decision], ["이유", d.why], ["버린 대안", d.rejected], ["다시 볼 조건", d.revisit]] as const).map(([k, v]) => (
                <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="leading-relaxed">{v}</dd></div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
