import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { CURATED_YOUTUBE_VIDEOS, INITIAL_SITE_MOVIES, SUPPORTED_NETFLIX_TITLES } from './constants';
import { ChatMessage, ControlPermission, PlatformType, RoomPrivacy, SiteMovieItem, WatchRoom } from '@/types/vybe';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Validates and extracts an 11-character YouTube Video ID from any valid URL or raw ID.
 */
export function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      const vParam = url.searchParams.get('v');
      if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) {
        return vParam;
      }
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && ['embed', 'shorts', 'live', 'v'].includes(parts[0])) {
        const candidate = parts[1];
        return /^[a-zA-Z0-9_-]{11}$/.test(candidate) ? candidate : null;
      }
    }
  } catch {
    const regexMatch = trimmed.match(/(?:v=|\/embed\/|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
    if (regexMatch && regexMatch[1]) {
      return regexMatch[1];
    }
  }

  return null;
}

/**
 * Extracts a numeric Netflix Watch ID from a Netflix watch/title URL or numeric string.
 */
export function extractNetflixWatchId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^\d{6,10}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/netflix\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:watch|title)\/(\d{6,10})/i);
  return match ? match[1] : null;
}

/**
 * Resolves YouTube video title and thumbnail with a fast 1.5s timeout and instant curated fallback.
 */
