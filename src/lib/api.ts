"use client";

import { getSettings } from "./db/actions";

/** Call one of WellFed's own server routes, attaching the optional access code. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const s = await getSettings();
  const headers = new Headers(init.headers);
  if (s.accessCode) headers.set("x-wellfed-code", s.accessCode);
  if (init.body && typeof init.body === "string") headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers });
  } catch {
    throw new Error("You appear to be offline. This feature needs a connection.");
  }
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
}
