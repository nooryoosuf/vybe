import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  ChatMessage,
  RealtimeRoomEvent,
  RoomInvitation,
  SavedWatchlist,
  SiteMovieItem,
  UserProfile,
  WatchRoom,
} from '@/types/vybe';

export interface VybeDatabaseSchema {
  users: Record<string, UserProfile & { passwordHash?: string }>;
  rooms: Record<string, WatchRoom & { password?: string }>;
  messagesByRoom: Record<string, ChatMessage[]>;
  watchlistsByUser: Record<string, SavedWatchlist[]>;
  invitations: RoomInvitation[];
  siteMovies: SiteMovieItem[];
}

type SseListener = (payload: { channel: string; event: RealtimeRoomEvent }) => void;

const DB_FILE_PATH = path.join(os.tmpdir(), 'vybe-social-cinema-arcane-v3.json');

function createCleanDatabase(): VybeDatabaseSchema {
  return {
    users: {},
    rooms: {},
    messagesByRoom: {},
    watchlistsByUser: {},
    invitations: [],
    siteMovies: [],
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
          if (!Array.isArray(parsed.siteMovies)) {
            parsed.siteMovies = [];
          }
          // Drop any pre-seeded movies (they have no user attribution).
          parsed.siteMovies = parsed.siteMovies.filter((m) => m.addedBy);
          return parsed;
        }
      }
    } catch {
      // Fallback to clean DB
    }
    const clean = createCleanDatabase();
    this.saveToDisk(clean);
    return clean;
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
