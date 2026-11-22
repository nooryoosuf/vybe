import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  ChatMessage,
  RealtimeRoomEvent,
  RoomInvitation,
  SavedWatchlist,
  UserProfile,
  WatchRoom,
} from '@/types/vybe';
import { AVATAR_PRESETS, CURATED_YOUTUBE_VIDEOS, SUPPORTED_NETFLIX_TITLES } from '@/lib/constants';

export interface VybeDatabaseSchema {
  users: Record<string, UserProfile & { passwordHash?: string }>;
  rooms: Record<string, WatchRoom & { password?: string }>;
  messagesByRoom: Record<string, ChatMessage[]>;
  watchlistsByUser: Record<string, SavedWatchlist[]>;
  invitations: RoomInvitation[];
}

type SseListener = (payload: { channel: string; event: RealtimeRoomEvent }) => void;

const DB_FILE_PATH = path.join(os.tmpdir(), 'vybe-social-cinema-db.json');

function createSeedDatabase(): VybeDatabaseSchema {
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
      {
        id: 'q-agent327',
        roomId: 'room-vyb-4k1',
        platform: 'youtube',
        videoId: CURATED_YOUTUBE_VIDEOS[3].videoId,
        title: CURATED_YOUTUBE_VIDEOS[3].title,
        thumbnailUrl: CURATED_YOUTUBE_VIDEOS[3].thumbnailUrl,
        durationLabel: CURATED_YOUTUBE_VIDEOS[3].durationLabel,
        addedById: hostElena.id,
        addedByName: hostElena.displayName,
        position: 2,
        score: 1,
        upvoterIds: [hostElena.id],
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
    controlPermission: 'host_only',
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

  const initialMessages: ChatMessage[] = [
    {
      id: 'msg-seed-1',
      roomId: mainYoutubeRoom.id,
      userId: 'system',
      senderName: 'VYBE Cinema Engine',
      senderAvatar: AVATAR_PRESETS[0],
      senderRole: 'host',
      type: 'system',
      content: 'Room VYB-4K1 initialized with low-latency drift compensation.',
      reactions: {},
      createdAt: new Date(nowMs - 180000).toISOString(),
    },
    {
      id: 'msg-seed-2',
      roomId: mainYoutubeRoom.id,
      userId: hostElena.id,
      senderName: hostElena.displayName,
      senderAvatar: hostElena.avatarUrl,
      senderRole: 'host',
      type: 'text',
      content: 'Welcome everyone! We have Big Buck Bunny 4K loaded first, and Sintel + Tears of Steel queued next.',
      reactions: { '🔥': [friendMarcus.id], '❤️': [hostElena.id] },
      createdAt: new Date(nowMs - 120000).toISOString(),
    },
    {
      id: 'msg-seed-3',
      roomId: mainYoutubeRoom.id,
      userId: friendMarcus.id,
      senderName: friendMarcus.displayName,
      senderAvatar: friendMarcus.avatarUrl,
      senderRole: 'cohost',
      type: 'text',
      content: 'Audio and frame sync are locked in. Try hitting keys 1-9 to launch floating reactions over the canvas!',
      reactions: { '👏': [hostElena.id] },
      createdAt: new Date(nowMs - 60000).toISOString(),
    },
  ];

  const defaultWatchlist: SavedWatchlist = {
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
        platform: 'youtube',
        videoId: CURATED_YOUTUBE_VIDEOS[4].videoId,
        title: CURATED_YOUTUBE_VIDEOS[4].title,
        thumbnailUrl: CURATED_YOUTUBE_VIDEOS[4].thumbnailUrl,
        durationLabel: CURATED_YOUTUBE_VIDEOS[4].durationLabel,
        addedAt: nowIso,
      },
      {
        id: 'wli-3',
        platform: 'netflix',
        videoId: SUPPORTED_NETFLIX_TITLES[0].watchId,
        title: SUPPORTED_NETFLIX_TITLES[0].title,
        thumbnailUrl: SUPPORTED_NETFLIX_TITLES[0].posterUrl,
        durationLabel: SUPPORTED_NETFLIX_TITLES[0].durationLabel,
        addedAt: nowIso,
      },
    ],
    createdAt: nowIso,
  };

  const seedInvitation: RoomInvitation = {
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
      [mainYoutubeRoom.code]: initialMessages,
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
      default: [defaultWatchlist],
    },
    invitations: [seedInvitation],
  };
}

