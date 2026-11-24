import {
  ChatMessage,
  QueueItem,
  RealtimeRoomEvent,
  RoomInvitation,
  RoomParticipant,
  SavedWatchlist,
  SiteMovieItem,
  UserProfile,
  WatchRoom,
} from '../src/types/vybe';
import { AVATAR_PRESETS, SUPPORTED_NETFLIX_TITLES } from '../src/lib/constants';
import { generateRoomCode } from '../src/lib/utils';

interface Env {
  ASSETS: {
    fetch: (req: Request) => Promise<Response>;
  };
}

interface EdgeDb {
  users: Record<string, UserProfile>;
  rooms: Record<string, WatchRoom & { password?: string }>;
  messagesByRoom: Record<string, ChatMessage[]>;
  watchlistsByUser: Record<string, SavedWatchlist[]>;
  invitations: RoomInvitation[];
  siteMovies: SiteMovieItem[];
}

type SseListener = (payload: { channel: string; event: RealtimeRoomEvent }) => void;

const listeners = new Set<SseListener>();

function createInitialDb(): EdgeDb {
  return {
    users: {},
    rooms: {},
    messagesByRoom: {},
    watchlistsByUser: {},
    invitations: [],
    siteMovies: [],
  };
}

const db: EdgeDb = createInitialDb();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

