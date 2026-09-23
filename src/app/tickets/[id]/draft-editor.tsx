"use client";

import { useState } from "react";
import { submitReview } from "./actions";

export function DraftEditor({ ticketId, runId, draft, disabled }: { ticketId: number; runId: number; draft: string; disabled: boolean }) {
  const [text, setText] = useState(draft);
  const changed = text.trim() !== draft.trim();
  return (
    <form action={submitReview} className="space-y-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="runId" value={runId} />
      <textarea
        name="finalText"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
        rows={10}
        className="w-full rounded-md border border-line bg-paper/50 p-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button name="intent" value="approve" disabled={disabled} className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">
          {changed ? "수정해서 발송" : "그대로 승인"}
        </button>
        <button name="intent" value="reject" disabled={disabled} className="rounded-md border border-line px-3 py-1.5 text-sm disabled:opacity-40">
          반려 (직접 응대)
        </button>
        <span className="text-xs text-muted">시연용: 실제 고객에게 발송되지 않고 수정량만 기록됩니다.</span>
      </div>
    </form>
  );
}