class VybeServerStore {
  private db: VybeDatabaseSchema;
  private listeners: Set<SseListener> = new Set();

  constructor() {
    this.db = this.loadFromDisk();
  }

  private loadFromDisk(): VybeDatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE_PATH)) {
        const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(raw) as VybeDatabaseSchema;
        if (parsed && parsed.rooms && parsed.users) {
          return parsed;
        }
      }
    } catch {
      // Fallback to seed DB
    }
    const seeded = createSeedDatabase();
    this.saveToDisk(seeded);
    return seeded;
  }

  private saveToDisk(data: VybeDatabaseSchema = this.db) {
    try {
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Ignore write error in read-only environments
    }
  }

  public getDb(): VybeDatabaseSchema {
    return this.db;
  }

  public mutate(mutator: (db: VybeDatabaseSchema) => void) {
    mutator(this.db);
    this.saveToDisk();
  }

  public subscribe(listener: SseListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public publishEvent(channel: string, event: RealtimeRoomEvent) {
    // Also apply state mutations for authoritative server store consistency
    const roomCode = event.roomCode?.toUpperCase();
    const room = roomCode ? this.db.rooms[roomCode] : undefined;

    if (room) {
      if (event.type === 'PLAYBACK_SYNC') {
        if (event.playback.seq >= room.playback.seq) {
          room.playback = { ...event.playback };
          this.saveToDisk();
        }
      } else if (event.type === 'CHAT_MESSAGE') {
        const list = this.db.messagesByRoom[roomCode] || [];
        if (!list.some((m) => m.id === event.message.id)) {
          list.push(event.message);
          this.db.messagesByRoom[roomCode] = list.slice(-200);
          this.saveToDisk();
        }
      } else if (event.type === 'CHAT_REACTION') {
        const list = this.db.messagesByRoom[roomCode] || [];
        const msg = list.find((m) => m.id === event.messageId);
        if (msg) {
          const existing = msg.reactions[event.emoji] || [];
          if (existing.includes(event.userId)) {
            msg.reactions[event.emoji] = existing.filter((id) => id !== event.userId);
            if (msg.reactions[event.emoji].length === 0) {
              delete msg.reactions[event.emoji];
            }
          } else {
            msg.reactions[event.emoji] = [...existing, event.userId];
          }
          this.saveToDisk();
        }
      } else if (event.type === 'ROOM_UPDATED') {
        this.db.rooms[roomCode] = {
          ...this.db.rooms[roomCode],
          ...event.room,
        };
        this.saveToDisk();
      } else if (event.type === 'PARTICIPANT_HEARTBEAT') {
        const idx = room.participants.findIndex((p) => p.userId === event.participant.userId);
        if (idx >= 0) {
          room.participants[idx] = {
            ...room.participants[idx],
            ...event.participant,
            lastActiveAt: Date.now(),
          };
          this.saveToDisk();
        }
      } else if (event.type === 'ROOM_ENDED') {
        room.isActive = false;
        this.saveToDisk();
      }
    }

    for (const listener of this.listeners) {
      try {
        listener({ channel, event });
      } catch {
        // Ignore broken listener
      }
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __vybeServerStore: VybeServerStore | undefined;
}

export function getVybeServerStore(): VybeServerStore {
  if (!globalThis.__vybeServerStore) {
    globalThis.__vybeServerStore = new VybeServerStore();
  }
  return globalThis.__vybeServerStore;
}
