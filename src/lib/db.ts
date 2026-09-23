import postgres from "postgres";

// 서버리스(Vercel)와 로컬 스크립트가 같은 드라이버를 쓴다. Neon pooled URL이면 prepare를 꺼야 한다.
const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) throw new Error("DATABASE_URL이 없습니다. vercel env pull 로 .env.local을 받으세요.");

const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

export const sql =
  globalForDb.sql ??
  postgres(url, {
    ssl: /localhost|127\.0\.0\.1/.test(url) ? false : "require",
    prepare: false,
    // Vercel 함수는 1개, 로컬 데모(PGlite 소켓)는 연결을 하나만 받으므로 DB_POOL_MAX=1
    max: Number(process.env.DB_POOL_MAX ?? (process.env.VERCEL_REGION ? 1 : 5)),
    idle_timeout: 20,
  });

if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;