export async function fetchYouTubeMetadata(videoId: string): Promise<{
  title: string;
  authorName: string;
  thumbnailUrl: string;
}> {
  const curated = CURATED_YOUTUBE_VIDEOS.find((v) => v.videoId === videoId);
  const defaultThumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  if (curated) {
    return {
      title: curated.title,
      authorName: curated.directorOrChannel,
      thumbnailUrl: curated.thumbnailUrl,
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1600);
    const res = await fetch(
      `https://noembed.com/embed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data && data.title) {
        return {
          title: data.title,
          authorName: data.author_name || 'YouTube Creator',
          thumbnailUrl: data.thumbnail_url || defaultThumb,
        };
      }
    }
  } catch {
    // Fallback immediately without throwing
  }

  return {
    title: `YouTube 4K Screening • ${videoId}`,
    authorName: 'YouTube',
    thumbnailUrl: defaultThumb,
  };
}

export function resolveNetflixMetadata(watchId: string) {
  const found = SUPPORTED_NETFLIX_TITLES.find((t) => t.watchId === watchId);
  if (found) return found;
  return {
    watchId,
    title: `Netflix Party Title #${watchId}`,
    year: '2025',
    maturity: 'TV-14',
    durationLabel: 'HD Sync',
    genre: 'Netflix Watch Party',
    synopsis: 'Synchronized via VYBE Chrome Extension across each participant’s authenticated Netflix session.',
    posterUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80',
  };
}

export function formatTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 3; i++) {
    part1 += chars[Math.floor(Math.random() * chars.length)];
    part2 += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${part1}-${part2}`;
}

// ============================================================================
// Client-Side Resilient Room & Movie Cache
// ============================================================================
const LOCAL_ROOMS_KEY = 'vybe_local_rooms_clean_v2';
const LOCAL_MESSAGES_KEY = 'vybe_local_messages_clean_v2';
const LOCAL_MOVIES_KEY = 'vybe_local_site_movies_v2';

export function getSeedRoomsClient(): Record<string, WatchRoom> {
  return {};
}

export function getLocalSiteMovies(): SiteMovieItem[] {
  if (typeof window === 'undefined') return [...INITIAL_SITE_MOVIES];
  try {
    const raw = localStorage.getItem(LOCAL_MOVIES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SiteMovieItem[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Ignore
  }
  return [...INITIAL_SITE_MOVIES];
}

export function saveLocalSiteMovie(movie: SiteMovieItem): SiteMovieItem[] {
  const current = getLocalSiteMovies().filter((m) => m.id !== movie.id);
  const updated = [movie, ...current];
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_MOVIES_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }
  }
  return updated;
}

export function getLocalRoomsMap(): Record<string, WatchRoom> {
  if (typeof window === 'undefined') return getSeedRoomsClient();
  try {
    const raw = localStorage.getItem(LOCAL_ROOMS_KEY);
    if (raw) {
      return { ...getSeedRoomsClient(), ...JSON.parse(raw) };
    }
  } catch {
    // Ignore
  }
  return getSeedRoomsClient();
}

export function saveLocalRoom(room: WatchRoom) {
  if (typeof window === 'undefined') return;
  try {
    const map = getLocalRoomsMap();
    map[room.code.toUpperCase()] = room;
    localStorage.setItem(LOCAL_ROOMS_KEY, JSON.stringify(map));
  } catch {
    // Ignore
  }
}

export function getLocalRoom(code: string): WatchRoom | null {
  const map = getLocalRoomsMap();
  return map[code.toUpperCase()] || null;
}

export function getLocalRoomMessages(code: string): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_MESSAGES_KEY);
    const map = raw ? JSON.parse(raw) : {};
    return map[code.toUpperCase()] || [];
  } catch {
    return [];
  }
}

export function saveLocalRoomMessages(code: string, messages: ChatMessage[]) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(LOCAL_MESSAGES_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[code.toUpperCase()] = messages.slice(-200);
    localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(map));
  } catch {
    // Ignore
  }
}

export function buildClientRoomObject(params: {
  title: string;
  description: string;
  hostId: string;
  hostName: string;
  hostUsername: string;
  hostAvatar: string;
  isGuest: boolean;
  platform: PlatformType;
  privacy: RoomPrivacy;
  hasPassword?: boolean;
  allowGuests: boolean;
  waitingRoomEnabled: boolean;
  participantLimit: number;
  controlPermission: ControlPermission;
  videoId: string;
  videoTitle: string;
  videoThumbnail?: string;
}): WatchRoom {
  const code = generateRoomCode();
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const roomId = `room-${code.toLowerCase()}-${nowMs.toString(36)}`;

  const room: WatchRoom = {
    id: roomId,
    code,
    title: params.title,
    description: params.description,
    hostId: params.hostId,
    hostName: params.hostName,
    hostAvatar: params.hostAvatar,
    platform: params.platform,
    privacy: params.privacy,
    hasPassword: Boolean(params.hasPassword),
    allowGuests: params.allowGuests,
    waitingRoomEnabled: params.waitingRoomEnabled,
    isLocked: false,
    isActive: true,
    participantLimit: params.participantLimit,
    controlPermission: params.controlPermission,
    playback: {
      roomId,
      platform: params.platform,
      videoId: params.videoId,
      videoTitle: params.videoTitle,
      videoThumbnail: params.videoThumbnail,
      netflixWatchId: params.platform === 'netflix' ? params.videoId : undefined,
      isPlaying: false,
      currentTime: 0,
      playbackRate: 1,
      seq: 1,
      updatedBy: params.hostId,
      updatedByName: params.hostName,
      updatedAt: nowMs,
    },
    participants: [
      {
        userId: params.hostId,
        displayName: params.hostName,
        username: params.hostUsername,
        avatarUrl: params.hostAvatar,
        role: 'host',
        status: 'joined',
        isGuest: params.isGuest,
        isChatMuted: false,
        isVoiceMuted: true,
        isCameraOn: false,
        isSpeaking: false,
        reportedTime: 0,
        syncDrift: 0,
        extensionConnected: params.platform === 'youtube',
        joinedAt: nowIso,
        lastActiveAt: nowMs,
      },
    ],
    queue: [],
    createdAt: nowIso,
  };

  saveLocalRoom(room);
  saveLocalRoomMessages(code, [
    {
      id: `msg-init-${nowMs}`,
      roomId,
      userId: 'system',
      senderName: 'VYBE Cinema Engine',
      senderAvatar: params.hostAvatar,
      senderRole: 'host',
      type: 'system',
      content: `${params.hostName} launched room ${code} (${params.platform.toUpperCase()}).`,
      reactions: {},
      createdAt: nowIso,
    },
  ]);

  return room;
}
