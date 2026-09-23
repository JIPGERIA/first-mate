/** 처음 보는 사람(채용 담당자·현업)이 읽을 수 있게 내부 식별자를 풀어 쓰는 표시 규칙. */

export const REPO_URL = "https://github.com/JIPGERIA/first-mate";

export type SetKey = "golden" | "holdout" | "holdout2";

export const SETS: Record<SetKey, { name: string; note: string; prefix: string }> = {
  golden: { name: "골든 36", note: "개발용. 프롬프트·규칙을 이 세트를 보며 고쳤다", prefix: "C" },
  holdout: { name: "홀드아웃 12", note: "v2 실행 전에 만들어 튜닝에 쓰지 않음. v3를 고칠 때 H11 실패를 봐서 부분 관측", prefix: "H" },
  holdout2: { name: "홀드아웃2 8", note: "v3 첫 실행 전에 만든 유일한 미관측 세트", prefix: "K" },
};

export const setOfCase = (caseId: string | null): SetKey | null =>
  !caseId ? null : caseId.startsWith("C") ? "golden" : caseId.startsWith("H") ? "holdout" : caseId.startsWith("K") ? "holdout2" : null;

export const VERSIONS: Record<string, { changed: string; lesson: string }> = {
  v1: { changed: "기준선", lesson: "홀드아웃에서 바쏠 교환 문의(H04)를 원클릭 승인으로 보냈다." },
  v2: { changed: "사람 검토 사유를 좁히고, 정책 충돌 시 단정하지 말라고 프롬프트에 명시", lesson: "나아지지 않았다. 같은 바쏠 문의를 실행마다 다르게 판단했다(C13·H04). 원인은 모델이 아니라 이용안내의 모순(7일 vs 20일)." },
  v3: { changed: "KB 결함 등록부 + 규칙으로 바쏠 교환·반품은 항상 사람 검토. 분류에 '특정 주문 문의인가' 추가", lesson: "세 세트 모두 위험한 자동화 0. 코드 변경 없이 두 번 돌려 두 번 다 0이었다." },
};

export type BatchInfo = { set: SetKey | null; version: string; label: string | null; replayable: boolean };

/** `${ts}-${set}-${version}[-label]` 형식의 배치 이름을 푼다. */
export function parseBatch(batch: string): BatchInfo {
  const m = batch.match(/^\d+-(golden|holdout2|holdout)-(v\d+)(?:-(.+))?$/);
  if (!m) return { set: null, version: "?", label: null, replayable: false };
  const label = m[3] ?? null;
  return { set: m[1] as SetKey, version: m[2], label, replayable: label === "rec" || label === "replay" };
}

export const ROUTE_EXPECT: Record<string, string> = {
  auto: "원클릭 승인",
  human: "사람 (검토 또는 전담)",
  human_only: "사람 전담",
  any: "어느 경로든 허용",
};

export const RISK_LABEL: Record<string, string> = {
  compensation_request: "정책 외 보상 요구",
  legal_threat: "법적 대응 언급",
  safety: "신체 안전",
  abusive: "욕설·공격적 표현",
  privacy: "개인정보 변경",
  multiple_issues: "요청 여러 개",
};

export const EMOTION_LABEL: Record<string, string> = { calm: "차분", frustrated: "답답함", angry: "격앙" };

/** 3분 둘러보기: 경로마다 대표 문의 하나. hint는 그 화면에서 볼 곳. */
export const TOUR = [
  {
    caseId: "C07",
    route: "auto_ready",
    headline: "정책 근거가 확인된 문의는 읽고 승인만",
    hints: [
      "미뇽맨션 반품 기한(7일)·반송비 부담을 브랜드 이용안내에서 인용합니다.",
      "'④ 정책 근거'의 ✓는 인용 문장이 KB 원문에 실제로 있는지 코드로 대조한 결과입니다.",
      "규칙에 걸린 것이 없어 원클릭 승인 후보가 됐습니다. 자동 발송은 하지 않습니다.",
    ],
  },
  {
    caseId: "C13",
    route: "human_review",
    headline: "모델이 못 고치는 문제는 데이터와 규칙으로",
    hints: [
      "바쏠 이용안내에는 단순변심 기한이 '수령 후 7일'과 '구매 후 20일' 두 가지로 적혀 있습니다.",
      "프롬프트로 막아 보았지만(v2) 실행마다 판단이 달랐습니다. 그래서 KB 결함 등록부에 올리고 규칙으로 사람 검토에 보냅니다.",
      "상담원에게는 'KB 결함 KB-VASOL-01'이라는 사유가 보입니다. 이 목록이 CX 리드에게 확정을 요청할 목록이 됩니다.",
    ],
  },
  {
    caseId: "C18",
    route: "human_only",
    headline: "안전 이슈는 모델 판단과 상관없이 사람에게",
    hints: [
      "보조배터리 발열·부풂 문의입니다. 분류가 '안전' 신호를 붙이면 코드 규칙이 사람 전담으로 보냅니다.",
      "초안은 참고용으로만 남습니다. 사유 목록에 규칙과 코파일럿 판단이 함께 보입니다.",
      "아래 '실행 트레이스'에서 단계별 입력·출력과 지연 시간을 펼쳐 볼 수 있습니다.",
    ],
  },
] as const;