function publishEvent(channel: string, event: RealtimeRoomEvent) {
  const roomCode = event.roomCode?.toUpperCase();
  const room = roomCode ? db.rooms[roomCode] : undefined;

  if (room) {
    if (event.type === 'PLAYBACK_SYNC') {
      if (event.playback.seq >= room.playback.seq) {
        room.playback = { ...event.playback };
      }
    } else if (event.type === 'CHAT_MESSAGE') {
      const list = db.messagesByRoom[roomCode] || [];
      if (!list.some((m) => m.id === event.message.id)) {
        list.push(event.message);
        db.messagesByRoom[roomCode] = list.slice(-200);
      }
    } else if (event.type === 'CHAT_REACTION') {
      const list = db.messagesByRoom[roomCode] || [];
      const msg = list.find((m) => m.id === event.messageId);
      if (msg) {
        const existing = msg.reactions[event.emoji] || [];
        if (existing.includes(event.userId)) {
          msg.reactions[event.emoji] = existing.filter((id) => id !== event.userId);
          if (msg.reactions[event.emoji].length === 0) delete msg.reactions[event.emoji];
        } else {
          msg.reactions[event.emoji] = [...existing, event.userId];
        }
      }
    } else if (event.type === 'PARTICIPANT_HEARTBEAT') {
      const idx = room.participants.findIndex((p) => p.userId === event.participant.userId);
      if (idx >= 0) {
        room.participants[idx] = {
          ...room.participants[idx],
          ...event.participant,
          lastActiveAt: Date.now(),
        };
      }
    }
  }

  for (const listener of listeners) {
    try {
      listener({ channel, event });
    } catch {
      // Ignore
    }
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // 1. /api/state
    if (url.pathname === '/api/state') {
      if (req.method === 'GET') {
        const userId = url.searchParams.get('userId') || 'default';
        const rooms = Object.values(db.rooms)
          .filter((r) => r.isActive)
          .map(({ password, ...safe }) => safe);
        const users = Object.values(db.users);
        const watchlists = db.watchlistsByUser[userId] || [];
        const invitations = db.invitations.filter(
          (inv) =>
            !inv.recipientId ||
            inv.recipientId === userId ||
            inv.recipientEmail?.toLowerCase() === db.users[userId]?.username?.toLowerCase() ||
            inv.recipientEmail?.toLowerCase() === db.users[userId]?.email?.toLowerCase()
        );
        return jsonResponse({
          rooms,
          users,
          watchlists,
          invitations,
          siteMovies: db.siteMovies?.length ? db.siteMovies : [],
        });
      }
      if (req.method === 'POST') {
        const body = (await req.json()) as Record<string, any>;
        if (body.action === 'UPSERT_USER' && body.user?.id) {
          const existing = db.users[body.user.id];
          db.users[body.user.id] = {
            ...(existing || {}),
            ...body.user,
            friendIds: body.user.friendIds || existing?.friendIds || [],
          };
          return jsonResponse({ user: db.users[body.user.id] });
        }
        if (body.action === 'LOGIN_EMAIL') {
          const identifier = String(body.email || '')
            .trim()
            .toLowerCase()
            .replace(/^@/, '');
          const found = Object.values(db.users).find(
            (u) =>
              u.email?.toLowerCase() === identifier ||
              u.username?.toLowerCase() === identifier
          );
          return jsonResponse({ user: found || null });
        }
        if (body.action === 'ADD_FRIEND') {
          const userId = String(body.userId || '');
          const cleanQuery = String(body.targetQuery || '')
            .trim()
            .toLowerCase()
            .replace(/^@/, '');
          const targetUser = Object.values(db.users).find(
            (u) =>
              u.id !== userId &&
              (u.id.toLowerCase() === cleanQuery ||
                u.username?.toLowerCase() === cleanQuery ||
                u.displayName?.toLowerCase() === cleanQuery ||
                u.email?.toLowerCase() === cleanQuery)
          );
          if (!targetUser) {
            return jsonResponse(
              {
                error: `No user found with "@${cleanQuery}". Ask your friend to create an account first!`,
              },
              404
            );
          }
          if (db.users[userId]) {
            const setA = new Set(db.users[userId].friendIds || []);
            setA.add(targetUser.id);
            db.users[userId].friendIds = Array.from(setA);
          }
          const setB = new Set(targetUser.friendIds || []);
          setB.add(userId);
          targetUser.friendIds = Array.from(setB);
          return jsonResponse({
            user: db.users[userId],
            addedFriend: targetUser,
          });
        }
        if (body.action === 'REMOVE_FRIEND') {
          const { userId, friendId } = body;
          if (db.users[userId]) {
            db.users[userId].friendIds = (db.users[userId].friendIds || []).filter(
              (id) => id !== friendId
            );
          }
          return jsonResponse({ user: db.users[userId] });
        }
        if (body.action === 'ADD_SITE_MOVIE' && body.movie) {
          db.siteMovies.unshift(body.movie);
          return jsonResponse({ siteMovies: db.siteMovies });
        }
        if (body.action === 'SAVE_WATCHLIST') {
          db.watchlistsByUser[body.userId || 'default'] = [body.watchlist];
          return jsonResponse({ watchlists: db.watchlistsByUser[body.userId || 'default'] });
        }
        if (body.action === 'CREATE_INVITATION') {
          db.invitations.unshift(body.invitation);
          return jsonResponse({ invitations: db.invitations });
        }
        if (body.action === 'RESPOND_INVITATION') {
          const inv = db.invitations.find((i) => i.id === body.invitationId);
          if (inv) inv.status = body.status;
          return jsonResponse({ invitations: db.invitations });
        }
        return jsonResponse({ ok: true });
      }
    }

    // 2. /api/rooms
    if (url.pathname === '/api/rooms') {
      if (req.method === 'GET') {
        const code = url.searchParams.get('code')?.trim().toUpperCase();
        if (code) {
          const room = db.rooms[code];
          if (!room) return jsonResponse({ error: 'Room not found' }, 404);
          const { password, ...safe } = room;
          return jsonResponse({ room: safe, messages: db.messagesByRoom[code] || [] });
        }
        const rooms = Object.values(db.rooms)
          .filter((r) => r.isActive)
          .map(({ password, ...safe }) => safe);
        return jsonResponse({ rooms });
      }

      if (req.method === 'POST') {
        const body = (await req.json()) as Record<string, any>;
        let code = body.code ? String(body.code).toUpperCase() : generateRoomCode();
        while (db.rooms[code]) code = generateRoomCode();
        const nowIso = new Date().toISOString();
        const nowMs = Date.now();
        const roomId = `room-${code.toLowerCase()}-${nowMs.toString(36)}`;
        const platform = 'netflix';
        const videoId = body.videoId || SUPPORTED_NETFLIX_TITLES[0].watchId;
        const videoTitle = body.videoTitle || 'Arcane — S1:E1 Welcome to the Playground';

        const hostParticipant: RoomParticipant = {
          userId: body.hostId,
          displayName: body.hostName || 'Host',
          username: body.hostUsername || 'host',
          avatarUrl: body.hostAvatar || AVATAR_PRESETS[0],
          role: 'host',
          status: 'joined',
          isGuest: Boolean(body.isGuest),
          isChatMuted: false,
          isVoiceMuted: true,
          isCameraOn: false,
          isSpeaking: false,
          reportedTime: 0,
          syncDrift: 0,
          extensionConnected: true,
          joinedAt: nowIso,
          lastActiveAt: nowMs,
        };

        const newRoom: WatchRoom & { password?: string } = {
          id: roomId,
          code,
          title: String(body.title || 'Watch Party').trim(),
          description: String(body.description || '').trim(),
          hostId: body.hostId,
          hostName: hostParticipant.displayName,
          hostAvatar: hostParticipant.avatarUrl,
          platform,
          privacy: body.privacy === 'private' ? 'private' : 'public',
          hasPassword: Boolean(body.password),
          password: body.password || undefined,
          allowGuests: body.allowGuests !== false,
          waitingRoomEnabled: Boolean(body.waitingRoomEnabled),
          isLocked: false,
          isActive: true,
          participantLimit: Number(body.participantLimit) || 25,
          controlPermission: body.controlPermission || 'everyone',
          playback: {
            roomId,
            platform,
            videoId,
            videoTitle,
            videoThumbnail: body.videoThumbnail,
            netflixWatchId: platform === 'netflix' ? videoId : undefined,
            isPlaying: false,
            currentTime: 0,
            playbackRate: 1,
            seq: 1,
            updatedBy: body.hostId,
            updatedByName: hostParticipant.displayName,
            updatedAt: nowMs,
          },
          participants: [hostParticipant],
          queue: [],
          createdAt: nowIso,
        };

        db.rooms[code] = newRoom;
        db.messagesByRoom[code] = [
          {
            id: `msg-init-${nowMs}`,
            roomId,
            userId: 'system',
            senderName: 'VYBE',
            senderAvatar: hostParticipant.avatarUrl,
            senderRole: 'host',
            type: 'system',
            content: `${hostParticipant.displayName} created room ${code}.`,
            reactions: {},
            createdAt: nowIso,
          },
        ];
        const { password, ...safe } = newRoom;
        return jsonResponse({ room: safe });
      }

      if (req.method === 'PATCH') {
        const body = (await req.json()) as Record<string, any>;
        const code = String(body.roomCode || '').trim().toUpperCase();
        if (!db.rooms[code]) {
          if (body.clientRoom && body.clientRoom.code) {
            db.rooms[code] = { ...body.clientRoom, code };
          } else {
            const nowIso = new Date().toISOString();
            const nowMs = Date.now();
            const isNfx = code.startsWith('NFX');
            db.rooms[code] = {
              id: `room-${code.toLowerCase()}`,
              code,
              title: `Watch Party ${code}`,
              description: 'Synchronized watch party room',
              hostId: body.user?.id || 'usr-elena-host',
              hostName: body.user?.displayName || 'Cinema Host',
              hostAvatar: body.user?.avatarUrl || AVATAR_PRESETS[0],
              platform: 'netflix',
              privacy: 'public',
              hasPassword: false,
              allowGuests: true,
              waitingRoomEnabled: false,
              isLocked: false,
              isActive: true,
              participantLimit: 25,
              controlPermission: 'everyone',
              playback: {
                roomId: `room-${code.toLowerCase()}`,
                platform: 'netflix',
                videoId: '',
                videoTitle: 'Netflix Watch Party',
                videoThumbnail: '',
                netflixWatchId: undefined,
                isPlaying: false,
                currentTime: 0,
                playbackRate: 1,
                seq: 1,
                updatedBy: body.user?.id || 'usr-elena-host',
                updatedByName: body.user?.displayName || 'Cinema Host',
                updatedAt: nowMs,
              },
              participants: [],
              queue: [],
              createdAt: nowIso,
            };
          }
        }
        const room = db.rooms[code];

        if (body.action === 'JOIN_ROOM') {
          const user = body.user;
          const existingIdx = room.participants.findIndex((p) => p.userId === user.id);
          const nowIso = new Date().toISOString();
          const nowMs = Date.now();
          if (existingIdx >= 0) {
            room.participants[existingIdx].status = 'joined';
            room.participants[existingIdx].lastActiveAt = nowMs;
          } else {
            room.participants.push({
              userId: user.id,
              displayName: user.displayName,
              username: user.username || 'viewer',
              avatarUrl: user.avatarUrl || AVATAR_PRESETS[0],
              role: room.hostId === user.id ? 'host' : 'member',
              status: 'joined',
              isGuest: Boolean(user.isGuest),
              isChatMuted: false,
              isVoiceMuted: true,
              isCameraOn: false,
              isSpeaking: false,
              reportedTime: room.playback.currentTime,
              syncDrift: 0,
              extensionConnected: true,
              joinedAt: nowIso,
              lastActiveAt: nowMs,
            });
          }
          const { password, ...safe } = room;
          publishEvent(`room:${code}`, { type: 'ROOM_UPDATED', roomCode: code, room: safe });
          return jsonResponse({
            room: safe,
            memberStatus: 'joined',
            messages: db.messagesByRoom[code] || [],
          });
        }

        if (body.action === 'QUEUE_ACTION') {
          const { queueOp } = body;
          if (queueOp === 'ADD') {
            room.queue.push({ ...(body.item as QueueItem), position: room.queue.length });
          } else if (queueOp === 'VOTE') {
            const item = room.queue.find((q) => q.id === body.itemId);
            if (item) {
              item.upvoterIds = item.upvoterIds.filter((id) => id !== body.userId);
              item.downvoterIds = item.downvoterIds.filter((id) => id !== body.userId);
              if (body.direction === 'up') item.upvoterIds.push(body.userId);
              else item.downvoterIds.push(body.userId);
              item.score = item.upvoterIds.length - item.downvoterIds.length;
              room.queue.sort((a, b) => b.score - a.score);
            }
          } else if (queueOp === 'REMOVE') {
            room.queue = room.queue.filter((q) => q.id !== body.itemId);
          } else if (queueOp === 'PLAY_ITEM' || queueOp === 'PLAY_NEXT') {
            const target =
              queueOp === 'PLAY_ITEM'
                ? room.queue.find((q) => q.id === body.itemId)
                : room.queue[0];
            if (target) {
              room.platform = target.platform;
              room.playback = {
                roomId: room.id,
                platform: target.platform,
                videoId: target.videoId,
                videoTitle: target.title,
                videoThumbnail: target.thumbnailUrl,
                netflixWatchId: target.platform === 'netflix' ? target.videoId : undefined,
                isPlaying: true,
                currentTime: 0,
                playbackRate: 1,
                seq: room.playback.seq + 1,
                updatedBy: body.userId || room.hostId,
                updatedByName: body.userName || room.hostName,
                updatedAt: Date.now(),
              };
              room.queue = room.queue.filter((q) => q.id !== target.id);
            }
          }
          const { password, ...safe } = room;
          publishEvent(`room:${code}`, { type: 'ROOM_UPDATED', roomCode: code, room: safe });
          return jsonResponse({ room: safe });
        }

        if (body.action === 'CHANGE_MEDIA') {
          room.platform = body.platform;
          room.playback = {
            roomId: room.id,
            platform: body.platform,
            videoId: body.videoId,
            videoTitle: body.videoTitle,
            videoThumbnail: body.videoThumbnail,
            netflixWatchId: body.platform === 'netflix' ? body.videoId : undefined,
            isPlaying: true,
            currentTime: 0,
            playbackRate: 1,
            seq: room.playback.seq + 1,
            updatedBy: body.userId || room.hostId,
            updatedByName: body.userName || room.hostName,
            updatedAt: Date.now(),
          };
          const { password, ...safe } = room;
          publishEvent(`room:${code}`, { type: 'ROOM_UPDATED', roomCode: code, room: safe });
          return jsonResponse({ room: safe });
        }

        if (body.action === 'UPDATE_SETTINGS') {
          Object.assign(room, body.settings || {});
          const { password, ...safe } = room;
          publishEvent(`room:${code}`, { type: 'ROOM_UPDATED', roomCode: code, room: safe });
          return jsonResponse({ room: safe });
        }

        if (body.action === 'MANAGE_PARTICIPANT') {
          const target = room.participants.find((p) => p.userId === body.targetUserId);
          if (target) {
            if (body.operation === 'APPROVE_WAITING') target.status = 'joined';
            if (body.operation === 'KICK') target.status = 'kicked';
            if (body.operation === 'TOGGLE_CHAT_MUTE') target.isChatMuted = !target.isChatMuted;
            if (body.operation === 'TOGGLE_COHOST') {
              target.role = target.role === 'cohost' ? 'member' : 'cohost';
            }
            if (body.operation === 'TRANSFER_HOST') {
              room.hostId = target.userId;
              room.hostName = target.displayName;
              target.role = 'host';
            }
          }
          const { password, ...safe } = room;
          publishEvent(`room:${code}`, { type: 'ROOM_UPDATED', roomCode: code, room: safe });
          return jsonResponse({ room: safe });
        }

        if (body.action === 'END_ROOM') {
          room.isActive = false;
          publishEvent(`room:${code}`, {
            type: 'ROOM_ENDED',
            roomCode: code,
            endedBy: body.userId || room.hostId,
          });
          return jsonResponse({ ended: true });
        }

        const { password, ...safe } = room;
        return jsonResponse({ room: safe });
      }
    }

    // 3. /api/realtime/publish
    if (url.pathname === '/api/realtime/publish' && req.method === 'POST') {
      const body = (await req.json()) as { channel?: string; event: RealtimeRoomEvent };
      const channel = body.channel || `room:${String(body.event?.roomCode || '').toUpperCase()}`;
      publishEvent(channel, body.event);
      return jsonResponse({ ok: true, ts: Date.now() });
    }

    // 4. /api/realtime/stream (SSE)
    if (url.pathname === '/api/realtime/stream' && req.method === 'GET') {
      const channel = url.searchParams.get('channel') || 'global';
      const encoder = new TextEncoder();
      let unsubscribe: (() => void) | null = null;

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'CONNECTED', channel, ts: Date.now() })}\n\n`
            )
          );
          const listener: SseListener = (payload) => {
            if (payload.channel === channel || channel === 'global') {
              try {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload.event)}\n\n`));
              } catch {
                // Closed
              }
            }
          };
          listeners.add(listener);
          unsubscribe = () => listeners.delete(listener);
        },
        cancel() {
          if (unsubscribe) unsubscribe();
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          ...corsHeaders,
        },
      });
    }

    // 6. Serve Static Assets & Dynamic /room/[code] Route Fallback
    if (url.pathname === '/room' || url.pathname === '/room/') {
      const fallbackUrl = new URL('/room/NFX-808', url.origin);
      const res = await env.ASSETS.fetch(new Request(fallbackUrl.toString()));
      if (res.ok || res.status === 200) {
        const h = new Headers(res.headers);
        h.delete('x-frame-options');
        h.set('Content-Type', 'text/html; charset=utf-8');
        h.set('Content-Security-Policy', "frame-ancestors 'self' https://*.netflix.com https://netflix.com https://*.nooryoosuf.com http://localhost:*");
        return new Response(res.body, { status: 200, headers: h });
      }
    }

    if (url.pathname.startsWith('/room/')) {
      const isTxt = url.pathname.endsWith('.txt');
      // Always target the clean URL without trailing .html so Cloudflare Assets never 307 redirects
      const fallbackPath = isTxt ? '/room/NFX-808.txt' : '/room/NFX-808';
      const fallbackUrl = new URL(fallbackPath, url.origin);
      let assetRes = await env.ASSETS.fetch(new Request(fallbackUrl.toString()));
      
      // If Cloudflare returns a redirect (301, 302, 307, 308), resolve destination
      if (assetRes.status >= 300 && assetRes.status < 400) {
        const loc = assetRes.headers.get('Location');
        if (loc) {
          const redirectUrl = new URL(loc, url.origin);
          assetRes = await env.ASSETS.fetch(new Request(redirectUrl.toString()));
        }
      }

      if (assetRes.ok || assetRes.status === 200) {
        const h = new Headers(assetRes.headers);
        h.delete('x-frame-options');
        h.set('Content-Type', isTxt ? 'text/plain; charset=utf-8' : 'text/html; charset=utf-8');
        h.set('Content-Security-Policy', "frame-ancestors 'self' https://*.netflix.com https://netflix.com https://*.nooryoosuf.com http://localhost:*");
        return new Response(assetRes.body, {
          status: 200,
          headers: h,
        });
      }
    }

    return env.ASSETS.fetch(req);
  },
};
