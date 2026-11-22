import { NextRequest, NextResponse } from 'next/server';
import { getVybeServerStore } from '@/lib/server/vybeStore';
import {
  ChatMessage,
  QueueItem,
  RoomParticipant,
  WatchRoom,
} from '@/types/vybe';
import { generateRoomCode } from '@/lib/utils';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  const store = getVybeServerStore();
  const db = store.getDb();
  const code = req.nextUrl.searchParams.get('code')?.trim().toUpperCase();

  if (code) {
    const room = db.rooms[code];
    if (!room) {
      return NextResponse.json(
        { error: 'Room not found. Double-check the room code.' },
        { status: 404, headers: corsHeaders }
      );
    }
    const { password, ...safeRoom } = room;
    const messages = db.messagesByRoom[code] || [];
    return NextResponse.json(
      { room: safeRoom, messages },
      { headers: corsHeaders }
    );
  }

  const rooms = Object.values(db.rooms)
    .filter((r) => r.isActive)
    .map(({ password, ...safeRoom }) => safeRoom);

  return NextResponse.json({ rooms }, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const store = getVybeServerStore();
    const db = store.getDb();

    let code = (body.code ? String(body.code).toUpperCase() : generateRoomCode());
    while (db.rooms[code]) {
      code = generateRoomCode();
    }

    const nowIso = new Date().toISOString();
    const nowMs = Date.now();
    const roomId = `room-${code.toLowerCase()}-${nowMs.toString(36)}`;
    const platform = body.platform === 'netflix' ? 'netflix' : 'youtube';
    const videoId = body.videoId || (platform === 'netflix' ? '80057281' : 'aqz-KE-bpKQ');
    const videoTitle =
      body.videoTitle ||
      (platform === 'netflix'
        ? 'Stranger Things — S1:E1 Chapter One'
        : 'Big Buck Bunny — 4K 60fps Open Film');

    const hostParticipant: RoomParticipant = {
      userId: body.hostId,
      displayName: body.hostName || 'Cinema Host',
      username: body.hostUsername || 'host',
      avatarUrl:
        body.hostAvatar ||
        'https://api.dicebear.com/9.x/glass/svg?seed=Host&backgroundColor=6d5dfb',
      role: 'host',
      status: 'joined',
      isGuest: Boolean(body.isGuest),
      isChatMuted: false,
      isVoiceMuted: true,
      isCameraOn: false,
      isSpeaking: false,
      reportedTime: 0,
      syncDrift: 0,
      extensionConnected: platform === 'youtube',
      joinedAt: nowIso,
      lastActiveAt: nowMs,
    };

    const newRoom: WatchRoom & { password?: string } = {
      id: roomId,
      code,
      title: String(body.title || 'Midnight Watch Party').trim(),
      description: String(body.description || 'Synchronized cinema room').trim(),
      hostId: body.hostId,
      hostName: hostParticipant.displayName,
      hostAvatar: hostParticipant.avatarUrl,
      platform,
      privacy: body.privacy === 'private' ? 'private' : 'public',
      hasPassword: Boolean(body.password && String(body.password).trim().length > 0),
      password: body.password ? String(body.password).trim() : undefined,
      allowGuests: body.allowGuests !== false,
      waitingRoomEnabled: Boolean(body.waitingRoomEnabled),
      isLocked: false,
      isActive: true,
      participantLimit: Number(body.participantLimit) || 25,
      controlPermission: body.controlPermission || 'host_only',
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
      queue: Array.isArray(body.initialQueue) ? body.initialQueue : [],
      createdAt: nowIso,
    };

    const welcomeMsg: ChatMessage = {
      id: `msg-init-${nowMs}`,
      roomId,
      userId: 'system',
      senderName: 'VYBE Cinema Engine',
      senderAvatar: hostParticipant.avatarUrl,
      senderRole: 'host',
      type: 'system',
      content: `${hostParticipant.displayName} created room ${code} (${platform.toUpperCase()}).`,
      reactions: {},
      createdAt: nowIso,
    };

    store.mutate((state) => {
      state.rooms[code] = newRoom;
      state.messagesByRoom[code] = [welcomeMsg];
      if (state.users[body.hostId]) {
        state.users[body.hostId].currentRoomCode = code;
        state.users[body.hostId].presenceStatus = 'watching';
      }
    });

    const { password, ...safeRoom } = newRoom;
    return NextResponse.json({ room: safeRoom }, { headers: corsHeaders });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create room' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const store = getVybeServerStore();
    const db = store.getDb();
    const code = String(body.roomCode || '').trim().toUpperCase();
    const room = db.rooms[code];

    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    const action = body.action as string;

    // 1. JOIN ROOM
    if (action === 'JOIN_ROOM') {
      const user = body.user as {
        id: string;
        displayName: string;
        username: string;
        avatarUrl: string;
        isGuest: boolean;
      };

      if (!room.isActive) {
        return NextResponse.json(
          { error: 'This watch party has ended.' },
          { status: 410, headers: corsHeaders }
        );
      }

      const existing = room.participants.find((p) => p.userId === user.id);

      if (existing && existing.status === 'kicked') {
        return NextResponse.json(
          { error: 'You were removed from this room by the host.' },
          { status: 403, headers: corsHeaders }
        );
      }

      const isHost = room.hostId === user.id;

      if (!isHost && room.isLocked && (!existing || existing.status !== 'joined')) {
        return NextResponse.json(
          { error: 'This room is currently locked by the host.' },
          { status: 403, headers: corsHeaders }
        );
      }

      if (!isHost && !room.allowGuests && user.isGuest) {
        return NextResponse.json(
          { error: 'The host requires participants to sign in with a registered VYBE account.' },
          { status: 403, headers: corsHeaders }
        );
      }

      if (!isHost && room.hasPassword && room.password) {
        const providedPassword = String(body.password || '').trim();
        if (providedPassword !== room.password && (!existing || existing.status !== 'joined')) {
          return NextResponse.json(
            { error: 'PASSWORD_REQUIRED', requiresPassword: true },
            { status: 401, headers: corsHeaders }
          );
        }
      }

      const activeCount = room.participants.filter((p) => p.status === 'joined').length;
      if (!isHost && !existing && activeCount >= room.participantLimit) {
        return NextResponse.json(
          { error: `Room has reached its maximum capacity of ${room.participantLimit} participants.` },
          { status: 403, headers: corsHeaders }
        );
      }

      const targetStatus =
        !isHost && room.waitingRoomEnabled && (!existing || existing.status !== 'joined')
          ? 'waiting'
          : 'joined';

      let joinedNewly = false;
      store.mutate((state) => {
        const r = state.rooms[code];
        const idx = r.participants.findIndex((p) => p.userId === user.id);
        const nowIso = new Date().toISOString();
        const nowMs = Date.now();

        if (idx >= 0) {
          if (r.participants[idx].status !== 'joined' && targetStatus === 'joined') {
            joinedNewly = true;
          }
          r.participants[idx] = {
            ...r.participants[idx],
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            status: r.participants[idx].role === 'host' ? 'joined' : targetStatus,
            lastActiveAt: nowMs,
          };
        } else {
          joinedNewly = targetStatus === 'joined';
          r.participants.push({
            userId: user.id,
            displayName: user.displayName,
            username: user.username || 'viewer',
            avatarUrl: user.avatarUrl,
            role: isHost ? 'host' : user.isGuest ? 'guest' : 'member',
            status: targetStatus,
            isGuest: user.isGuest,
            isChatMuted: false,
            isVoiceMuted: true,
            isCameraOn: false,
            isSpeaking: false,
            reportedTime: r.playback.currentTime,
            syncDrift: 0,
            extensionConnected: r.platform === 'youtube',
            joinedAt: nowIso,
            lastActiveAt: nowMs,
          });
        }

        if (state.users[user.id]) {
          state.users[user.id].currentRoomCode = code;
          state.users[user.id].presenceStatus = 'watching';
        }

        if (joinedNewly) {
          const sysMsg: ChatMessage = {
            id: `msg-join-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
            roomId: r.id,
            userId: 'system',
            senderName: 'VYBE Cinema',
            senderAvatar: user.avatarUrl,
            senderRole: 'member',
            type: 'system',
            content: `${user.displayName} joined the watch party.`,
            reactions: {},
            createdAt: nowIso,
          };
          state.messagesByRoom[code] = [...(state.messagesByRoom[code] || []), sysMsg];
          store.publishEvent(`room:${code}`, {
            type: 'CHAT_MESSAGE',
            roomCode: code,
            message: sysMsg,
          });
        }
      });

      const { password, ...safeRoom } = store.getDb().rooms[code];
      store.publishEvent(`room:${code}`, {
        type: 'ROOM_UPDATED',
        roomCode: code,
        room: safeRoom,
      });

      return NextResponse.json(
        {
          room: safeRoom,
          memberStatus: targetStatus,
          messages: store.getDb().messagesByRoom[code] || [],
        },
        { headers: corsHeaders }
      );
    }

    // 2. LEAVE ROOM
    if (action === 'LEAVE_ROOM') {
      const { userId, displayName } = body;
      store.mutate((state) => {
        const r = state.rooms[code];
        if (!r) return;
        const p = r.participants.find((part) => part.userId === userId);
        if (p) {
          p.status = 'left';
        }
        if (state.users[userId]) {
          state.users[userId].currentRoomCode = null;
          state.users[userId].presenceStatus = 'online';
        }
        const sysMsg: ChatMessage = {
          id: `msg-leave-${Date.now()}`,
          roomId: r.id,
          userId: 'system',
          senderName: 'VYBE Cinema',
          senderAvatar: '',
          senderRole: 'member',
          type: 'system',
          content: `${displayName || 'A participant'} left the watch party.`,
          reactions: {},
          createdAt: new Date().toISOString(),
        };
        state.messagesByRoom[code] = [...(state.messagesByRoom[code] || []), sysMsg];
        store.publishEvent(`room:${code}`, {
          type: 'CHAT_MESSAGE',
          roomCode: code,
          message: sysMsg,
        });
      });

      const { password, ...safeRoom } = store.getDb().rooms[code];
      store.publishEvent(`room:${code}`, {
        type: 'ROOM_UPDATED',
        roomCode: code,
        room: safeRoom,
      });
      return NextResponse.json({ room: safeRoom }, { headers: corsHeaders });
    }

    // 3. UPDATE ROOM SETTINGS
    if (action === 'UPDATE_SETTINGS') {
      const updates = body.settings || {};
      store.mutate((state) => {
        const r = state.rooms[code];
        if (typeof updates.title === 'string' && updates.title.trim()) {
          r.title = updates.title.trim();
        }
        if (typeof updates.description === 'string') {
          r.description = updates.description.trim();
        }
        if (updates.privacy === 'public' || updates.privacy === 'private') {
          r.privacy = updates.privacy;
        }
        if (typeof updates.allowGuests === 'boolean') {
          r.allowGuests = updates.allowGuests;
        }
        if (typeof updates.waitingRoomEnabled === 'boolean') {
          r.waitingRoomEnabled = updates.waitingRoomEnabled;
        }
        if (typeof updates.isLocked === 'boolean') {
          r.isLocked = updates.isLocked;
        }
        if (typeof updates.participantLimit === 'number') {
          r.participantLimit = Math.max(2, Math.min(100, updates.participantLimit));
        }
        if (['host_only', 'cohosts', 'everyone'].includes(updates.controlPermission)) {
          r.controlPermission = updates.controlPermission;
        }
        if (typeof updates.password === 'string') {
          const clean = updates.password.trim();
          r.password = clean || undefined;
          r.hasPassword = clean.length > 0;
        }
      });

      const { password, ...safeRoom } = store.getDb().rooms[code];
      store.publishEvent(`room:${code}`, {
        type: 'ROOM_UPDATED',
        roomCode: code,
        room: safeRoom,
      });
      return NextResponse.json({ room: safeRoom }, { headers: corsHeaders });
    }

    // 4. MANAGE PARTICIPANT (APPROVE, KICK, MUTE_CHAT, TOGGLE_COHOST, TRANSFER_HOST)
    if (action === 'MANAGE_PARTICIPANT') {
      const { targetUserId, operation } = body as {
        targetUserId: string;
        operation: 'APPROVE_WAITING' | 'KICK' | 'TOGGLE_CHAT_MUTE' | 'TOGGLE_COHOST' | 'TRANSFER_HOST';
      };

      store.mutate((state) => {
        const r = state.rooms[code];
        const target = r.participants.find((p) => p.userId === targetUserId);
        if (!target) return;

        if (operation === 'APPROVE_WAITING') {
          target.status = 'joined';
        } else if (operation === 'KICK') {
          target.status = 'kicked';
        } else if (operation === 'TOGGLE_CHAT_MUTE') {
          target.isChatMuted = !target.isChatMuted;
        } else if (operation === 'TOGGLE_COHOST') {
          target.role = target.role === 'cohost' ? 'member' : 'cohost';
        } else if (operation === 'TRANSFER_HOST') {
          const currentHost = r.participants.find((p) => p.role === 'host');
          if (currentHost) currentHost.role = 'cohost';
          target.role = 'host';
          r.hostId = target.userId;
          r.hostName = target.displayName;
          r.hostAvatar = target.avatarUrl;
        }
      });

      const { password, ...safeRoom } = store.getDb().rooms[code];
      store.publishEvent(`room:${code}`, {
        type: 'ROOM_UPDATED',
        roomCode: code,
        room: safeRoom,
      });
      return NextResponse.json({ room: safeRoom }, { headers: corsHeaders });
    }

    // 5. QUEUE MANAGEMENT (ADD, VOTE, REORDER, REMOVE, PLAY_NOW, PLAY_NEXT)
    if (action === 'QUEUE_ACTION') {
      const { queueOp } = body;

      store.mutate((state) => {
        const r = state.rooms[code];

        if (queueOp === 'ADD') {
          const item = body.item as QueueItem;
          r.queue.push({
            ...item,
            position: r.queue.length,
          });
        } else if (queueOp === 'VOTE') {
          const { itemId, userId, direction } = body as {
            itemId: string;
            userId: string;
            direction: 'up' | 'down';
          };
          const item = r.queue.find((q) => q.id === itemId);
          if (item) {
            item.upvoterIds = item.upvoterIds.filter((id) => id !== userId);
            item.downvoterIds = item.downvoterIds.filter((id) => id !== userId);
            if (direction === 'up') {
              item.upvoterIds.push(userId);
            } else {
              item.downvoterIds.push(userId);
            }
            item.score = item.upvoterIds.length - item.downvoterIds.length;
            r.queue.sort((a, b) => b.score - a.score || a.position - b.position);
          }
        } else if (queueOp === 'MOVE') {
          const { itemId, dir } = body as { itemId: string; dir: -1 | 1 };
          const idx = r.queue.findIndex((q) => q.id === itemId);
          const swapIdx = idx + dir;
          if (idx >= 0 && swapIdx >= 0 && swapIdx < r.queue.length) {
            const temp = r.queue[idx];
            r.queue[idx] = r.queue[swapIdx];
            r.queue[swapIdx] = temp;
            r.queue.forEach((q, i) => {
              q.position = i;
            });
          }
        } else if (queueOp === 'REMOVE') {
          r.queue = r.queue.filter((q) => q.id !== body.itemId);
        } else if (queueOp === 'PLAY_ITEM' || queueOp === 'PLAY_NEXT') {
          const targetItem =
            queueOp === 'PLAY_ITEM'
              ? r.queue.find((q) => q.id === body.itemId)
              : r.queue[0];

          if (targetItem) {
            r.platform = targetItem.platform;
            r.playback = {
              roomId: r.id,
              platform: targetItem.platform,
              videoId: targetItem.videoId,
              videoTitle: targetItem.title,
              videoThumbnail: targetItem.thumbnailUrl,
              netflixWatchId:
                targetItem.platform === 'netflix' ? targetItem.videoId : undefined,
              isPlaying: true,
              currentTime: 0,
              playbackRate: 1,
              seq: r.playback.seq + 1,
              updatedBy: body.userId || r.hostId,
              updatedByName: body.userName || r.hostName,
              updatedAt: Date.now(),
            };
            r.queue = r.queue.filter((q) => q.id !== targetItem.id);
          }
        }
      });

      const { password, ...safeRoom } = store.getDb().rooms[code];
      store.publishEvent(`room:${code}`, {
        type: 'ROOM_UPDATED',
        roomCode: code,
        room: safeRoom,
      });
      if (queueOp === 'PLAY_ITEM' || queueOp === 'PLAY_NEXT') {
        store.publishEvent(`room:${code}`, {
          type: 'PLAYBACK_SYNC',
          roomCode: code,
          playback: safeRoom.playback,
          senderId: body.userId || safeRoom.hostId,
        });
      }
      return NextResponse.json({ room: safeRoom }, { headers: corsHeaders });
    }

    // 6. SWITCH VIDEO / PLATFORM DIRECTLY
    if (action === 'CHANGE_MEDIA') {
      const { platform, videoId, videoTitle, videoThumbnail, userId, userName } = body;
      store.mutate((state) => {
        const r = state.rooms[code];
        r.platform = platform;
        r.playback = {
          roomId: r.id,
          platform,
          videoId,
          videoTitle,
          videoThumbnail,
          netflixWatchId: platform === 'netflix' ? videoId : undefined,
          isPlaying: true,
          currentTime: 0,
          playbackRate: 1,
          seq: r.playback.seq + 1,
          updatedBy: userId || r.hostId,
          updatedByName: userName || r.hostName,
          updatedAt: Date.now(),
        };

        const sysMsg: ChatMessage = {
          id: `msg-media-${Date.now()}`,
          roomId: r.id,
          userId: 'system',
          senderName: 'VYBE Cinema',
          senderAvatar: '',
          senderRole: 'host',
          type: 'system',
          content: `${userName || 'Host'} switched screening to "${videoTitle}" (${platform.toUpperCase()}).`,
          reactions: {},
          createdAt: new Date().toISOString(),
        };
        state.messagesByRoom[code] = [...(state.messagesByRoom[code] || []), sysMsg];
        store.publishEvent(`room:${code}`, {
          type: 'CHAT_MESSAGE',
          roomCode: code,
          message: sysMsg,
        });
      });

      const { password, ...safeRoom } = store.getDb().rooms[code];
      store.publishEvent(`room:${code}`, {
        type: 'ROOM_UPDATED',
        roomCode: code,
        room: safeRoom,
      });
      store.publishEvent(`room:${code}`, {
        type: 'PLAYBACK_SYNC',
        roomCode: code,
        playback: safeRoom.playback,
        senderId: userId || safeRoom.hostId,
      });
      return NextResponse.json({ room: safeRoom }, { headers: corsHeaders });
    }

    // 7. END ROOM
    if (action === 'END_ROOM') {
      store.mutate((state) => {
        const r = state.rooms[code];
        r.isActive = false;
        r.playback.isPlaying = false;
      });
      store.publishEvent(`room:${code}`, {
        type: 'ROOM_ENDED',
        roomCode: code,
        endedBy: body.userId || room.hostId,
      });
      return NextResponse.json({ ended: true }, { headers: corsHeaders });
    }

    return NextResponse.json(
      { error: 'Unknown room action' },
      { status: 400, headers: corsHeaders }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Room operation failed' },
      { status: 500, headers: corsHeaders }
    );
  }
}
