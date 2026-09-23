-- First Mate schema. 재실행 가능(idempotent)하게 작성한다.

-- Cafe24 주문 데이터를 흉내 낸 원천 테이블. 실제 연동 시 이 테이블 대신 Cafe24 Admin API를 호출한다.
create table if not exists orders (
  order_id       text primary key,            -- 예: 20260921-0000118
  brand          text not null,
  buyer_name     text not null,
  order_date     timestamptz not null,
  payment_amount integer not null,             -- 원
  shipping_fee   integer not null default 0,
  order_status   text not null,                -- N00 입금전 · N10 상품준비중 · N20 배송준비중 · N30 배송중 · N40 배송완료 · C00 취소신청 · R00 반품신청
  shipped_date   timestamptz,
  delivered_date timestamptz,
  courier        text,
  tracking_no    text,
  items          jsonb not null                -- [{product_name, option, quantity, price}]
);

-- 채널톡 등에서 들어온 고객 문의
create table if not exists tickets (
  id           serial primary key,
  channel      text not null default 'channeltalk',
  brand_hint   text,                            -- 문의가 들어온 브랜드 채널 (없을 수 있음)
  customer     text not null,
  body         text not null,
  received_at  timestamptz not null default now(),
  status       text not null default 'pending', -- pending → drafted → approved | edited | rejected / failed
  is_synthetic boolean not null default true,
  scenario     text,                            -- 합성 데이터의 시나리오 설명 (평가·시연용)
  case_id      text unique                      -- 골든셋 케이스 ID
);
create index if not exists tickets_status_idx on tickets (status);

-- 파이프라인 1회 실행 = run. 비용·지연·결과를 모두 남긴다.
create table if not exists runs (
  id              serial primary key,
  ticket_id       integer references tickets(id) on delete cascade,
  eval_case_id    text,                         -- 평가셋 실행이면 케이스 ID
  eval_batch      text,                         -- 같은 평가 실행 묶음
  provider        text not null,                -- claude-code | anthropic-api
  prompt_version  text not null,
  status          text not null default 'running', -- running | ok | error
  error           text,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  total_ms        integer,
  input_tokens    integer not null default 0,
  output_tokens   integer not null default 0,
  cache_read_tokens integer not null default 0,
  cost_usd_list   numeric(10,5) not null default 0, -- API 정가 기준 환산 비용 (구독 실행 시 실제 과금 아님)
  triage          jsonb,
  order_snapshot  jsonb,
  route           text,                         -- auto_ready | human_review | human_only
  route_reasons   jsonb,
  draft           text,
  citations       jsonb
);
create index if not exists runs_ticket_idx on runs (ticket_id, started_at desc);
create index if not exists runs_eval_idx on runs (eval_batch);

-- run 안의 단계별 트레이스 (triage / order_lookup / draft / route)
create table if not exists steps (
  id          serial primary key,
  run_id      integer not null references runs(id) on delete cascade,
  seq         integer not null,
  name        text not null,
  status      text not null,                    -- ok | error | skipped
  attempts    integer not null default 1,
  ms          integer not null,
  detail      jsonb,
  error       text
);
create index if not exists steps_run_idx on steps (run_id, seq);

-- 상담원의 최종 처리. 초안 대비 수정량이 코파일럿 품질의 현장 지표다.
create table if not exists reviews (
  id          serial primary key,
  ticket_id   integer not null references tickets(id) on delete cascade,
  run_id      integer not null references runs(id) on delete cascade,
  action      text not null,                    -- approved | edited | rejected
  final_text  text,
  edit_ratio  numeric(5,4),                     -- 0 = 그대로 승인, 1 = 전부 다시 씀
  reviewer    text not null default 'demo',
  created_at  timestamptz not null default now()
);

-- 평가셋 채점 결과
create table if not exists eval_results (
  id            serial primary key,
  eval_batch    text not null,
  case_id       text not null,
  run_id        integer references runs(id) on delete set null,
  expected      jsonb not null,
  actual        jsonb,
  brand_ok      boolean,
  intent_ok     boolean,
  route_ok      boolean,
  unsafe_auto   boolean,                        -- 사람이 봐야 하는데 auto_ready로 보낸 경우 (가장 치명적인 오류)
  policy_ok     boolean,                        -- 필수 정책 사실이 초안에 들어갔는지
  created_at    timestamptz not null default now()
);
create index if not exists eval_results_batch_idx on eval_results (eval_batch);
