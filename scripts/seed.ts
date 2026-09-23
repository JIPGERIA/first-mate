// 스키마 적용 + 합성 주문/문의 적재
import { sql } from "@/lib/db";
import { seedAll } from "@/lib/eval/seed";

seedAll()
  .then(async ({ orders, tickets }) => { console.log(`seeded: ${orders} orders, ${tickets} tickets`); await sql.end(); })
  .catch((e) => { console.error(e); process.exit(1); });
