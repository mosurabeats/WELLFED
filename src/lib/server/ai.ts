import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { fetchWithTimeout } from "./guard";

/**
 * Provider abstraction. The AI only ever returns structured JSON that the app
 * validates with Zod and then executes through its deterministic engine —
 * it never supplies prices, nutrition values or allergen decisions.
 */
export type Provider = "anthropic" | "openai";

export type Block =
  | { type: "text"; text: string }
  | { type: "image"; mime: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string }
  | { type: "pdf"; data: string };

export function availableProviders(): Record<Provider, boolean> {
  return { anthropic: !!process.env.ANTHROPIC_API_KEY, openai: !!process.env.OPENAI_API_KEY };
}

export function pickProvider(preferred?: string | null): Provider | null {
  const av = availableProviders();
  if (preferred === "none") return null;
  if (preferred === "openai" && av.openai) return "openai";
  if (preferred === "anthropic" && av.anthropic) return "anthropic";
  if (av.anthropic) return "anthropic";
  if (av.openai) return "openai";
  return null;
}

export class AIError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

export async function completeJSON<S extends z.ZodType>(opts: {
  provider: Provider;
  system: string;
  content: Block[];
  schema: S;
  name: string;
}): Promise<z.infer<S>> {
  return opts.provider === "anthropic" ? anthropicJSON(opts) : openaiJSON(opts);
}

async function anthropicJSON<S extends z.ZodType>({ system, content, schema }: { system: string; content: Block[]; schema: S }): Promise<z.infer<S>> {
  const client = new Anthropic();
  const blocks: Anthropic.ContentBlockParam[] = content.map((b) => {
    if (b.type === "text") return { type: "text", text: b.text };
    if (b.type === "image") return { type: "image", source: { type: "base64", media_type: b.mime, data: b.data } };
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: b.data } };
  });
  try {
    const res = await client.messages.parse({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content: blocks }],
      output_config: { format: zodOutputFormat(schema), effort: "low" },
    });
    if (res.stop_reason === "refusal") throw new AIError("The AI declined this request. Try rephrasing it.", 422);
    if (res.stop_reason === "max_tokens") throw new AIError("The AI response was cut off. Try a smaller request or flyer page.", 502);
    if (res.parsed_output == null) throw new AIError("The AI returned an unreadable answer.", 502);
    return res.parsed_output as z.infer<S>;
  } catch (e) {
    if (e instanceof AIError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new AIError("Anthropic API key was rejected.", 502);
    if (e instanceof Anthropic.RateLimitError) throw new AIError("AI rate limit reached — wait a minute and try again.", 429);
    if (e instanceof Anthropic.BadRequestError) throw new AIError(`AI request rejected: ${e.message}`, 400);
    if (e instanceof Anthropic.APIError) throw new AIError(`AI service error (${e.status}).`, 502);
    throw new AIError("Couldn't reach the AI service.", 502);
  }
}

async function openaiJSON<S extends z.ZodType>({ system, content, schema, name }: { system: string; content: Block[]; schema: S; name: string }): Promise<z.infer<S>> {
  const parts = content.map((b) => {
    if (b.type === "text") return { type: "text", text: b.text };
    if (b.type === "image") return { type: "image_url", image_url: { url: `data:${b.mime};base64,${b.data}` } };
    return { type: "file", file: { filename: "flyer.pdf", file_data: `data:application/pdf;base64,${b.data}` } };
  });
  const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: parts },
      ],
      response_format: { type: "json_schema", json_schema: { name, schema: z.toJSONSchema(schema), strict: false } },
    }),
  }, 90000).catch(() => {
    throw new AIError("Couldn't reach OpenAI.", 502);
  });
  if (res.status === 401) throw new AIError("OpenAI API key was rejected.", 502);
  if (res.status === 429) throw new AIError("AI rate limit reached — try again shortly.", 429);
  if (!res.ok) throw new AIError(`OpenAI error (${res.status}).`, 502);
  const json = (await res.json()) as { choices?: { message?: { content?: string; refusal?: string } }[] };
  const msg = json.choices?.[0]?.message;
  if (msg?.refusal) throw new AIError("The AI declined this request.", 422);
  try {
    return schema.parse(JSON.parse(msg?.content ?? ""));
  } catch {
    throw new AIError("The AI returned an unreadable answer.", 502);
  }
}

/** Shared route helper: parse body, check provider, map errors to JSON responses. */
export function aiErrorResponse(e: unknown): Response {
  if (e instanceof AIError) return Response.json({ error: e.message }, { status: e.status });
  if (e instanceof z.ZodError) return Response.json({ error: "Invalid request." }, { status: 400 });
  return Response.json({ error: "Unexpected error." }, { status: 500 });
}
