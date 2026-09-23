import postgres from "postgres";

// 서버리스(Vercel)와 로컬 스크립트가 같은 드라이버를 쓴다. Neon pooled URL이면 prepare를 꺼야 한다.
const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) throw new Error("DATABASE_URL이 없습니다. vercel env pull 로 .env.local을 받으세요.");

const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

export const sql =
  globalForDb.sql ??
  postgres(url, {
    ssl: url.includes("localhost") ? false : "require",
    prepare: false,
    max: process.env.VERCEL_REGION ? 1 : 5,
    idle_timeout: 20,
  });

if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;
