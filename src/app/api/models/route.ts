// Which models can run on this server, for the playground's model picker.
//   GET /api/models -> { models: [{ id, available, note, reason? }] }
// Only yes/no and short notes leave the server: never keys, URLs or other env values.
import { modelAvailability } from "@/agent/models";
import { probeGateway } from "@/agent/gateway";
import { RATE_LIMITS, rateLimiter } from "@/lib/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limit = rateLimiter(RATE_LIMITS.models);

export async function GET(request: Request) {
  const limited = limit(request);
  if (limited) return limited;
  // Short-timeout and cached: a down gateway marks its model unavailable
  // instead of slowing the picker. Never throws.
  await probeGateway();
  return Response.json(
    { models: modelAvailability() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
