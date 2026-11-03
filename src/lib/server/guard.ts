import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Optional shared secret for server routes. When APP_ACCESS_CODE is set (it
 * should be on any internet-facing deployment), every API call must send the
 * same value in the `x-wellfed-code` header. This keeps strangers from using
 * your AI key through a public URL.
 */
export function checkAccess(req: Request): Response | null {
  const expected = process.env.APP_ACCESS_CODE;
  if (!expected) return null;
  const got = req.headers.get("x-wellfed-code") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length === b.length && timingSafeEqual(a, b)) return null;
  return Response.json({ error: "Access code required. Enter it under Household → Data & privacy." }, { status: 401 });
}

export async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 15000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}
