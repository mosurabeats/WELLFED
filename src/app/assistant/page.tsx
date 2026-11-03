"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Sparkles, Cpu, WifiOff } from "lucide-react";
import { useData } from "@/lib/data-context";
import { api } from "@/lib/api";
import { parseLocally } from "@/lib/assistant/local-parser";
import { buildContext, executeActions } from "@/lib/assistant/execute";
import type { AssistantResult } from "@/lib/assistant/schema";
import { Badge, PageHeader, cn } from "@/components/ui";

type Msg = { role: "user" | "assistant"; text: string; lines?: string[]; goto?: string; via?: string; ok?: boolean };

const EXAMPLES = [
  "I have $90 to feed four people for five days, two meals per day. Prioritize balanced nutrition and use local grocery deals.",
  "Make this week's meals higher in protein.",
  "Replace Wednesday's dinner with something the kids will like.",
  "Use the chicken and potatoes already in my refrigerator.",
  "Find cheaper alternatives without reducing protein too much.",
  "Make tomorrow's dinner take less than 30 minutes.",
  "Plan meals around this week's Hannaford specials.",
];

export default function AssistantPage() {
  const data = useData();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [providers, setProviders] = useState<{ anthropic: boolean; openai: boolean } | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<{ providers: { anthropic: boolean; openai: boolean } }>("/api/ai/status").then((r) => setProviders(r.providers)).catch(() => setProviders({ anthropic: false, openai: false }));
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const aiOn = data.settings.aiProvider !== "none" && !!providers && (providers.anthropic || providers.openai);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: message }]);
    setBusy(true);
    let result: AssistantResult;
    let via = "Offline parser";
    try {
      if (!aiOn) throw new Error("offline");
      const r = await api<AssistantResult & { provider: string }>("/api/ai/assistant", {
        method: "POST",
        body: JSON.stringify({ message, provider: data.settings.aiProvider, context: buildContext(data) }),
      });
      result = r;
      via = r.provider === "openai" ? "OpenAI" : "Claude";
    } catch (e) {
      result = parseLocally(message, data.ingredients);
      if (aiOn && e instanceof Error && e.message !== "offline") via = `Offline parser (AI unavailable: ${e.message})`;
    }
    try {
      await new Promise((r) => setTimeout(r, 20));
      const exec = result.actions.length ? await executeActions(result.actions, data) : { lines: [], ok: true };
      setMsgs((m) => [...m, { role: "assistant", text: result.reply, lines: exec.lines, goto: "goto" in exec ? exec.goto : undefined, via, ok: exec.ok }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: "Something went wrong running that.", lines: [e instanceof Error ? e.message : String(e)], via, ok: false }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rise flex min-h-[calc(100dvh-180px)] flex-col">
      <PageHeader
        eyebrow="Assistant"
        title="Ask WellFed"
        subtitle="Plain-English requests, executed by the planner. Prices and nutrition always come from your data."
        action={providers && <Badge tone={aiOn ? "forest" : "gold"}>{aiOn ? <><Cpu className="h-3 w-3" /> AI on</> : <><WifiOff className="h-3 w-3" /> Offline mode</>}</Badge>}
      />

      <div className="flex-1 space-y-3">
        {msgs.length === 0 && (
          <div className="space-y-2">
            <div className="eyebrow">Try one</div>
            {EXAMPLES.map((e) => (
              <button key={e} onClick={() => send(e)} className="block w-full rounded-2xl border border-ink/10 bg-cream-100 px-4 py-3 text-left text-[14.5px] leading-snug text-ink-600 transition hover:border-orange/50 hover:text-ink">
                &ldquo;{e}&rdquo;
              </button>
            ))}
            {!aiOn && providers && (
              <p className="pt-2 text-xs text-ink-400">No AI key is configured on the server, so a built-in parser handles requests like these. Add ANTHROPIC_API_KEY or OPENAI_API_KEY for free-form requests.</p>
            )}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={cn("rise flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[88%] rounded-3xl px-4 py-3 text-[15px] leading-snug", m.role === "user" ? "rounded-br-lg bg-forest text-cream-100" : "rounded-bl-lg border border-ink/10 bg-cream-100")}>
              {m.role === "assistant" && <div className="mb-1 flex items-center gap-1 text-[11px] font-bold text-orange-700"><Sparkles className="h-3 w-3" /> {m.via}</div>}
              <div>{m.text}</div>
              {m.lines && m.lines.length > 0 && (
                <div className={cn("mt-2 space-y-1 rounded-2xl p-2.5 text-[13.5px]", m.ok === false ? "bg-tomato-100 text-tomato" : "bg-forest-50 text-forest")}>
                  {m.lines.map((l, j) => <div key={j}>{l}</div>)}
                </div>
              )}
              {m.goto && <Link href={m.goto} className="mt-2 inline-block text-sm font-bold text-orange-700">Open {m.goto === "/plan" ? "meal plan" : "page"} →</Link>}
            </div>
          </div>
        ))}
        {busy && <div className="flex gap-1 px-2 py-3">{[0, 1, 2].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-orange" style={{ animationDelay: `${d * 120}ms` }} />)}</div>}
        <div ref={end} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="sticky bottom-[calc(84px+var(--safe-bottom))] mt-4 flex items-end gap-2 rounded-3xl border border-ink/15 bg-cream-100 p-2 shadow-[var(--shadow-pop)] md:bottom-6">
        <textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder="e.g. $120 for the week, dinners only, under 30 minutes"
          className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-[16px] outline-none placeholder:text-ink-300"
          aria-label="Message"
        />
        <button type="submit" disabled={!input.trim() || busy} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange text-white disabled:opacity-40" aria-label="Send"><ArrowUp className="h-5 w-5" /></button>
      </form>
    </div>
  );
}
