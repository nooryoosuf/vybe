import {
  ChatMessage,
  QueueItem,
  RealtimeRoomEvent,
  RoomInvitation,
  RoomParticipant,
  SavedWatchlist,
  UserProfile,
  WatchRoom,
} from '../src/types/vybe';
import {
  AVATAR_PRESETS,
  CURATED_YOUTUBE_VIDEOS,
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
}

type SseListener = (payload: { channel: string; event: RealtimeRoomEvent }) => void;

const listeners = new Set<SseListener>();

function createInitialDb(): EdgeDb {
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  const hostElena: UserProfile = {
    id: 'usr-elena-host',
    email: 'elena@vybe.cinema',
    displayName: 'Elena Vance',
    username: 'elena_v',
    avatarUrl: AVATAR_PRESETS[0],
    bio: 'Sci-Fi & A24 curator. Hosting nightly 4K screenings.',
    presenceStatus: 'watching',
    currentRoomCode: 'VYB-4K1',
    accentColor: '#6D5DFB',
    isGuest: false,
    preferences: {
      reducedMotion: false,
      reactionSounds: false,
      autoSyncThresholdSec: 2.0,
      floatingChatDefault: false,
      showPresenceToFriends: true,
      defaultRoomPrivacy: 'public',
    },
    createdAt: nowIso,
  };

  const friendMarcus: UserProfile = {
    id: 'usr-marcus-co',
    email: 'marcus@vybe.cinema',
    displayName: 'Marcus Chen',
    username: 'marcus_c',
    avatarUrl: AVATAR_PRESETS[1],
    bio: 'Sound designer & animation nerd.',
    presenceStatus: 'watching',
    currentRoomCode: 'VYB-4K1',
    accentColor: '#4F46E5',
    isGuest: false,
    preferences: {
      reducedMotion: false,
      reactionSounds: false,
      autoSyncThresholdSec: 2.0,
      floatingChatDefault: false,
      showPresenceToFriends: true,
      defaultRoomPrivacy: 'public',
    },
    createdAt: nowIso,
  };

  const friendAria: UserProfile = {
    id: 'usr-aria-net',
    email: 'aria@vybe.cinema',
    displayName: 'Aria Thorne',
    username: 'aria_t',
    avatarUrl: AVATAR_PRESETS[2],
    bio: 'Late night thriller marathons on Netflix.',
    presenceStatus: 'watching',
    currentRoomCode: 'NFX-808',
    accentColor: '#9333EA',
    isGuest: false,
    preferences: {
      reducedMotion: false,
      reactionSounds: false,
      autoSyncThresholdSec: 2.0,
      floatingChatDefault: false,
      showPresenceToFriends: true,
      defaultRoomPrivacy: 'public',
    },
    createdAt: nowIso,
  };

  const mainYoutubeRoom: WatchRoom = {
    id: 'room-vyb-4k1',
    code: 'VYB-4K1',
    title: 'Midnight Blender 4K Cinema Showcase',
    description: 'Synchronized 60fps open movie premiere night — grab popcorn & drop reactions!',
    hostId: hostElena.id,
    hostName: hostElena.displayName,
    hostAvatar: hostElena.avatarUrl,
    platform: 'youtube',
    privacy: 'public',
    hasPassword: false,
    allowGuests: true,
    waitingRoomEnabled: false,
    isLocked: false,
    isActive: true,
    participantLimit: 25,
    controlPermission: 'everyone',
    playback: {
      roomId: 'room-vyb-4k1',
      platform: 'youtube',
      videoId: CURATED_YOUTUBE_VIDEOS[0].videoId,
      videoTitle: CURATED_YOUTUBE_VIDEOS[0].title,
      videoThumbnail: CURATED_YOUTUBE_VIDEOS[0].thumbnailUrl,
      isPlaying: false,
      currentTime: 18,
      playbackRate: 1,
      seq: 1,
      updatedBy: hostElena.id,
      updatedByName: hostElena.displayName,
      updatedAt: nowMs,
    },
    participants: [
      {
        userId: hostElena.id,
        displayName: hostElena.displayName,
        username: hostElena.username,
        avatarUrl: hostElena.avatarUrl,
        role: 'host',
        status: 'joined',
        isGuest: false,
        isChatMuted: false,
        isVoiceMuted: true,
        isCameraOn: false,
        isSpeaking: false,
        reportedTime: 18,
        syncDrift: 0,
        extensionConnected: true,
        joinedAt: nowIso,
        lastActiveAt: nowMs,
      },
      {
        userId: friendMarcus.id,
        displayName: friendMarcus.displayName,
        username: friendMarcus.username,
        avatarUrl: friendMarcus.avatarUrl,
        role: 'cohost',
        status: 'joined',
        isGuest: false,
        isChatMuted: false,
        isVoiceMuted: true,
        isCameraOn: false,
        isSpeaking: false,
        reportedTime: 18.1,
        syncDrift: 0.1,
        extensionConnected: true,
        joinedAt: nowIso,
        lastActiveAt: nowMs,
      },
    ],
    queue: [
      {
        id: 'q-sintel',
        roomId: 'room-vyb-4k1',
        platform: 'youtube',
        videoId: CURATED_YOUTUBE_VIDEOS[1].videoId,
        title: CURATED_YOUTUBE_VIDEOS[1].title,
        thumbnailUrl: CURATED_YOUTUBE_VIDEOS[1].thumbnailUrl,
        durationLabel: CURATED_YOUTUBE_VIDEOS[1].durationLabel,
        addedById: hostElena.id,
        addedByName: hostElena.displayName,
        position: 0,
        score: 4,
        upvoterIds: [hostElena.id, friendMarcus.id, friendAria.id],
        downvoterIds: [],
        createdAt: nowIso,
      },
      {
        id: 'q-tears',
        roomId: 'room-vyb-4k1',
        platform: 'youtube',
        videoId: CURATED_YOUTUBE_VIDEOS[2].videoId,
        title: CURATED_YOUTUBE_VIDEOS[2].title,
        thumbnailUrl: CURATED_YOUTUBE_VIDEOS[2].thumbnailUrl,
        durationLabel: CURATED_YOUTUBE_VIDEOS[2].durationLabel,
        addedById: friendMarcus.id,
        addedByName: friendMarcus.displayName,
        position: 1,
        score: 2,
        upvoterIds: [friendMarcus.id, hostElena.id],
        downvoterIds: [],
        createdAt: nowIso,
      },
    ],
    createdAt: nowIso,
  };

  const netflixRoom: WatchRoom = {
    id: 'room-nfx-808',
    code: 'NFX-808',
    title: 'Stranger Things & Sci-Fi Mystery Night',
    description: 'Connect your VYBE Chrome Extension and sign into Netflix to sync playback.',
    hostId: friendAria.id,
    hostName: friendAria.displayName,
    hostAvatar: friendAria.avatarUrl,
    platform: 'netflix',
    privacy: 'public',
    hasPassword: false,
    allowGuests: true,
    waitingRoomEnabled: false,
    isLocked: false,
    isActive: true,
    participantLimit: 15,
    controlPermission: 'everyone',
    playback: {
      roomId: 'room-nfx-808',
      platform: 'netflix',
      videoId: SUPPORTED_NETFLIX_TITLES[0].watchId,
      videoTitle: SUPPORTED_NETFLIX_TITLES[0].title,
      videoThumbnail: SUPPORTED_NETFLIX_TITLES[0].posterUrl,
      netflixWatchId: SUPPORTED_NETFLIX_TITLES[0].watchId,
      isPlaying: false,
      currentTime: 142,
      playbackRate: 1,
      seq: 1,
      updatedBy: friendAria.id,
      updatedByName: friendAria.displayName,
      updatedAt: nowMs,
    },
    participants: [
      {
        userId: friendAria.id,
        displayName: friendAria.displayName,
        username: friendAria.username,
        avatarUrl: friendAria.avatarUrl,
        role: 'host',
        status: 'joined',
        isGuest: false,
        isChatMuted: false,
        isVoiceMuted: false,
        isCameraOn: false,
        isSpeaking: false,
        reportedTime: 142,
        syncDrift: 0,
        extensionConnected: true,
        netflixReady: true,
        joinedAt: nowIso,
        lastActiveAt: nowMs,
      },
    ],
    queue: [
      {
        id: 'q-nfx-dark',
        roomId: 'room-nfx-808',
        platform: 'netflix',
        videoId: SUPPORTED_NETFLIX_TITLES[1].watchId,
        title: SUPPORTED_NETFLIX_TITLES[1].title,
        thumbnailUrl: SUPPORTED_NETFLIX_TITLES[1].posterUrl,
        durationLabel: SUPPORTED_NETFLIX_TITLES[1].durationLabel,
        netflixSynopsis: SUPPORTED_NETFLIX_TITLES[1].synopsis,
        addedById: friendAria.id,
        addedByName: friendAria.displayName,
        position: 0,
        score: 3,
        upvoterIds: [friendAria.id, hostElena.id],
        downvoterIds: [],
        createdAt: nowIso,
      },
    ],
    createdAt: nowIso,
  };

  return {
    users: {
      [hostElena.id]: hostElena,
      [friendMarcus.id]: friendMarcus,
      [friendAria.id]: friendAria,
    },
    rooms: {
      [mainYoutubeRoom.code]: mainYoutubeRoom,
      [netflixRoom.code]: netflixRoom,
    },
    messagesByRoom: {
      [mainYoutubeRoom.code]: [
        {
          id: 'msg-seed-1',
          roomId: mainYoutubeRoom.id,
          userId: hostElena.id,
          senderName: hostElena.displayName,
          senderAvatar: hostElena.avatarUrl,
          senderRole: 'host',
          type: 'text',
          content: 'Welcome everyone! We have Big Buck Bunny 4K loaded first, and Sintel + Tears of Steel queued next.',
          reactions: { '🔥': [friendMarcus.id], '❤️': [hostElena.id] },
          createdAt: nowIso,
        },
      ],
      [netflixRoom.code]: [
        {
          id: 'msg-nfx-1',
          roomId: netflixRoom.id,
          userId: friendAria.id,
          senderName: friendAria.displayName,
          senderAvatar: friendAria.avatarUrl,
          senderRole: 'host',
          type: 'text',
          content: 'Make sure the VYBE Chrome Extension is connected before we start Episode 1!',
          reactions: { '🔥': [friendAria.id] },
          createdAt: nowIso,
        },
      ],
    },
    watchlistsByUser: {
      default: [
        {
          id: 'wl-default-1',
          ownerId: 'global-seed',
          title: 'Weekend Sci-Fi & Animation Anthology',
          description: 'Our group favorites ready to launch into a watch party at any time.',
          items: [
            {
              id: 'wli-1',
              platform: 'youtube',
              videoId: CURATED_YOUTUBE_VIDEOS[2].videoId,
              title: CURATED_YOUTUBE_VIDEOS[2].title,
              thumbnailUrl: CURATED_YOUTUBE_VIDEOS[2].thumbnailUrl,
              durationLabel: CURATED_YOUTUBE_VIDEOS[2].durationLabel,
              addedAt: nowIso,
            },
            {
              id: 'wli-2',
              platform: 'netflix',
              videoId: SUPPORTED_NETFLIX_TITLES[0].watchId,
              title: SUPPORTED_NETFLIX_TITLES[0].title,
              thumbnailUrl: SUPPORTED_NETFLIX_TITLES[0].posterUrl,
              durationLabel: SUPPORTED_NETFLIX_TITLES[0].durationLabel,
              addedAt: nowIso,
            },
          ],
          createdAt: nowIso,
        },
      ],
    },
    invitations: [
      {
        id: 'inv-seed-1',
        roomId: mainYoutubeRoom.id,
        roomCode: mainYoutubeRoom.code,
        roomTitle: mainYoutubeRoom.title,
        platform: 'youtube',
        senderId: hostElena.id,
        senderName: hostElena.displayName,
        senderAvatar: hostElena.avatarUrl,
        status: 'pending',
        createdAt: nowIso,
      },
    ],
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
        const watchlists = db.watchlistsByUser[userId] || db.watchlistsByUser['default'] || [];
        const invitations = db.invitations;
        return jsonResponse({ rooms, users, watchlists, invitations });
      }
      if (req.method === 'POST') {
        const body = (await req.json()) as Record<string, any>;
        if (body.action === 'UPSERT_USER' && body.user?.id) {
          db.users[body.user.id] = { ...(db.users[body.user.id] || {}), ...body.user };
          return jsonResponse({ user: db.users[body.user.id] });
        }
        if (body.action === 'LOGIN_EMAIL') {
          const email = String(body.email || '').trim().toLowerCase();
          const found = Object.values(db.users).find((u) => u.email?.toLowerCase() === email);
          return jsonResponse({ user: found || null });
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
        const room = db.rooms[code];
        if (!room) return jsonResponse({ error: 'Room not found' }, 404);

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
    if (url.pathname.startsWith('/room/')) {
      const fallbackUrl = new URL('/room/VYB-4K1.html', url.origin);
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
