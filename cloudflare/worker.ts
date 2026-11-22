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
import {
  AVATAR_PRESETS,
  CURATED_YOUTUBE_VIDEOS,
  INITIAL_SITE_MOVIES,
  SUPPORTED_NETFLIX_TITLES,
} from '../src/lib/constants';
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
    siteMovies: [...INITIAL_SITE_MOVIES],
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
          siteMovies: db.siteMovies?.length ? db.siteMovies : INITIAL_SITE_MOVIES,
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
        const platform = body.platform === 'netflix' ? 'netflix' : 'youtube';
        const videoId = body.videoId || (platform === 'netflix' ? '80057281' : 'aqz-KE-bpKQ');
        const videoTitle = body.videoTitle || 'Synchronized Screening';

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
              platform: isNfx ? 'netflix' : 'youtube',
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
                platform: isNfx ? 'netflix' : 'youtube',
                videoId: isNfx ? '80057281' : 'aqz-KE-bpKQ',
                videoTitle: isNfx
                  ? SUPPORTED_NETFLIX_TITLES[0].title
                  : CURATED_YOUTUBE_VIDEOS[0].title,
                videoThumbnail: isNfx
                  ? SUPPORTED_NETFLIX_TITLES[0].posterUrl
                  : CURATED_YOUTUBE_VIDEOS[0].thumbnailUrl,
                netflixWatchId: isNfx ? '80057281' : undefined,
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

    // 5. /api/livekit/token
    if (url.pathname === '/api/livekit/token' && req.method === 'POST') {
      const body = (await req.json()) as { roomCode?: string };
      return jsonResponse({
        mode: 'webrtc-mesh',
        roomCode: body.roomCode || 'VYB-4K1',
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
    }

    // 6. Serve Static Assets & Dynamic /room/[code] Route Fallback
    if (url.pathname === '/room' || url.pathname === '/room/') {
      const roomHtml = new URL('/room.html', url.origin);
      const res = await env.ASSETS.fetch(new Request(roomHtml.toString(), req));
      if (res.ok) return new Response(res.body, { status: 200, headers: res.headers });
    }

    if (url.pathname.startsWith('/room/')) {
      const isTxt = url.pathname.endsWith('.txt');
      const fallbackPath = isTxt ? '/room/VYB-4K1.txt' : '/room/VYB-4K1.html';
      const fallbackUrl = new URL(fallbackPath, url.origin);
      const assetRes = await env.ASSETS.fetch(new Request(fallbackUrl.toString(), req));
      if (assetRes.ok) {
        return new Response(assetRes.body, {
          status: 200,
          headers: assetRes.headers,
        });
      }
    }

    return env.ASSETS.fetch(req);
  },
};
