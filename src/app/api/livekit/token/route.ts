import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function createLiveKitJwt(
  apiKey: string,
  apiSecret: string,
  roomCode: string,
  participantId: string,
  participantName: string
): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: apiKey,
    sub: participantId,
    name: participantName,
    nbf: now,
    exp: now + 6 * 3600,
    video: {
      roomJoin: true,
      room: roomCode,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(signingInput)
    .digest();

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

export async function POST(req: NextRequest) {
  try {
    const { roomCode, userId, displayName } = await req.json();
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (livekitUrl && apiKey && apiSecret) {
      const token = createLiveKitJwt(
        apiKey,
        apiSecret,
        String(roomCode || 'VYBE-ROOM'),
        String(userId || 'guest'),
        String(displayName || 'Participant')
      );
      return NextResponse.json({
        mode: 'livekit-sfu',
        url: livekitUrl,
        token,
      });
    }

    return NextResponse.json({
      mode: 'webrtc-mesh',
      roomCode,
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to issue RTC session' },
      { status: 500 }
    );
  }
}
