'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Tv,
  Users,
  MessageSquare,
  ListVideo,
  Settings,
  Share2,
  Copy,
  Check,
  Radio,
  AlertTriangle,
  Lock,
  Shield,
  Crown,
  UserCheck,
  UserX,
  VolumeX,
  Volume2,
  ArrowLeft,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { useVybe } from '@/context/VybeContext';
import {
  ChatMessage,
  ControlPermission,
  FloatingReactionEvent,
  MemberStatus,
  PlatformType,
  PlaybackState,
  QueueItem,
  ReactionDefinition,
  RealtimeRoomEvent,
  RoomPrivacy,
  WatchRoom,
} from '@/types/vybe';
import { NetflixCompanionDeck } from '@/components/room/NetflixCompanionDeck';
import { PlaybackManager } from '@/lib/playback/playback-manager';
import { SyncEngine } from '@/lib/playback/sync-engine';
import { FloatingReactionsLayer } from '@/components/room/FloatingReactionsLayer';
import { LiveChatPanel } from '@/components/room/LiveChatPanel';
import { WatchQueuePanel } from '@/components/room/WatchQueuePanel';
import { VoiceVideoDock } from '@/components/room/VoiceVideoDock';
import { RoomSettingsModal } from '@/components/room/RoomSettingsModal';
import { GlowButton } from '@/components/ui/AceternityPrimitives';
import {
  buildClientRoomObject,
  formatTimestamp,
  getLocalRoom,
  getLocalRoomMessages,
  resolveNetflixMetadata,
  saveLocalRoom,
  saveLocalRoomMessages,
} from '@/lib/utils';
import { SUPPORTED_NETFLIX_TITLES, VYBE_REACTIONS } from '@/lib/constants';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export function WatchRoomClient() {
  const params = useParams();
  const router = useRouter();
  const queryCode =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('code')
      : null;
  const pathCode =
    typeof window !== 'undefined'
      ? window.location.pathname.split('/room/')[1]?.split('/')[0]
      : undefined;
  const rawCode =
    queryCode ||
    pathCode ||
    (Array.isArray(params?.code) ? params.code[0] : params?.code) ||
    'VYB-4K1';
  const roomCode = decodeURIComponent(rawCode).toUpperCase();

  const {
    user,
    isLoadingAuth,
    continueAsGuest,
    addToast,
    setProfileModalOpen,
  } = useVybe();

  const [room, setRoom] = useState<WatchRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReactionEvent[]>([]);
  const [memberStatus, setMemberStatus] = useState<MemberStatus>('joined');
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  // UI state
  const [activeTab, setActiveTab] = useState<'chat' | 'queue' | 'participants'>('chat');
  const [isFloatingChat, setIsFloatingChat] = useState(false);
  const [isVideoHovered, setIsVideoHovered] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [connectionHealth, setConnectionHealth] = useState<'connected' | 'reconnecting'>(
    'connected'
  );
  const [localDriftSec, setLocalDriftSec] = useState<number>(0);

  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const joinedOnceRef = useRef<boolean>(false);

  const playbackManagerRef = useRef<PlaybackManager | null>(null);
  if (!playbackManagerRef.current) {
    playbackManagerRef.current = new PlaybackManager();
  }

  const syncEngineRef = useRef<SyncEngine | null>(null);
  const localNetflixTabRef = useRef<string | null>(null);
  const mismatchToastRef = useRef<number>(0);
  if (!syncEngineRef.current) {
    syncEngineRef.current = new SyncEngine({
      playbackManager: playbackManagerRef.current,
      onPublishSync: (state) => {
        setRoom((prev) => (prev ? { ...prev, playback: state } : prev));
        publishRealtimeEvent({
          type: 'PLAYBACK_SYNC',
          roomCode,
          playback: state,
          senderId: user?.id || 'host',
        });
      },
      onDriftReport: (drift) => {
        setLocalDriftSec(drift);
      },
    });

    syncEngineRef.current.setOnTitleMismatch((remoteId, localId) => {
      const now = Date.now();
      if (now - mismatchToastRef.current < 5000) return;
      mismatchToastRef.current = now;
      addToast({
        title: 'Different Netflix Title Detected',
        description: `You are watching title #${localId}, but the room is set to #${remoteId}. Open the same title on Netflix.com to sync.`,
        variant: 'warning',
      });
    });
  }

  useEffect(() => {
    return () => {
      playbackManagerRef.current?.destroy();
      syncEngineRef.current?.destroy();
    };
  }, []);

  // Publish event to Server Realtime Broker + Browser BroadcastChannel + Supabase Realtime
  const publishRealtimeEvent = useCallback(
    async (event: RealtimeRoomEvent) => {
      try {
        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.postMessage(event);
        }
      } catch {
        // Ignore
      }

      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        supabase
          .channel(`room:${roomCode}`)
          .send({
            type: 'broadcast',
            event: event.type,
            payload: event,
          })
          .catch(() => {});
      }

      try {
        await fetch('/api/realtime/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: `room:${roomCode}`,
            event,
          }),
        });
      } catch {
        // Ignore network hiccup
      }
    },
    [roomCode]
  );

  // Handle incoming realtime events from SSE, BroadcastChannel, or Supabase
  const handleIncomingRealtimeEvent = useCallback(
    (event: RealtimeRoomEvent) => {
      if (!event || event.roomCode?.toUpperCase() !== roomCode) return;

      if (event.type === 'PLAYBACK_SYNC') {
        const authoritativeId = event.playback.netflixWatchId
          ? event.playback.netflixWatchId.toUpperCase()
          : null;
        const localTabId = localNetflixTabRef.current;

        if (authoritativeId && localTabId && authoritativeId !== localTabId) {
          const now = Date.now();
          if (now - mismatchToastRef.current >= 5000) {
            mismatchToastRef.current = now;
            addToast({
              title: 'Different Netflix Title Detected',
              description: `You are watching title #${localTabId}, but the room is set to #${authoritativeId}. Open the same title on Netflix.com to sync.`,
              variant: 'warning',
            });
          }
        }

        setRoom((prev) => {
          if (!prev) return prev;
          if (event.playback.seq < prev.playback.seq) return prev;
          return {
            ...prev,
            platform: event.playback.platform,
            playback: { ...event.playback },
          };
        });
        syncEngineRef.current?.handleRemoteSync(event.playback);
      } else if (event.type === 'EXTENSION_HEARTBEAT') {
        // Live observation from a participant's Netflix tab — feeds the
        // title/position display and the different-title detection.
        const wid = event.watchId ? String(event.watchId).toUpperCase() : null;
        const cur = Number(event.currentTime || 0);
        const isPlaying = Boolean(event.isPlaying);
        const dur = Number(event.duration || 0);

        setRoom((prev) => {
          if (!prev) return prev;
          const nextPlayback: PlaybackState = {
            ...prev.playback,
            isPlaying,
            currentTime: cur,
          };
          if (wid) {
            localNetflixTabRef.current = wid;
            const knownId = (prev.playback.netflixWatchId || '').toUpperCase();
            if (!knownId || wid !== knownId) {
              // Detect a different title or host-side title switching
              nextPlayback.netflixWatchId = wid;
              nextPlayback.videoTitle = resolveNetflixMetadata(wid).title;
            }
          }
          if (dur > 0) {
            nextPlayback.duration = dur;
          }
          return { ...prev, playback: nextPlayback };
        });
      } else if (event.type === 'REQUEST_SYNC') {
        setRoom((prev) => {
          if (!prev || !user) return prev;
          if (prev.hostId === user.id) {
            addToast({
              title: `${event.requesterName} requested a timestamp sync`,
              description: 'Broadcasting authoritative room clock...',
            });
          }
          return prev;
        });
      } else if (event.type === 'REACTION_BURST') {
        setFloatingReactions((prev) => {
          if (prev.some((r) => r.id === event.reaction.id)) return prev;
          return [...prev.slice(-30), event.reaction];
        });
      } else if (event.type === 'CHAT_MESSAGE') {
        setMessages((prev) => {
          if (prev.some((m) => m.id === event.message.id)) return prev;
          return [...prev, event.message];
        });
      } else if (event.type === 'CHAT_REACTION') {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== event.messageId) return m;
            const current = m.reactions[event.emoji] || [];
            const exists = current.includes(event.userId);
            const updatedList = exists
              ? current.filter((id) => id !== event.userId)
              : [...current, event.userId];
            const nextReactions = { ...m.reactions };
            if (updatedList.length === 0) {
              delete nextReactions[event.emoji];
            } else {
              nextReactions[event.emoji] = updatedList;
            }
            return { ...m, reactions: nextReactions };
          })
        );
      } else if (event.type === 'ROOM_UPDATED') {
        setRoom(event.room);
        if (user) {
          const me = event.room.participants.find((p) => p.userId === user.id);
          if (me) {
            setMemberStatus(me.status);
          }
        }
      } else if (event.type === 'PARTICIPANT_HEARTBEAT') {
        setRoom((prev) => {
          if (!prev) return prev;
          const idx = prev.participants.findIndex(
            (p) => p.userId === event.participant.userId
          );
          if (idx < 0) return prev;
          const updated = [...prev.participants];
          updated[idx] = {
            ...updated[idx],
            ...event.participant,
            lastActiveAt: Date.now(),
          };
          return { ...prev, participants: updated };
        });
      } else if (event.type === 'ROOM_ENDED') {
        addToast({
          title: 'Watch Party Ended',
          description: 'The host has ended this watch party session.',
          variant: 'warning',
        });
        router.push('/dashboard');
      }
    },
    [addToast, roomCode, router, user]
  );

  // Join room & load authoritative state
  const joinAndHydrateRoom = useCallback(
    async (providedPassword?: string) => {
      if (isLoadingAuth) return;
      setLoadingRoom(true);
      setRoomError(null);

      try {
        let activeUser = user;
        if (!activeUser) {
          activeUser = await continueAsGuest();
        }

        const localCachedRoom = getLocalRoom(roomCode);
        let loadedRoom: WatchRoom | null = null;
        let loadedStatus: MemberStatus = 'joined';
        let loadedMessages: ChatMessage[] = [];

        try {
          const res = await fetch('/api/rooms', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'JOIN_ROOM',
              roomCode,
              password: providedPassword,
              clientRoom: localCachedRoom,
              user: {
                id: activeUser.id,
                displayName: activeUser.displayName,
                username: activeUser.username,
                avatarUrl: activeUser.avatarUrl,
                isGuest: activeUser.isGuest,
              },
            }),
          });

          const data = await res.json();
          if (res.status === 401 && data.requiresPassword) {
            setRequiresPassword(true);
            setLoadingRoom(false);
            return;
          }

          if (res.ok && data.room) {
            loadedRoom = data.room as WatchRoom;
            loadedStatus = data.memberStatus || 'joined';
            loadedMessages = data.messages || [];
            saveLocalRoom(loadedRoom);
            saveLocalRoomMessages(roomCode, loadedMessages);
          }
        } catch {
          // Fallback to client room cache if server fetch was interrupted
        }

        if (!loadedRoom && localCachedRoom) {
          const exists = localCachedRoom.participants.some(
            (p) => p.userId === activeUser.id
          );
          if (!exists) {
            localCachedRoom.participants.push({
              userId: activeUser.id,
              displayName: activeUser.displayName,
              username: activeUser.username,
              avatarUrl: activeUser.avatarUrl,
              role: localCachedRoom.hostId === activeUser.id ? 'host' : 'member',
              status: 'joined',
              isGuest: activeUser.isGuest,
              isChatMuted: false,
              isVoiceMuted: true,
              isCameraOn: false,
              isSpeaking: false,
              reportedTime: localCachedRoom.playback.currentTime,
              syncDrift: 0,
              extensionConnected: true,
              joinedAt: new Date().toISOString(),
              lastActiveAt: Date.now(),
            });
            saveLocalRoom(localCachedRoom);
          }
          loadedRoom = localCachedRoom;
          loadedMessages = getLocalRoomMessages(roomCode);
        }

        if (!loadedRoom) {
          // Auto-initialize room for this code so shared room links always work
          const autoCreated = buildClientRoomObject({
            title: `Watch Party ${roomCode}`,
            description: 'Synchronized watch party room',
            hostId: activeUser.id,
            hostName: activeUser.displayName,
            hostUsername: activeUser.username,
            hostAvatar: activeUser.avatarUrl,
            isGuest: activeUser.isGuest,
            platform: 'netflix',
            privacy: 'public',
            allowGuests: true,
            waitingRoomEnabled: false,
            participantLimit: 25,
            controlPermission: 'everyone',
            videoId: '',
            videoTitle: 'Netflix Watch Party',
            videoThumbnail: '',
          });
          autoCreated.code = roomCode;
          saveLocalRoom(autoCreated);
          loadedRoom = autoCreated;
          loadedMessages = getLocalRoomMessages(roomCode);
        }

        setRequiresPassword(false);
        setRoom(loadedRoom);
        setMemberStatus(loadedStatus);
        setMessages(loadedMessages);
        if (activeUser.preferences?.floatingChatDefault) {
          setIsFloatingChat(true);
        }
      } catch (err) {
        setRoomError(err instanceof Error ? err.message : 'Unable to join room');
      } finally {
        setLoadingRoom(false);
      }
    },
    [continueAsGuest, isLoadingAuth, roomCode, user]
  );

  useEffect(() => {
    if (!isLoadingAuth && !joinedOnceRef.current) {
      joinedOnceRef.current = true;
      joinAndHydrateRoom();
    }
  }, [isLoadingAuth, joinAndHydrateRoom]);

  // Connect Server-Sent Events (SSE) + BroadcastChannel + Supabase Realtime with Auto-Recovery
  useEffect(() => {
    // 1. Browser BroadcastChannel
    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('vybe_realtime_bus');
      broadcastChannelRef.current = bc;
      bc.onmessage = (ev) => {
        if (ev.data) handleIncomingRealtimeEvent(ev.data as RealtimeRoomEvent);
      };
    }

    // 2. Server-Sent Events Stream
    const eventSource = new EventSource(
      `/api/realtime/stream?channel=${encodeURIComponent(`room:${roomCode}`)}`
    );

    eventSource.onopen = () => {
      setConnectionHealth('connected');
    };

    eventSource.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data);
        if (parsed && parsed.type && parsed.type !== 'CONNECTED') {
          handleIncomingRealtimeEvent(parsed as RealtimeRoomEvent);
        }
      } catch {
        // Ignore non-JSON ping
      }
    };

    eventSource.onerror = () => {
      setConnectionHealth('reconnecting');
      // Recover authoritative room state on network interruption
      fetch(`/api/rooms?code=${encodeURIComponent(roomCode)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.room) {
            setRoom(data.room);
            setConnectionHealth('connected');
          }
        })
        .catch(() => {});
    };

    // 3. Supabase Realtime Broadcast Channel (when configured)
    const supabase = getSupabaseBrowserClient();
    const sbChannel = supabase ? supabase.channel(`room:${roomCode}`) : null;
    if (sbChannel) {
      sbChannel
        .on('broadcast', { event: '*' }, (payload) => {
          if (payload.payload) {
            handleIncomingRealtimeEvent(payload.payload as RealtimeRoomEvent);
          }
        })
        .subscribe();
    }

    return () => {
      eventSource.close();
      if (bc) bc.close();
      if (sbChannel && supabase) {
        supabase.removeChannel(sbChannel);
      }
    };
  }, [handleIncomingRealtimeEvent, roomCode]);

  // Derived permissions
  const currentParticipant = room?.participants.find((p) => p.userId === user?.id);
  const isHost = Boolean(
    room && user && (room.hostId === user.id || currentParticipant?.role === 'host')
  );
  const isModerator = Boolean(
    isHost || currentParticipant?.role === 'cohost'
  );
  const canControlPlayback = Boolean(
    room &&
      (isHost ||
        (room.controlPermission === 'cohosts' && isModerator) ||
        room.controlPermission === 'everyone')
  );

  useEffect(() => {
    if (syncEngineRef.current && room && user) {
      syncEngineRef.current.updateContext({
        isHost,
        userRole: currentParticipant?.role || 'member',
        controlPermission: room.controlPermission,
        userId: user.id,
        userName: user.displayName,
        roomId: room.id,
        roomCode: room.code,
        localNetflixWatchId: localNetflixTabRef.current,
      });
    }
  }, [room, user, isHost, currentParticipant?.role]);

  // ─────────────────────────────────────────────────────────────
  // Netflix Companion handlers — commands go to the room's
  // extension pair, which executes them on participants' Netflix tabs.
  // ─────────────────────────────────────────────────────────────
  const handleCompanionPlay = useCallback(async () => {
    if (!room) return;
    await playbackManagerRef.current?.play('user');
    syncEngineRef.current?.handleUserAction({
      isPlaying: true,
      currentTime: Number(room.playback.currentTime.toFixed(2)),
      videoId: room.playback.netflixWatchId || room.playback.videoId,
      videoTitle: room.playback.videoTitle,
      videoThumbnail: room.playback.videoThumbnail,
    });
  }, [room]);

  const handleCompanionPause = useCallback(async () => {
    if (!room) return;
    await playbackManagerRef.current?.pause('user');
    syncEngineRef.current?.handleUserAction({
      isPlaying: false,
      currentTime: Number(room.playback.currentTime.toFixed(2)),
      videoId: room.playback.netflixWatchId || room.playback.videoId,
      videoTitle: room.playback.videoTitle,
      videoThumbnail: room.playback.videoThumbnail,
    });
  }, [room]);

  const handleCompanionSeek = useCallback(
    async (nextTime: number) => {
      if (!room) return;
      await playbackManagerRef.current?.seek(nextTime, 'user');
      syncEngineRef.current?.handleUserAction({
        isPlaying: room.playback.isPlaying,
        currentTime: Number(nextTime.toFixed(2)),
        videoId: room.playback.netflixWatchId || room.playback.videoId,
        videoTitle: room.playback.videoTitle,
        videoThumbnail: room.playback.videoThumbnail,
      });
    },
    [room]
  );

  // Presence heartbeat — reports the last observed Netflix position.
  useEffect(() => {
    if (!user || !room) return;
    const timer = setInterval(() => {
      if (!room) return;
      publishRealtimeEvent({
        type: 'PARTICIPANT_HEARTBEAT',
        roomCode,
        participant: {
          userId: user.id,
          reportedTime: Number((room.playback.currentTime || 0).toFixed(1)),
          extensionConnected: true,
        },
      });
    }, 3500);
    return () => clearInterval(timer);
  }, [publishRealtimeEvent, room, roomCode, user]);

  // Request or force resync
  const handleRequestResync = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms?code=${encodeURIComponent(roomCode)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.room) {
          // Bump seq locally so player immediately snaps to authoritative timestamp
          const freshRoom: WatchRoom = {
            ...data.room,
            playback: {
              ...data.room.playback,
              seq: data.room.playback.seq + 1,
            },
          };
          setRoom(freshRoom);
          setLocalDriftSec(0);
          addToast({
            title: 'Player Synchronized',
            description: `Locked to room timestamp ${formatTimestamp(
              freshRoom.playback.currentTime
            )}`,
            variant: 'success',
          });
        }
      }
      if (user && !isHost) {
        publishRealtimeEvent({
          type: 'REQUEST_SYNC',
          roomCode,
          requesterId: user.id,
          requesterName: user.displayName,
        });
      }
    } catch {
      // Ignore
    }
  }, [addToast, isHost, publishRealtimeEvent, roomCode, user]);

  // Trigger Animated Floating Reaction
  const handleTriggerReaction = useCallback(
    (def: ReactionDefinition) => {
      if (!room || !user) return;
      const reactionEvent: FloatingReactionEvent = {
        id: `rx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        roomId: room.id,
        userId: user.id,
        senderName: user.displayName,
        senderAvatar: user.avatarUrl,
        emoji: def.emoji,
        label: def.label,
        isSpecial: Boolean(def.isSpecial),
        glowColor: def.glowColor,
        videoTimestamp: room.playback.currentTime,
        createdAt: Date.now(),
        startX: 12 + Math.floor(Math.random() * 74),
        driftX: Math.floor(Math.random() * 90) - 45,
        rotation: Math.floor(Math.random() * 42) - 21,
        scale: def.isSpecial ? 1.28 : 1.05,
        duration: 2.7 + Math.random() * 0.8,
      };

      setFloatingReactions((prev) => [...prev.slice(-30), reactionEvent]);

      publishRealtimeEvent({
        type: 'REACTION_BURST',
        roomCode,
        reaction: reactionEvent,
      });
    },
    [publishRealtimeEvent, room, roomCode, user]
  );

  // Send Live Chat Message
  const handleSendChatMessage = useCallback(
    (payload: {
      content: string;
      type: 'text' | 'gif';
      gifUrl?: string;
      replyTo?: { id: string; senderName: string; content: string } | null;
    }) => {
      if (!room || !user) return;
      const msg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        roomId: room.id,
        userId: user.id,
        senderName: user.displayName,
        senderAvatar: user.avatarUrl,
        senderRole: currentParticipant?.role || 'member',
        type: payload.type,
        content: payload.content,
        gifUrl: payload.gifUrl,
        replyTo: payload.replyTo || null,
        reactions: {},
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, msg]);
      publishRealtimeEvent({
        type: 'CHAT_MESSAGE',
        roomCode,
        message: msg,
      });
    },
    [currentParticipant?.role, publishRealtimeEvent, room, roomCode, user]
  );

  // Toggle Chat Message Reaction
  const handleToggleMessageReaction = useCallback(
    (messageId: string, emoji: string) => {
      if (!user) return;
      publishRealtimeEvent({
        type: 'CHAT_REACTION',
        roomCode,
        messageId,
        emoji,
        userId: user.id,
      });
    },
    [publishRealtimeEvent, roomCode, user]
  );

  // Queue operations (optimistic client update + server sync)
  const executeQueueAction = useCallback(
    async (payload: Record<string, unknown>) => {
      setRoom((prev) => {
        if (!prev) return prev;
        const nextRoom: WatchRoom = {
          ...prev,
          queue: [...prev.queue],
          playback: { ...prev.playback },
        };
        const queueOp = payload.queueOp as string;
        if (queueOp === 'ADD' && payload.item) {
          nextRoom.queue.push({
            ...(payload.item as QueueItem),
            position: nextRoom.queue.length,
          });
        } else if (queueOp === 'VOTE') {
          const itemId = payload.itemId as string;
          const direction = payload.direction as 'up' | 'down';
          const uid = user?.id || 'guest';
          nextRoom.queue = nextRoom.queue
            .map((q) => {
              if (q.id !== itemId) return q;
              const up = q.upvoterIds.filter((id) => id !== uid);
              const down = q.downvoterIds.filter((id) => id !== uid);
              if (direction === 'up') up.push(uid);
              else down.push(uid);
              return {
                ...q,
                upvoterIds: up,
                downvoterIds: down,
                score: up.length - down.length,
              };
            })
            .sort((a, b) => b.score - a.score);
        } else if (queueOp === 'MOVE') {
          const idx = nextRoom.queue.findIndex((q) => q.id === payload.itemId);
          const swapIdx = idx + Number(payload.dir || 0);
          if (idx >= 0 && swapIdx >= 0 && swapIdx < nextRoom.queue.length) {
            const tmp = nextRoom.queue[idx];
            nextRoom.queue[idx] = nextRoom.queue[swapIdx];
            nextRoom.queue[swapIdx] = tmp;
          }
        } else if (queueOp === 'REMOVE') {
          nextRoom.queue = nextRoom.queue.filter((q) => q.id !== payload.itemId);
        } else if (queueOp === 'PLAY_ITEM' || queueOp === 'PLAY_NEXT') {
          const target =
            queueOp === 'PLAY_ITEM'
              ? nextRoom.queue.find((q) => q.id === payload.itemId)
              : nextRoom.queue[0];
          if (target) {
            nextRoom.platform = target.platform;
            nextRoom.playback = {
              roomId: nextRoom.id,
              platform: target.platform,
              videoId: target.videoId,
              videoTitle: target.title,
              videoThumbnail: target.thumbnailUrl,
              netflixWatchId:
                target.platform === 'netflix' ? target.videoId : undefined,
              isPlaying: true,
              currentTime: 0,
              playbackRate: 1,
              seq: nextRoom.playback.seq + 1,
              updatedBy: user?.id || nextRoom.hostId,
              updatedByName: user?.displayName || nextRoom.hostName,
              updatedAt: Date.now(),
            };
            nextRoom.queue = nextRoom.queue.filter((q) => q.id !== target.id);
          }
        }
        saveLocalRoom(nextRoom);
        publishRealtimeEvent({
          type: 'ROOM_UPDATED',
          roomCode,
          room: nextRoom,
        });
        return nextRoom;
      });

      try {
        const res = await fetch('/api/rooms', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'QUEUE_ACTION',
            roomCode,
            userId: user?.id,
            userName: user?.displayName,
            ...payload,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.room) {
            setRoom(data.room);
            saveLocalRoom(data.room);
          }
        }
      } catch {
        // Optimistic update already applied
      }
    },
    [publishRealtimeEvent, roomCode, user?.displayName, user?.id]
  );

  const handleDirectSwitchMedia = useCallback(
    async (videoId: string, videoTitle: string, videoThumbnail: string) => {
      setRoom((prev) => {
        if (!prev) return prev;
        const nextPlayback: PlaybackState = {
          roomId: prev.id,
          platform: 'netflix',
          videoId,
          videoTitle,
          videoThumbnail,
          netflixWatchId: videoId,
          isPlaying: true,
          currentTime: 0,
          playbackRate: 1,
          seq: prev.playback.seq + 1,
          updatedBy: user?.id || prev.hostId,
          updatedByName: user?.displayName || prev.hostName,
          updatedAt: Date.now(),
        };
        const nextRoom: WatchRoom = {
          ...prev,
          platform: 'netflix',
          playback: nextPlayback,
        };
        saveLocalRoom(nextRoom);
        publishRealtimeEvent({
          type: 'PLAYBACK_SYNC',
          roomCode,
          playback: nextPlayback,
          senderId: user?.id || prev.hostId,
        });
        publishRealtimeEvent({
          type: 'ROOM_UPDATED',
          roomCode,
          room: nextRoom,
        });
        return nextRoom;
      });

      addToast({
        title: `Now Screening: ${videoTitle}`,
        description: `Synchronized across all viewers in room ${roomCode}.`,
        variant: 'success',
      });

      try {
        const res = await fetch('/api/rooms', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'CHANGE_MEDIA',
            roomCode,
            platform: 'netflix',
            videoId,
            videoTitle,
            videoThumbnail,
            userId: user?.id,
            userName: user?.displayName,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.room) {
            setRoom(data.room);
            saveLocalRoom(data.room);
          }
        }
      } catch {
        // Optimistic update already applied
      }
    },
    [addToast, publishRealtimeEvent, roomCode, user?.displayName, user?.id]
  );

  // Participant moderation
  const handleManageParticipant = useCallback(
    async (
      targetUserId: string,
      operation:
        | 'APPROVE_WAITING'
        | 'KICK'
        | 'TOGGLE_CHAT_MUTE'
        | 'TOGGLE_COHOST'
        | 'TRANSFER_HOST'
    ) => {
      const res = await fetch('/api/rooms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'MANAGE_PARTICIPANT',
          roomCode,
          targetUserId,
          operation,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.room) setRoom(data.room);
      }
    },
    [roomCode]
  );

  // Save Room Settings
  const handleSaveRoomSettings = useCallback(
    async (settings: {
      title: string;
      description: string;
      privacy: RoomPrivacy;
      password?: string;
      allowGuests: boolean;
      waitingRoomEnabled: boolean;
      isLocked: boolean;
      participantLimit: number;
      controlPermission: ControlPermission;
    }) => {
      const res = await fetch('/api/rooms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_SETTINGS',
          roomCode,
          settings,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.room) setRoom(data.room);
        addToast({
          title: 'Room settings updated',
          variant: 'success',
        });
      }
    },
    [addToast, roomCode]
  );

  const handleEndRoom = useCallback(async () => {
    await fetch('/api/rooms', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'END_ROOM',
        roomCode,
        userId: user?.id,
      }),
    });
    router.push('/dashboard');
  }, [roomCode, router, user?.id]);

  const handleCopyInvite = () => {
    const inviteUrl = `${window.location.origin}/room?code=${encodeURIComponent(roomCode)}`;
    navigator.clipboard?.writeText(inviteUrl).catch(() => {});
    setCopiedInvite(true);
    addToast({
      title: 'Invitation Link Copied!',
      description: `Share ${inviteUrl} or code ${roomCode} with friends.`,
      variant: 'success',
    });
    setTimeout(() => setCopiedInvite(false), 2500);
  };

  // Password gate screen
  if (requiresPassword) {
    return (
      <div className="min-h-screen bg-[#07080D] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-[#0D0F18] border border-white/10 p-6 shadow-vybe-lg space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vybe-accent/20 text-vybe-accentLight">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">
                Password Protected Watch Party
              </h1>
              <p className="text-xs text-slate-400">
                Enter the password for Room <span className="font-mono">{roomCode}</span>
              </p>
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              joinAndHydrateRoom(passwordInput);
            }}
            className="space-y-3"
          >
            <input
              type="password"
              required
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Enter room password..."
              className="w-full rounded-xl bg-[#07080D] border border-white/10 px-3.5 py-2.5 text-sm text-white focus:border-vybe-accent focus:outline-none"
            />
            <div className="flex items-center justify-between gap-2">
              <GlowButton
                variant="secondary"
                onClick={() => router.push('/dashboard')}
              >
                Back to Dashboard
              </GlowButton>
              <GlowButton type="submit">Unlock Room</GlowButton>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Loading state
  if (loadingRoom) {
    return (
      <div className="min-h-screen bg-[#07080D] flex flex-col items-center justify-center p-6">
        <div className="h-12 w-12 rounded-2xl bg-vybe-accent/20 border border-vybe-accent/40 flex items-center justify-center animate-pulse">
          <Tv className="h-6 w-6 text-vybe-accentLight" />
        </div>
        <div className="mt-4 text-sm font-bold text-white">
          Synchronizing Theater Room {roomCode}...
        </div>
        <div className="mt-1 text-xs text-slate-400">
          Connecting low-latency playback clock & realtime reaction bus
        </div>
      </div>
    );
  }

  // Error or Kicked state
  if (roomError || !room || memberStatus === 'kicked') {
    return (
      <div className="min-h-screen bg-[#07080D] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl bg-[#0D0F18] border border-white/10 p-6 text-center space-y-4">
          <AlertTriangle className="h-10 w-10 text-rose-400 mx-auto" />
          <h1 className="text-lg font-bold text-white">
            {memberStatus === 'kicked'
              ? 'Removed from Watch Room'
              : 'Unable to Enter Room'}
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            {memberStatus === 'kicked'
              ? 'The host has removed you from this watch party session.'
              : roomError || 'This room does not exist or has ended.'}
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <GlowButton
              variant="secondary"
              onClick={() => router.push('/dashboard')}
            >
              Return to Dashboard
            </GlowButton>
            <GlowButton
              variant="primary"
              onClick={() => router.push('/room/VYB-4K1')}
            >
              Join Featured Room (VYB-4K1)
            </GlowButton>
          </div>
        </div>
      </div>
    );
  }

  // Waiting Room Gate
  if (memberStatus === 'waiting' && !isHost) {
    return (
      <div className="min-h-screen bg-[#07080D] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl bg-[#0D0F18] border border-white/10 p-7 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-300">
            <Shield className="h-6 w-6 animate-pulse" />
          </div>
          <h1 className="text-lg font-bold text-white">
            In Waiting Room for {room.title}
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            The host (<strong>{room.hostName}</strong>) has enabled the waiting room. You will automatically enter the theater as soon as the host approves your request.
          </p>
          <GlowButton
            variant="secondary"
            onClick={() => router.push('/dashboard')}
          >
            Leave Waiting Room
          </GlowButton>
        </div>
      </div>
    );
  }

  const joinedParticipants = room.participants.filter((p) => p.status === 'joined');
  const waitingParticipants = room.participants.filter((p) => p.status === 'waiting');
  const isOutOfSync =
    Math.abs(localDriftSec) > (user?.preferences?.autoSyncThresholdSec || 2.0);

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-[#07080D] text-slate-100">
      {/* ==================================================================== */}
      {/* TOP THEATER HEADER BAR (SINGLE COMPACT ROW ON MOBILE & DESKTOP)      */}
      {/* ==================================================================== */}
      <header className="flex items-center justify-between gap-2 border-b border-white/[0.1] bg-[#0D0F18]/90 backdrop-blur-2xl px-3 sm:px-4 py-2 shrink-0 z-30">
        {/* Left: Navigation, Room Info & Platform Pill */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-full vybe-glass-pill hover:bg-white/[0.12] px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:text-white transition shrink-0"
            title="Return to Lobby"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Lobby</span>
          </Link>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-xs sm:text-base font-extrabold text-white truncate max-w-[130px] sm:max-w-xs">
                {room.title}
              </h1>

              {/* Platform Indicator */}
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider border shrink-0 bg-[#E50914]/25 border-[#E50914]/50 text-rose-200">
                <Tv className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                <span className="hidden xs:inline">netflix</span>
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400">
              <span>Host: {room.hostName}</span>
              <span>•</span>
              <span className="font-medium text-vybe-accentLight">{room.code}</span>
            </div>
          </div>
        </div>

        {/* Right: Sync Status, Platform Toggle, Invite Friends & Settings */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Connection & Drift Indicator */}
          {connectionHealth === 'reconnecting' ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/40 px-2.5 py-1 text-[10px] font-semibold text-amber-300">
              <RefreshCw className="h-3 w-3 animate-spin" />
              <span className="hidden sm:inline">Reconnecting</span>
            </span>
          ) : isOutOfSync ? (
            <button
              type="button"
              onClick={handleRequestResync}
              className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 px-2.5 py-1 text-[10px] font-semibold text-amber-200 transition"
              title="Click to resync immediately"
            >
              <AlertTriangle className="h-3 w-3 text-amber-400" />
              <span>Resync</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRequestResync}
              className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 text-[11px] font-medium text-emerald-300 transition"
              title="Synchronized with authoritative room playback"
            >
              <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
              <span>In Sync</span>
            </button>
          )}

          {/* Copy Invite Link Pill Button */}
          <button
            type="button"
            onClick={handleCopyInvite}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-b from-[#8374FE] to-[#5645E8] hover:brightness-110 px-3 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-bold text-white shadow-[0_6px_20px_-4px_rgba(109,93,251,0.6),inset_0_1px_0_0_rgba(255,255,255,0.35)] transition"
          >
            {copiedInvite ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" />
                <span>{room.code}</span>
              </>
            )}
          </button>

          {/* Profile Settings Trigger */}
          <button
            type="button"
            onClick={() => setProfileModalOpen(true)}
            className="rounded-full vybe-glass-pill hover:bg-white/[0.12] p-1.5 text-slate-300 hover:text-white transition"
            title="Profile & Preferences"
          >
            <Sparkles className="h-3.5 w-3.5 text-vybe-accentLight" />
          </button>

          {/* Room Management Settings Trigger */}
          {isModerator && (
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              aria-label="Room settings"
              className="rounded-full vybe-glass-pill hover:bg-white/[0.12] p-1.5 text-slate-300 hover:text-white transition"
              title="Room Settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* ==================================================================== */}
      {/* MAIN THEATER WORKSPACE (CLEAN MOBILE STACK / DESKTOP SPLIT)          */}
      {/* ==================================================================== */}
      <div className="relative flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* Top on Mobile (shrink-0) / Left Center Stage on Desktop (lg:flex-1) */}
        <div className="relative w-full lg:flex-1 flex flex-col shrink-0 lg:shrink min-w-0 lg:min-h-0 bg-[#05060A]">
          <div
            className="relative w-full lg:flex-1 flex flex-col overflow-hidden"
            onMouseEnter={() => setIsVideoHovered(true)}
            onMouseLeave={() => setIsVideoHovered(false)}
          >
            <NetflixCompanionDeck
              roomCode={room.code}
              watchId={room.playback.netflixWatchId || null}
              videoTitle={room.playback.videoTitle || null}
              posterUrl={room.playback.videoThumbnail}
              authoritativeIsPlaying={room.playback.isPlaying}
              authoritativeTime={room.playback.currentTime}
              authoritativeBuffering={Boolean(room.playback.isBuffering)}
              duration={room.playback.duration}
              canControlPlayback={canControlPlayback}
              onPlay={handleCompanionPlay}
              onPause={handleCompanionPause}
              onSeek={handleCompanionSeek}
              onRequestResync={handleRequestResync}
              onSwitchTitle={handleDirectSwitchMedia}
            />

            {/* Animated Floating Reactions Layer */}
            <FloatingReactionsLayer
              reactions={floatingReactions}
              onTriggerReaction={handleTriggerReaction}
              onRemoveReaction={(id) =>
                setFloatingReactions((prev) => prev.filter((r) => r.id !== id))
              }
              reducedMotion={user?.preferences?.reducedMotion}
              isVideoHovered={false}
            />

            {/* Translucent Floating Chat Mode Overlay (Desktop) */}
            {isFloatingChat && (
              <motion.div
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                className="absolute top-3 right-3 bottom-16 z-30 w-80 sm:w-96 rounded-2xl bg-[#0D0F18]/85 backdrop-blur-xl border border-white/15 shadow-vybe-lg overflow-hidden flex flex-col"
              >
                <LiveChatPanel
                  messages={messages}
                  currentUserId={user?.id || 'guest'}
                  isChatMuted={Boolean(currentParticipant?.isChatMuted)}
                  isFloatingMode={true}
                  onToggleFloatingMode={() => setIsFloatingChat(false)}
                  onSendMessage={handleSendChatMessage}
                  onToggleMessageReaction={handleToggleMessageReaction}
                  onQuickSceneReaction={handleTriggerReaction}
                />
              </motion.div>
            )}
          </div>

          {/* Single Slim Reaction + Voice/Camera Strip Under Video */}
          <div className="border-t border-white/[0.08] bg-[#07080D] px-3 py-1.5 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar">
              {VYBE_REACTIONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleTriggerReaction(r)}
                  title={`${r.label} (${r.shortcut})`}
                  aria-label={`Launch ${r.label} reaction`}
                  className="flex h-7 w-7 sm:h-8 sm:w-auto sm:px-2.5 items-center justify-center gap-1 rounded-full vybe-glass-pill hover:bg-vybe-accent/30 hover:border-vybe-accent transition-all active:scale-90 shrink-0"
                >
                  <span className="text-sm sm:text-base leading-none">{r.emoji}</span>
                  <span className="hidden xl:inline text-[11px] font-medium text-slate-200">
                    {r.label}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {isFloatingChat && (
                <button
                  type="button"
                  onClick={() => setIsFloatingChat(false)}
                  className="rounded-full vybe-glass-pill px-3 py-1 text-[11px] font-semibold text-vybe-accentLight hover:text-white"
                >
                  Panel
                </button>
              )}

              <VoiceVideoDock
                roomCode={room.code}
                currentUserId={user?.id || 'guest'}
                currentUserName={user?.displayName || 'Viewer'}
                participants={room.participants}
                onMediaStateChange={(mediaState) => {
                  if (!user) return;
                  publishRealtimeEvent({
                    type: 'PARTICIPANT_HEARTBEAT',
                    roomCode,
                    participant: {
                      userId: user.id,
                      ...mediaState,
                    },
                  });
                }}
              />
            </div>
          </div>
        </div>

        {/* ================================================================== */}
        {/* BOTTOM ON MOBILE (flex-1 min-h-0) / RIGHT PANEL ON DESKTOP         */}
        {/* ================================================================== */}
        {!isFloatingChat && (
          <aside className="flex-1 min-h-0 w-full lg:w-[380px] xl:w-[410px] lg:h-full lg:flex-none border-t lg:border-t-0 lg:border-l border-white/[0.08] bg-[#0A0C14] flex flex-col overflow-hidden">
            {/* Sidebar Navigation Tabs */}
            <div className="grid grid-cols-3 border-b border-white/[0.08] bg-[#0D0F18] p-1 gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className={`flex items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-bold transition ${
                  activeTab === 'chat'
                    ? 'bg-[#161A2B] text-white border border-white/10 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5 text-vybe-accentLight" />
                <span>Chat</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('queue')}
                className={`flex items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-bold transition ${
                  activeTab === 'queue'
                    ? 'bg-[#161A2B] text-white border border-white/10 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ListVideo className="h-3.5 w-3.5 text-vybe-accentLight" />
                <span>Queue ({room.queue.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('participants')}
                className={`relative flex items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-bold transition ${
                  activeTab === 'participants'
                    ? 'bg-[#161A2B] text-white border border-white/10 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="h-3.5 w-3.5 text-emerald-400" />
                <span>Viewers ({joinedParticipants.length})</span>
                {waitingParticipants.length > 0 && isModerator && (
                  <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-black">
                    {waitingParticipants.length}
                  </span>
                )}
              </button>
            </div>

            {/* Active Tab Body */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {activeTab === 'chat' && (
                <LiveChatPanel
                  messages={messages}
                  currentUserId={user?.id || 'guest'}
                  isChatMuted={Boolean(currentParticipant?.isChatMuted)}
                  isFloatingMode={false}
                  onToggleFloatingMode={() => setIsFloatingChat(true)}
                  onSendMessage={handleSendChatMessage}
                  onToggleMessageReaction={handleToggleMessageReaction}
                  onQuickSceneReaction={handleTriggerReaction}
                />
              )}

              {activeTab === 'queue' && (
                <WatchQueuePanel
                  roomId={room.id}
                  queue={room.queue}
                  currentUserId={user?.id || 'guest'}
                  currentUserName={user?.displayName || 'Viewer'}
                  canControlPlayback={canControlPlayback}
                  onAddQueueItem={(item: QueueItem) =>
                    executeQueueAction({ queueOp: 'ADD', item })
                  }
                  onVoteQueueItem={(itemId, direction) =>
                    executeQueueAction({
                      queueOp: 'VOTE',
                      itemId,
                      direction,
                    })
                  }
                  onMoveQueueItem={(itemId, dir) =>
                    executeQueueAction({ queueOp: 'MOVE', itemId, dir })
                  }
                  onRemoveQueueItem={(itemId) =>
                    executeQueueAction({ queueOp: 'REMOVE', itemId })
                  }
                  onPlayQueueItemNow={(itemId) =>
                    executeQueueAction({ queueOp: 'PLAY_ITEM', itemId })
                  }
                  onDirectSwitchMedia={(videoId, videoTitle, videoThumbnail) =>
                    handleDirectSwitchMedia(videoId, videoTitle, videoThumbnail)
                  }
                />
              )}

              {activeTab === 'participants' && (
                <div className="flex flex-col h-full overflow-y-auto p-3.5 space-y-4">
                  {/* Share Room Card */}
                  <div className="rounded-xl bg-[#0D0F18] border border-white/10 p-3 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-slate-400">
                        Room Invite Code
                      </div>
                      <div className="font-mono text-sm font-bold text-white">
                        {room.code}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyInvite}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#161A2B] hover:bg-vybe-accent border border-white/10 px-3 py-1.5 text-xs font-semibold text-white transition"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Link</span>
                    </button>
                  </div>

                  {/* Waiting Room Requests (visible to Host/Co-Host) */}
                  {waitingParticipants.length > 0 && isModerator && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5" />
                        <span>Waiting Room Requests ({waitingParticipants.length})</span>
                      </div>
                      {waitingParticipants.map((wp) => (
                        <div
                          key={wp.userId}
                          className="flex items-center justify-between rounded-xl bg-amber-500/10 border border-amber-500/30 p-2.5"
                        >
                          <div className="flex items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={wp.avatarUrl}
                              alt={wp.displayName}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                            <div>
                              <div className="text-xs font-bold text-white">
                                {wp.displayName}
                              </div>
                              <div className="text-[10px] text-amber-200">
                                Knocking to join
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                handleManageParticipant(
                                  wp.userId,
                                  'APPROVE_WAITING'
                                )
                              }
                              className="rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 px-2.5 py-1 text-xs font-semibold text-emerald-300"
                            >
                              Admit
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleManageParticipant(wp.userId, 'KICK')
                              }
                              className="rounded-lg bg-rose-500/20 hover:bg-rose-500/30 px-2 py-1 text-xs font-semibold text-rose-300"
                            >
                              Deny
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Active Participants List */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-400">
                      In Theater ({joinedParticipants.length}/{room.participantLimit})
                    </div>

                    {joinedParticipants.map((p) => {
                      const isTargetHost = p.role === 'host';
                      const driftOk = Math.abs(p.syncDrift || 0) <= 2.5;

                      return (
                        <div
                          key={p.userId}
                          className="rounded-xl bg-[#0D0F18] border border-white/10 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={p.avatarUrl}
                                alt={p.displayName}
                                className="h-9 w-9 rounded-full object-cover shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-white truncate">
                                    {p.displayName}
                                  </span>
                                  <span
                                    className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                                      p.role === 'host'
                                        ? 'bg-vybe-accent/25 text-vybe-accentLight border border-vybe-accent/40'
                                        : p.role === 'cohost'
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : 'bg-white/10 text-slate-300'
                                    }`}
                                  >
                                    {p.role}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                  <span
                                    className={
                                      driftOk ? 'text-emerald-400' : 'text-amber-400'
                                    }
                                  >
                                    {driftOk
                                      ? `Synced (±${Math.abs(p.syncDrift || 0).toFixed(1)}s)`
                                      : `Drift ${p.syncDrift > 0 ? '+' : ''}${p.syncDrift}s`}
                                  </span>
                                  <span>•</span>
                                  <span className="font-mono">
                                    @{formatTimestamp(p.reportedTime || 0)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Host & Co-Host Moderation Controls */}
                          {isModerator && !isTargetHost && p.userId !== user?.id && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/[0.06]">
                              <button
                                type="button"
                                onClick={() =>
                                  handleManageParticipant(
                                    p.userId,
                                    'TOGGLE_CHAT_MUTE'
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded-lg bg-[#161A2B] hover:bg-white/10 border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-300"
                              >
                                {p.isChatMuted ? (
                                  <>
                                    <Volume2 className="h-3 w-3 text-emerald-400" />
                                    <span>Unmute Chat</span>
                                  </>
                                ) : (
                                  <>
                                    <VolumeX className="h-3 w-3 text-amber-400" />
                                    <span>Mute Chat</span>
                                  </>
                                )}
                              </button>

                              {isHost && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleManageParticipant(
                                        p.userId,
                                        'TOGGLE_COHOST'
                                      )
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg bg-[#161A2B] hover:bg-white/10 border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-300"
                                  >
                                    <UserCheck className="h-3 w-3 text-vybe-accentLight" />
                                    <span>
                                      {p.role === 'cohost'
                                        ? 'Remove Co-Host'
                                        : 'Make Co-Host'}
                                    </span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleManageParticipant(
                                        p.userId,
                                        'TRANSFER_HOST'
                                      )
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg bg-[#161A2B] hover:bg-vybe-accent/30 border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-300"
                                  >
                                    <Crown className="h-3 w-3 text-amber-400" />
                                    <span>Transfer Host</span>
                                  </button>
                                </>
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  handleManageParticipant(p.userId, 'KICK')
                                }
                                className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/30 px-2 py-1 text-[10px] font-semibold text-rose-300 ml-auto"
                              >
                                <UserX className="h-3 w-3" />
                                <span>Kick</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Room Management Settings Modal */}
      <RoomSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        room={room}
        isHost={isHost}
        onSaveSettings={handleSaveRoomSettings}
        onEndRoom={handleEndRoom}
      />
    </div>
  );
}
