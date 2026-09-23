import Link from "next/link";
import { inbox, reviewStats } from "@/lib/queries";
import { BrandTag, RouteBadge, Stat, intentLabel, pct, secs } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Inbox() {
  const [rows, rs] = await Promise.all([inbox(), reviewStats()]);
  const processed = rows.filter((r) => r.route);
  const count = (route: string) => processed.filter((r) => r.route === route).length;
  const avgMs = processed.reduce((a, r) => a + (r.total_ms ?? 0), 0) / Math.max(processed.length, 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">받은함</h1>
        <p className="mt-1 text-sm text-muted">채널톡으로 들어온 문의를 분류 → 주문 조회 → 브랜드 정책 근거 초안 → 규칙 라우팅까지 처리한 결과입니다. 자동 발송은 하지 않습니다.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="처리된 문의" value={`${processed.length}건`} sub={`전체 ${rows.length}건`} />
        <Stat label="원클릭 승인 후보" value={pct(count("auto_ready") / Math.max(processed.length, 1))} sub={`${count("auto_ready")}건`} />
        <Stat label="사람 검토" value={`${count("human_review")}건`} sub="초안 + 검토 사유" />
        <Stat label="사람 전담" value={`${count("human_only")}건`} sub="안전·법적·격한 불만" />
        <Stat label="평균 처리 시간" value={secs(avgMs)} sub={rs?.n && Number(rs.n) > 0 ? `상담원 수정률 ${pct(rs.edit)}` : "문의 1건, 모델 호출 2회"} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">경로</th>
              <th className="px-3 py-2 font-medium">브랜드</th>
              <th className="px-3 py-2 font-medium">의도</th>
              <th className="px-3 py-2 font-medium">요약</th>
              <th className="px-3 py-2 font-medium">고객</th>
              <th className="px-3 py-2 font-medium">상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line hover:bg-paper/60">
                <td className="px-3 py-2 whitespace-nowrap"><RouteBadge route={r.route} /></td>
                <td className="px-3 py-2 whitespace-nowrap"><BrandTag brand={r.triage?.brand ?? r.brand_hint} /></td>
                <td className="px-3 py-2 whitespace-nowrap text-muted">{intentLabel(r.triage?.intent)}</td>
                <td className="px-3 py-2">
                  <Link href={`/tickets/${r.id}`} className="hover:underline">{r.triage?.summary ?? r.body.slice(0, 60)}</Link>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-muted">{r.customer}</td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-muted">{STATUS[r.status] ?? r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const STATUS: Record<string, string> = { pending: "대기", drafted: "초안 완료", approved: "승인 발송", edited: "수정 발송", rejected: "반려", failed: "실패" };
