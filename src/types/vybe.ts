export type PlatformType = 'youtube' | 'netflix';
export type RoomPrivacy = 'public' | 'private';
export type ControlPermission = 'host_only' | 'cohosts' | 'everyone';
export type MemberRole = 'host' | 'cohost' | 'member' | 'guest';
export type MemberStatus = 'joined' | 'waiting' | 'kicked' | 'left';
export type PresenceStatus = 'online' | 'watching' | 'away' | 'offline';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  username: string;
  avatarUrl: string;
  bio: string;
  presenceStatus: PresenceStatus;
  currentRoomCode?: string | null;
  accentColor: string;
  isGuest: boolean;
  preferences: UserPreferences;
  createdAt: string;
}

export interface UserPreferences {
  reducedMotion: boolean;
  reactionSounds: boolean;
  autoSyncThresholdSec: number;
  floatingChatDefault: boolean;
  showPresenceToFriends: boolean;
  defaultRoomPrivacy: RoomPrivacy;
}

export interface PlaybackState {
  roomId: string;
  platform: PlatformType;
  videoId: string;
  videoTitle: string;
  videoThumbnail?: string;
  netflixWatchId?: string;
  isPlaying: boolean;
  currentTime: number; // in seconds
  playbackRate: number;
  seq: number;
  updatedBy: string;
  updatedByName: string;
  updatedAt: number; // epoch ms
}

export interface RoomParticipant {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string;
  role: MemberRole;
  status: MemberStatus;
  isGuest: boolean;
  isChatMuted: boolean;
  isVoiceMuted: boolean;
  isCameraOn: boolean;
  isSpeaking: boolean;
  reportedTime: number;
  syncDrift: number; // difference in seconds from authoritative host playback
  extensionConnected: boolean;
  netflixReady?: boolean;
  joinedAt: string;
  lastActiveAt: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  senderName: string;
  senderAvatar: string;
  senderRole: MemberRole;
  type: 'text' | 'gif' | 'system';
  content: string;
  gifUrl?: string;
  replyTo?: {
    id: string;
    senderName: string;
    content: string;
  } | null;
  reactions: Record<string, string[]>; // emoji -> array of userIds
  createdAt: string;
}

export interface ReactionDefinition {
  id: string;
  emoji: string;
  label: string;
  shortcut: string;
  isSpecial?: boolean;
  glowColor: string;
}

export interface FloatingReactionEvent {
  id: string;
  roomId: string;
  userId: string;
  senderName: string;
  senderAvatar: string;
  emoji: string;
  label: string;
  isSpecial: boolean;
  glowColor: string;
  videoTimestamp: number;
  createdAt: number;
  // Computed deterministic trajectory params
  startX: number; // percentage 12..88
  driftX: number; // px -55..55
  rotation: number; // deg -24..24
  scale: number; // 0.95..1.35
  duration: number; // sec 2.6..3.6
}

export interface QueueItem {
  id: string;
  roomId: string;
  platform: PlatformType;
  videoId: string;
  title: string;
  thumbnailUrl: string;
  durationLabel: string;
  netflixSynopsis?: string;
  addedById: string;
  addedByName: string;
  position: number;
  score: number;
  upvoterIds: string[];
  downvoterIds: string[];
  createdAt: string;
}

export interface WatchRoom {
  id: string;
  code: string;
  title: string;
  description: string;
  hostId: string;
  hostName: string;
  hostAvatar: string;
  platform: PlatformType;
  privacy: RoomPrivacy;
  hasPassword: boolean;
  allowGuests: boolean;
  waitingRoomEnabled: boolean;
  isLocked: boolean;
  isActive: boolean;
  participantLimit: number;
  controlPermission: ControlPermission;
  playback: PlaybackState;
  participants: RoomParticipant[];
  queue: QueueItem[];
  createdAt: string;
}

export interface SavedWatchlistItem {
  id: string;
  platform: PlatformType;
  videoId: string;
  title: string;
  thumbnailUrl: string;
  durationLabel: string;
  addedAt: string;
}

export interface SavedWatchlist {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  items: SavedWatchlistItem[];
  createdAt: string;
}

export interface RoomInvitation {
  id: string;
  roomId: string;
  roomCode: string;
  roomTitle: string;
  platform: PlatformType;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  recipientId?: string;
  recipientEmail?: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export type RealtimeRoomEvent =
  | { type: 'PLAYBACK_SYNC'; roomCode: string; playback: PlaybackState; senderId: string }
  | { type: 'REQUEST_SYNC'; roomCode: string; requesterId: string; requesterName: string }
  | { type: 'REACTION_BURST'; roomCode: string; reaction: FloatingReactionEvent }
  | { type: 'CHAT_MESSAGE'; roomCode: string; message: ChatMessage }
  | { type: 'CHAT_REACTION'; roomCode: string; messageId: string; emoji: string; userId: string }
  | { type: 'ROOM_UPDATED'; roomCode: string; room: WatchRoom }
  | { type: 'PARTICIPANT_HEARTBEAT'; roomCode: string; participant: Partial<RoomParticipant> & { userId: string } }
  | { type: 'WEBRTC_SIGNAL'; roomCode: string; fromUserId: string; toUserId: string; signal: unknown }
  | { type: 'ROOM_ENDED'; roomCode: string; endedBy: string };
