# First Mate — 에고이즘 CS 일등항해사

> 에고이즘 AX Engineer(채용연계형 인턴) 지원을 위해 만든 **비공식 프로토타입**입니다.
> 모든 문의·주문은 합성 데이터이며, 브랜드 정책은 각 브랜드 몰의 공개 이용안내(`/shopinfo/guide.html`)를 읽기 전용으로 옮겼습니다.

## 30초 안에 확인하는 법

```bash
git clone https://github.com/JIPGERIA/first-mate && cd first-mate
pnpm install
pnpm demo            # API 키·Claude 구독·DB 설치 없이 평가 수치 재현
pnpm demo --serve    # 이어서 상담원 콘솔을 localhost:3000에 띄움
```

`pnpm demo`는 내장 Postgres(PGlite)를 띄우고, 구독으로 실행하며 기록해 둔 모델 응답(`data/replay/`)을 재생해
골든 36 + 홀드아웃 20건 전체 파이프라인(주문 조회·근거 검증·라우팅·채점)을 실제 코드로 돌립니다.
모델 호출만 기록에서 가져오고 나머지는 전부 실행됩니다. 기록 키는 요청 전체의 해시라,
프롬프트·KB·입력이 한 글자라도 바뀌면 "재생 기록 없음"으로 멈춥니다.

