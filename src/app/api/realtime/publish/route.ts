import { NextRequest, NextResponse } from 'next/server';
import { getVybeServerStore } from '@/lib/server/vybeStore';
import { RealtimeRoomEvent } from '@/types/vybe';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const channel = String(body.channel || `room:${String(body.event?.roomCode || '').toUpperCase()}`);
    const event = body.event as RealtimeRoomEvent;

    if (!event || !event.type) {
      return NextResponse.json(
        { error: 'Invalid event payload' },
        { status: 400, headers: corsHeaders }
      );
    }

    const store = getVybeServerStore();
    store.publishEvent(channel, event);

    return NextResponse.json({ ok: true, ts: Date.now() }, { headers: corsHeaders });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to publish event' },
      { status: 500, headers: corsHeaders }
    );
  }
}
