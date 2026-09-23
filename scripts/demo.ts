// API 키·구독·DB 설치 없이 평가 수치를 재현한다.
//   pnpm demo           → 내장 Postgres(PGlite) + 기록된 모델 응답 재생으로 세 세트 평가 후 요약
//   pnpm demo --serve   → 위를 마친 뒤 같은 DB로 상담원 콘솔(localhost:3000)을 띄운다
import { spawn } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const PORT = Number(process.env.DEMO_DB_PORT ?? 54329);

async function main() {
  const serve = process.argv.includes("--serve");
  const db = await PGlite.create();
  const server = new PGLiteSocketServer({ db, port: PORT, host: "127.0.0.1" });
  await server.start();

  // db 모듈은 import 시점에 DATABASE_URL을 읽으므로 환경변수를 먼저 정하고 동적으로 불러온다
  Object.assign(process.env, {
    DATABASE_URL: `postgres://postgres@127.0.0.1:${PORT}/postgres`,
    DB_POOL_MAX: "1",
    LLM_PROVIDER: "replay",
    MOCK_FAULT_RATE: process.env.MOCK_FAULT_RATE ?? "0.2",
  });
  const { sql } = await import("@/lib/db");
  const { seedAll } = await import("@/lib/eval/seed");
  const { getProvider } = await import("@/lib/llm");
  const { runEval, summarize, formatSummary } = await import("@/lib/eval/runner");

  console.log(`내장 Postgres(PGlite) 127.0.0.1:${PORT} · 모델 응답: data/replay (기록 재생) · 주문 API 장애 주입 ${Number(process.env.MOCK_FAULT_RATE) * 100}%\n`);
  const seeded = await seedAll();
  console.log(`시드: 주문 ${seeded.orders}건, 문의 ${seeded.tickets}건`);

  const llm = await getProvider();
  const started = Date.now();
  for (const set of ["golden", "holdout", "holdout2"] as const) {
    await runEval({ set, llm, concurrency: 1, label: "replay", quiet: true });
  }
  console.log(`평가 ${((Date.now() - started) / 1000).toFixed(1)}초\n`);
  for (const s of await summarize()) console.log(formatSummary(s));
  await sql.end();

  if (!serve) {
    await server.stop();
    await db.close();
    return;
  }
  console.log("\n상담원 콘솔: http://localhost:3000  (Ctrl+C로 종료)");
  const next = spawn("pnpm", ["exec", "next", "dev"], { stdio: "inherit", env: process.env });
  const stop = async () => { next.kill("SIGINT"); await server.stop(); await db.close(); process.exit(0); };
  process.on("SIGINT", stop);
  next.on("exit", stop);
}
main().catch((e) => { console.error(e); process.exit(1); });