직접 돌리지 않고 보려면 → [라이브 데모](https://first-mate-three.vercel.app) · [평가 대시보드](https://first-mate-three.vercel.app/eval)

---

채널톡으로 들어온 CS 문의를 **분류 → 주문 조회 → 브랜드 정책 근거 초안 → 규칙 라우팅**까지 처리하고,
상담원은 콘솔에서 초안을 승인·수정·반려합니다. 자동 발송은 하지 않습니다.

```
채널톡 문의
  → ① 분류 (Haiku 4.5)        브랜드 · 의도 · 주문번호 · 위험 신호 · 확신도
  → ② 주문 조회 (코드)         Cafe24 Admin API 형태 · 429/5xx 재시도 · X-Api-Call-Limit 사전 감속
  → ③ 초안 (Sonnet 5)         해당 브랜드 KB 전체 + 주문 정보 → 브랜드 보이스 답변 + 정책 인용
  → ④ 근거 검증 (코드)         인용 문장이 KB 원문에 실제로 있는지 대조
  → ⑤ 라우팅 (코드 규칙)       원클릭 승인 / 사람 검토 / 사람 전담 + 사유
  → 상담원 콘솔                승인·수정·반려, 수정률 기록
모든 단계 → runs / steps 테이블 (지연 · 토큰 · 비용 · 재시도 · 에러)
```

## 왜 이렇게 만들었나

설계 결정 10개(ADR)는 [`src/lib/decisions.ts`](src/lib/decisions.ts)와 앱의 `/decisions` 페이지에 있습니다. 요약:

| 결정 | 이유 |
|---|---|
| TypeScript 단일 스택 | 개발자 3명 팀에서 런타임을 늘리지 않는다 |
| Postgres 하나, 벡터 DB 없음 | 데이터가 관계형이고, 현업 지표를 SQL로 뽑는다 |
| **RAG 안 씀** | 브랜드 KB가 1~3천 토큰이라 통째로 넣고 캐싱하는 편이 정확하고 단순하다 |
| 분류 Haiku / 초안 Sonnet | 품질이 필요한 곳에만 비싼 모델 |
| **자동 발송 없음** | 평가셋 '위험한 자동화' 0건 + 운영 수정률이 쌓인 뒤 의도별로 연다 |
| **라우팅은 코드 규칙** | 자동화할 것과 사람이 할 것의 경계를 읽고·테스트하고·현업과 함께 고칠 수 있게 |
| 주문 조회는 워크플로 | 항상 필요한 호출은 모델의 선택 대상이 아니다 |
| Cafe24 어댑터 | 목업 한 함수만 바꾸면 실연동. 공식 호출 제한 규칙 준수 |
| 구독 로컬 추론 + 기록 재생 | 검증 비용 0원, 누구나 `pnpm demo`로 재현. 검증 안 된 API 공급자 코드는 두지 않음 |
| **KB 결함 등록부** | 모델이 못 고치는 모순은 데이터를 고친다. 확정 전까지 규칙으로 사람에게 |

## 평가

`data/eval/golden.json` 36건(개발용) + `holdout.json` 12건 + `holdout2.json` 8건(튜닝에 쓰지 않음). 브랜드 정책 혼동(무료배송 기준·교환 기한), KB 모순, 주문번호 오류·브랜드 불일치,
안전·법적 이슈, 프롬프트 인젝션 같은 함정 케이스를 포함합니다.

| 지표 | 의미 |
|---|---|
| **위험한 자동화** | 사람이 봐야 하는 문의를 원클릭 승인 후보로 보낸 건수. 목표 0 |
| 라우팅 정확도 | auto / human 구분 |
| 정책 사실 정확도 | 필수 포함 문구(예: 미뇽맨션 30,000원) + 금지 문구(다른 브랜드 기준) |
| 브랜드 / 의도 정확도 | 분류 품질 |

### 결과 (주문 API 장애 20% 주입)

| 버전 | 바꾼 것 | 세트 | 위험한 자동화 | 라우팅 | 정책 사실 | 원클릭 승인 |
|---|---|---|---|---|---|---|
| v1 | 기준선 | 골든 36 / 홀드아웃 12 | 0 / 1 | 30/32 · 10/12 | 36/36 · 12/12 | 11 · 5 |
| v2 | 사람 검토 사유 한정, 정책 충돌 단정 금지(프롬프트) | 골든 / 홀드아웃 | 1 / 1 | 29/32 · 10/12 | 35/36 · 12/12 | 12 · 5 |
| **v3** | **KB 결함 등록부 + 규칙**, 분류에 `order_specific` | 골든 / 홀드아웃 / 홀드아웃2(미관측 8) | **0 / 0 / 0** | 31/32 · 12/12 · 8/8 | 36/36 · 12/12 · 8/8 | 14 · 5 · 4 |
| v3 2회차 | 변경 없음 · 기록 실행 (`pnpm demo`가 재생하는 배치) | 골든 / 홀드아웃 / 홀드아웃2 | **0 / 0 / 0** | 32/32 · 12/12 · 8/8 | 36/36 · 12/12 · 8/8 | 14 · 5 · 4 |

v2는 v1보다 나아지지 않았다. 바쏠 이용안내의 기한 충돌(7일 vs 20일)을 모델이 실행마다 다르게 해소했고,
프롬프트로는 막지 못했다. v3는 모델이 아니라 데이터 쪽(KB 결함 등록부 + 규칙)에서 풀었다.
v3를 코드 변경 없이 두 번 돌렸더니 C20(욕설 탐지)이 1회차엔 틀리고 2회차엔 맞았다. 판단은 실행마다 흔들리지만 위험한 자동화는 두 번 모두 0이었다.
채점 규칙 변경과 그 이유는 [`data/eval/CHANGELOG.md`](data/eval/CHANGELOG.md)에 모두 있다.

## 실행

```bash
# 직접 모델을 돌리려면: Claude Code 로그인 + Postgres(DATABASE_URL)
pnpm seed                         # 스키마 + 합성 주문/문의
pnpm eval                         # 골든셋 처리 + 채점 (로컬 Claude Code 구독)
LLM_RECORD=1 pnpm eval            # 응답을 data/replay에 기록 (pnpm demo용)
EVAL_SET=holdout2 pnpm eval       # 홀드아웃
pnpm summary                      # 배치별 요약
pnpm trace C13                    # 케이스 트레이스
MOCK_FAULT_RATE=0.2 pnpm eval     # 주문 API 장애 20% 주입(주문번호·시도 순번으로 결정 → 재현 가능)
pnpm dev
```

## 구조

```
db/schema.sql                 orders · tickets · runs · steps · reviews · eval_results
data/kb/*.md                  브랜드별 정책 KB (공개 이용안내 + 브랜드 보이스, 출처 표기)
data/eval/                    golden · holdout · holdout2 · CHANGELOG
data/kb/_issues.json          KB 결함 등록부
scripts/demo.ts               PGlite + 재생으로 전체 평가 재현
src/lib/llm/                  LLMProvider 인터페이스 · claude-code(구독, 기록) · replay(재생)
data/replay/responses.jsonl   기록된 모델 응답 (pnpm demo가 재생)
src/lib/commerce/cafe24.ts    Cafe24 목업 서버 + 재시도 클라이언트
src/lib/pipeline/             schemas · prompts · route(규칙) · run(오케스트레이션 + 트레이스)
src/app/                      받은함 · 문의 상세(초안 편집·트레이스) · 평가 · 설계 결정
```
