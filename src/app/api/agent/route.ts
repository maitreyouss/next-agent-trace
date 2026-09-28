import { z } from "zod";

import { streamTurn } from "@/lib/agent/stream";
import { resolveMode } from "@/lib/agent/run";
import { allow, clientKey, runLimit } from "@/lib/http/rate-limit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  message: z.string().trim().min(1).max(500),
  simulateToolFailure: z.boolean().optional(),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Unreadable request." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: "The message must be between 1 and 500 characters." },
      { status: 400 },
    );
  }

  const mode = resolveMode();
  const limit = runLimit(mode);
  if (!allow(clientKey(request), limit.limit, limit.windowMs)) {
    return Response.json({ error: "Too many runs. Try again later." }, { status: 429 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of streamTurn(
          {
            message: parsed.data.message,
            simulateToolFailure: parsed.data.simulateToolFailure,
            mode,
          },
          request.signal,
        )) {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }
      } catch {
        const line = JSON.stringify({
          type: "error",
          error: "The request failed.",
        });
        controller.enqueue(encoder.encode(`${line}\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
