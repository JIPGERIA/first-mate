// 스키마 적용 + 골든셋의 합성 주문/문의를 적재한다. 여러 번 실행해도 안전하다.
import { readFileSync } from "node:fs";
import { sql } from "@/lib/db";
import { loadGolden } from "@/lib/eval/golden";

async function main() {
  await sql.unsafe(readFileSync("db/schema.sql", "utf8"));
  const cases = [...loadGolden("golden").cases, ...loadGolden("holdout").cases, ...loadGolden("holdout2").cases];
  let orders = 0;
  for (const c of cases) {
    if (c.order) {
      const o = c.order;
      await sql`
        insert into orders ${sql({ ...o, buyer_name: c.customer, items: sql.json(o.items as never) } as never)}
        on conflict (order_id) do update set order_status = excluded.order_status, items = excluded.items`;
      orders++;
    }
    await sql`
      insert into tickets (case_id, channel, brand_hint, customer, body, scenario, received_at)
      values (${c.id}, 'channeltalk', ${c.brand_hint}, ${c.customer}, ${c.body}, ${c.scenario}, now() - (${(c.id.startsWith("C") ? 40 : 0) + 50 - Number(c.id.slice(1))} * interval '7 minutes'))
      on conflict (case_id) do update set body = excluded.body, scenario = excluded.scenario, brand_hint = excluded.brand_hint`;
  }
  console.log(`seeded: ${orders} orders, ${cases.length} tickets`);
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
