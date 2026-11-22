import { NextRequest } from 'next/server';
import { getVybeServerStore } from '@/lib/server/vybeStore';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const channel = req.nextUrl.searchParams.get('channel') || 'global';
  const store = getVybeServerStore();
  const encoder = new TextEncoder();

  let unsubscribe: (() => void) | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'CONNECTED', channel, ts: Date.now() })}\n\n`)
      );

      unsubscribe = store.subscribe((payload) => {
        if (payload.channel === channel || channel === 'global') {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload.event)}\n\n`));
          } catch {
            // Stream closed
          }
        }
      });

      pingTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
        } catch {
          // Stream closed
        }
      }, 15000);
    },
    cancel() {
      if (unsubscribe) unsubscribe();
      if (pingTimer) clearInterval(pingTimer);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
