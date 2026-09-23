"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";

/** 문자 단위 편집거리 / 긴 쪽 길이. 0 = 그대로 승인, 1 = 전부 다시 씀 */
function editRatio(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n] / Math.max(m, n, 1);
}

export async function submitReview(formData: FormData) {
  const ticketId = Number(formData.get("ticketId"));
  const runId = Number(formData.get("runId"));
  const intent = String(formData.get("intent"));
  const finalText = String(formData.get("finalText") ?? "").trim();
  const [run] = await sql<{ draft: string | null }[]>`select draft from runs where id = ${runId} and ticket_id = ${ticketId}`;
  if (!run) throw new Error("run not found");

  const ratio = intent === "reject" ? 1 : editRatio(run.draft ?? "", finalText);
  const action = intent === "reject" ? "rejected" : ratio === 0 ? "approved" : "edited";
  await sql`insert into reviews (ticket_id, run_id, action, final_text, edit_ratio)
            values (${ticketId}, ${runId}, ${action}, ${intent === "reject" ? null : finalText}, ${ratio.toFixed(4)})`;
  await sql`update tickets set status = ${action} where id = ${ticketId}`;
  revalidatePath("/");
  redirect(`/tickets/${ticketId}`);
}
