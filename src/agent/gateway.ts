/**
 * The local h2a gateway in OpenAI mode, for the demo's live runs. Server only.
 *
 * The gateway speaks the OpenAI wire (`POST /v1/chat/completions`, `GET
 * /v1/models`) but mints no static key: the server mints its own session at
 * startup over loopback (`POST <base>/session` with a fresh session id) and
 * sends the returned token as `Authorization: Bearer`. The token lives in
 * module memory only: it is never logged and never written to disk.
 *
 * Configuration names (no secret values anywhere):
 *   DEMO_GATEWAY_URL   base URL, default http://127.0.0.1:3002/v1
 *   DEMO_MODEL         catalog model id, default gemini-3.8-flash
 *
 * When the gateway does not answer, every failure is a GatewayUnreachable
 * with visitor-safe words: the agent shows them instead of crashing, and the
 * static samples keep working (they never touch the gateway).
 */
import OpenAI from "openai";
import { GATEWAY_RUNS_PER_MINUTE } from "@/lib/limits";

const DEFAULT_BASE_URL = "http://127.0.0.1:3002/v1";
const DEFAULT_MODEL = "gemini-3.8-flash";

export const gatewayBaseURL = () =>
  process.env.DEMO_GATEWAY_URL ?? DEFAULT_BASE_URL;

/** The catalog model id the gateway serves. A name, not a secret. */
export const gatewayModelName = () => process.env.DEMO_MODEL ?? DEFAULT_MODEL;

/** What a visitor reads when the gateway does not answer. Names no values. */
export const GATEWAY_DOWN_MESSAGE =
  "The local gateway isn't answering. Static samples still work — start the gateway and retry, or pick another model.";

/** The gateway is down, refused the session, or rejected the token. */
export class GatewayUnreachable extends Error {
  constructor() {
    super(GATEWAY_DOWN_MESSAGE);
    this.name = "GatewayUnreachable";
  }
}

/** Session minting only ever goes to loopback. */
function isLoopback(raw: string) {
  try {
    const u = new URL(raw);
    return (
      u.protocol === "http:" &&
      (u.hostname === "localhost" ||
        u.hostname === "127.0.0.1" ||
        u.hostname === "[::1]")
    );
  } catch {
    return false;
  }
}

const trim = (base: string) => base.replace(/\/+$/, "");

let token: string | undefined;
let minting: Promise<string> | undefined;

/** One session token from the loopback gateway. Throws GatewayUnreachable. */
async function mint(): Promise<string> {
  const base = gatewayBaseURL();
  if (!isLoopback(base)) throw new GatewayUnreachable();
  let res: Response;
  try {
    res = await fetch(`${trim(base)}/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: crypto.randomUUID() }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new GatewayUnreachable();
  }
  if (!res.ok) throw new GatewayUnreachable();
  let body: { gatewayToken?: unknown };
  try {
    body = (await res.json()) as { gatewayToken?: unknown };
  } catch {
    throw new GatewayUnreachable();
  }
  if (typeof body.gatewayToken !== "string" || !body.gatewayToken)
    throw new GatewayUnreachable();
  return body.gatewayToken;
}

/** The cached session token, minting one over loopback on first use. */
export function gatewayToken(): Promise<string> {
  if (token) return Promise.resolve(token);
  minting ??= mint().then(
    (t) => {
      token = t;
      minting = undefined;
      return t;
    },
    (err) => {
      minting = undefined;
      throw err;
    },
  );
  return minting;
}

async function gatewayFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const send = (t: string) => {
    const headers = new Headers(init?.headers);
    headers.set("authorization", `Bearer ${t}`);
    return fetch(input, { ...init, headers });
  };
  const first = await send(await gatewayToken());
  // A rotated token fails once, then works: mint again and retry a single time.
  if (first.status === 401) {
    token = undefined;
    return send(await gatewayToken());
  }
  return first;
}

/** An OpenAI client pointed at the local gateway, auth from memory only. */
export function gatewayClient(): OpenAI {
  return new OpenAI({
    baseURL: gatewayBaseURL(),
    apiKey: "h2a-session",
    fetch: gatewayFetch,
  });
}

/* ───────────────────────── reachability probe ───────────────────────── */

/**
 * Whether the gateway answered recently. Any HTTP answer counts (even a 401:
 * the models endpoint needs the session token, so a refusal still proves the
 * gateway is up). Cached briefly so the model picker never waits on it twice.
 */
let probe: { ok: boolean; at: number } | undefined;
const PROBE_TTL_MS = 30_000;

export async function probeGateway(): Promise<boolean> {
  if (probe && Date.now() - probe.at < PROBE_TTL_MS) return probe.ok;
  let ok = false;
  try {
    const res = await fetch(`${trim(gatewayBaseURL())}/models`, {
      signal: AbortSignal.timeout(2000),
    });
    await res.arrayBuffer().catch(() => undefined);
    ok = true;
  } catch {
    ok = false;
  }
  probe = { ok, at: Date.now() };
  return ok;
}

/** The last probe outcome, if any: the picker stays optimistic until one fails. */
export function gatewayLastKnown(): boolean | undefined {
  return probe?.ok;
}

/* ───────────────────────── demo rate limit ───────────────────────── */

/**
 * About GATEWAY_RUNS_PER_MINUTE gateway runs per minute, in memory. The demo
 * spends the owner's seat, so a run past the window is refused with seconds
 * until it may go ahead.
 */
let stamps: number[] = [];
const WINDOW_MS = 60_000;

export function takeGatewaySlot(
  now = Date.now(),
): { ok: true } | { ok: false; retryAfter: number } {
  stamps = stamps.filter((s) => now - s < WINDOW_MS);
  if (stamps.length >= GATEWAY_RUNS_PER_MINUTE)
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((stamps[0] + WINDOW_MS - now) / 1000)),
    };
  stamps.push(now);
  return { ok: true };
}
