import Link from "next/link";
import { evalBatches, inbox, ticketIdsByCase } from "@/lib/queries";
import { REPO_URL, TOUR, parseBatch } from "@/lib/present";
import { RouteBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const PIPELINE = [
  { kind: "model", name: "분류", what: "브랜드 · 의도 · 주문번호 · 위험 신호 · 확신도", by: "Haiku 4.5" },
  { kind: "code", name: "주문 조회", what: "Cafe24 Admin API 형태 · 호출 제한 · 재시도", by: "코드" },
  { kind: "model", name: "초안", what: "해당 브랜드 정책 전체를 넣고 인용과 함께 작성", by: "Sonnet 5" },
  { kind: "code", name: "근거 검증", what: "인용 문장이 정책 원문에 있는지 대조", by: "코드" },
  { kind: "code", name: "라우팅", what: "원클릭 승인 / 사람 검토 / 사람 전담 + 사유", by: "코드 규칙" },
] as const;

export default async function Home() {
  const [rows, batches, tour] = await Promise.all([inbox(), evalBatches(), ticketIdsByCase(TOUR.map((t) => t.caseId))]);
  const graded = rows.filter((r) => r.route);
  const auto = graded.filter((r) => r.route === "auto_ready").length;
  const v3 = batches.filter((b) => parseBatch(b.eval_batch).version === "v3");
  const v3Runs = v3.reduce((a, b) => a + Number(b.n), 0);
  const v3Unsafe = v3.reduce((a, b) => a + Number(b.unsafe), 0);
  const v3Passes = new Set(v3.map((b) => parseBatch(b.eval_batch).label ?? "1")).size;
  const firstTour = tour.get(TOUR[0].caseId);

  return (
    <div className="space-y-12 pb-8">
      <section className="pt-4">
        <p className="text-xs font-medium tracking-wide text-accent">에고이즘 5개 브랜드 · CS 코파일럿</p>
        <h1 className="mt-2 max-w-3xl text-2xl font-bold leading-snug text-balance sm:text-3xl">
          CS 문의에 브랜드 정책을 근거로 답변 초안을 쓰고, 자동화할 것과 사람이 할 것을 코드 규칙으로 나눕니다
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          채널톡 문의 → 분류 → 주문 조회 → 초안 → 근거 검증 → 라우팅. 상담원은 초안을 읽고 승인·수정·반려합니다.
          목표는 &lsquo;자동 응답&rsquo;이 아니라 <b className="text-ink">틀린 답이 검토 없이 나가지 않는 것</b>입니다.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {firstTour && (
            <Link href={`/tickets/${firstTour.id}?tour=1`} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90">
              3분 둘러보기 시작 →
            </Link>
          )}
          <Link href="/eval" className="rounded-md border border-line bg-white px-4 py-2 text-sm hover:border-muted">평가 결과</Link>
          <a href={REPO_URL} target="_blank" rel="noopener" className="rounded-md border border-line bg-white px-4 py-2 text-sm hover:border-muted">GitHub ↗</a>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Figure value={`${v3Unsafe}`} unit={` / ${v3Runs}`} label="위험한 자동화" sub={`사람이 봐야 할 문의를 원클릭 승인으로 보낸 건수. v3를 ${v3Passes}번 실행한 합계`} good />
        <Figure value={`${Math.round((auto / Math.max(graded.length, 1)) * 100)}%`} label="원클릭 승인 후보" sub={`${graded.length}건 중 ${auto}건. 나머지는 사유와 함께 사람에게`} />
        <Figure value="0" unit="원" label="검증에 쓴 API 비용" sub="로컬 Claude Code 구독으로 실행" />
        <Figure value="1줄" label="누구나 재현" sub="pnpm demo · 키·DB 설치 없이 평가 수치 그대로" />
      </section>

      <section>
        <SectionHead n="1" title="세 건으로 보는 First Mate" sub="경로마다 대표 문의 하나씩. 각 화면 위쪽에 '여기서 볼 것'을 적어 두었습니다." />
        <ol className="grid gap-3 md:grid-cols-3">
          {TOUR.map((t, i) => {
            const tk = tour.get(t.caseId);
            if (!tk) return null;
            return (
              <li key={t.caseId}>
                <Link href={`/tickets/${tk.id}?tour=${i + 1}`} className="group flex h-full flex-col rounded-lg border border-line bg-white p-4 hover:border-accent/50 hover:shadow-sm">
                  <div className="flex items-center justify-between">
                    <RouteBadge route={t.route} />
                    <span className="font-mono text-xs text-muted">{i + 1} / {TOUR.length} · {t.caseId}</span>
                  </div>
                  <h3 className="mt-3 font-semibold leading-snug">{t.headline}</h3>
                  <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-muted">&ldquo;{tk.body}&rdquo;</p>
                  <span className="mt-3 text-sm font-medium text-accent group-hover:underline">초안과 판단 근거 보기 →</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      <section>
        <SectionHead n="2" title="어디까지 모델에게 맡기나" sub="모델은 읽고 쓰는 두 단계만. 조회·검증·최종 결정은 코드가 합니다. 결정은 읽고, 테스트하고, 현업과 함께 고칠 수 있어야 하니까요." />
        <ol className="grid gap-2 sm:grid-cols-5">
          {PIPELINE.map((p, i) => (
            <li key={p.name} className={`rounded-lg p-3 text-sm ${p.kind === "model" ? "border border-dashed border-accent/50 bg-accent/5" : "border border-line bg-white"}`}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-muted">{i + 1}</span>
                <span className={p.kind === "model" ? "text-accent" : "text-muted"}>{p.by}</span>
              </div>
              <div className="mt-1 font-semibold">{p.name}</div>
              <div className="mt-1 text-xs leading-relaxed text-muted">{p.what}</div>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-muted"><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm border border-dashed border-accent/60 bg-accent/5 align-middle" />점선 = 모델 · <span className="mx-1 inline-block h-2.5 w-2.5 rounded-sm border border-line bg-white align-middle" />실선 = 코드</p>
      </section>

      <section>
        <SectionHead n="3" title="더 볼 곳" />
        <div className="grid gap-3 md:grid-cols-3">
          <More href="/eval" title="평가" body="골든 36 + 홀드아웃 20건. 프롬프트로 고치려다 데이터 문제라는 걸 알게 된 v1 → v3 기록." />
          <More href="/decisions" title="설계 결정 10개" body="RAG를 쓰지 않은 이유, 자동 발송을 막은 이유 등. 버린 대안과 다시 볼 조건까지." />
          <More href="/inbox" title={`받은함 ${rows.length}건`} body="함정 케이스 전체. 경로·세트로 걸러 보고, 기대 경로와 맞았는지 확인할 수 있습니다." />
        </div>
        <div className="mt-4 rounded-lg border border-line bg-white p-4">
          <div className="text-sm font-semibold">직접 돌려 보기</div>
          <p className="mt-1 text-xs text-muted">구독으로 실행하며 기록한 모델 응답을 재생해 전체 파이프라인과 채점을 실제 코드로 다시 돌립니다. API 키·Claude 구독·DB 설치가 필요 없습니다.</p>
          <pre className="mt-3 overflow-x-auto rounded-md bg-ink p-3 text-xs leading-relaxed text-white/90">{`git clone ${REPO_URL} && cd first-mate
pnpm install
pnpm demo            # 세 세트 평가 재현 (약 10초)
pnpm demo --serve    # 이 콘솔을 localhost:3000에`}</pre>
        </div>
      </section>
    </div>
  );
}

function Figure({ value, unit, label, sub, good }: { value: string; unit?: string; label: string; sub: string; good?: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-white px-4 py-3">
      <div className={`text-3xl font-bold tracking-tight ${good ? "text-auto" : ""}`}>
        {value}
        {unit && <span className="text-base font-medium text-muted">{unit}</span>}
      </div>
      <div className="mt-1 text-sm font-medium">{label}</div>
      <div className="mt-0.5 text-xs leading-relaxed text-muted">{sub}</div>
    </div>
  );
}

function SectionHead({ n, title, sub }: { n: string; title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-xs text-muted">{n}</span>
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      {sub && <p className="mt-1 max-w-3xl text-sm text-muted">{sub}</p>}
    </div>
  );
}

function More({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} className="group rounded-lg border border-line bg-white p-4 hover:border-accent/50">
      <div className="font-semibold group-hover:text-accent">{title} →</div>
      <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
    </Link>
  );
}
