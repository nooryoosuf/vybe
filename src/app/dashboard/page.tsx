'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Plus,
  Users,
  Youtube,
  Tv,
  Play,
  Bookmark,
  Mail,
  Activity,
  Lock,
  Globe,
  Check,
  X,
  ArrowRight,
  Sparkles,
  Radio,
  Send,
  Sliders,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import {
  AnimatedAvatarStack,
  CinemaSpotlight,
  GlowButton,
} from '@/components/ui/AceternityPrimitives';
import { AsciiWaveCanvas } from '@/components/ui/AsciiBackdrop';
import { CreateRoomModal } from '@/components/modals/CreateRoomModal';
import { useVybe } from '@/context/VybeContext';
import {
  PlatformType,
  RoomInvitation,
  SavedWatchlist,
  UserProfile,
  WatchRoom,
} from '@/types/vybe';
import {
  extractNetflixWatchId,
  extractYouTubeId,
  fetchYouTubeMetadata,
  getLocalRoomsMap,
  resolveNetflixMetadata,
} from '@/lib/utils';

export default function DashboardPage() {
  const router = useRouter();
  const {
    user,
    setAuthModalOpen,
    setProfileModalOpen,
    addToast,
  } = useVybe();

  const [rooms, setRooms] = useState<WatchRoom[]>([]);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [watchlists, setWatchlists] = useState<SavedWatchlist[]>([]);
  const [invitations, setInvitations] = useState<RoomInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [createPreset, setCreatePreset] = useState<{
    platform: PlatformType;
    videoId?: string;
    videoTitle?: string;
  }>({ platform: 'youtube' });

  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [newWatchlistItemInput, setNewWatchlistItemInput] = useState('');
  const [newWatchlistPlatform, setNewWatchlistPlatform] =
    useState<PlatformType>('youtube');
  const [addingToWatchlist, setAddingToWatchlist] = useState(false);

  const [inviteEmailInput, setInviteEmailInput] = useState('');
  const [inviteRoomCode, setInviteRoomCode] = useState('VYB-4K1');

  const fetchDashboardState = useCallback(async () => {
    const localMap = getLocalRoomsMap();
    try {
      const uid = user?.id || 'default';
      const res = await fetch(`/api/state?userId=${encodeURIComponent(uid)}`);
      if (res.ok) {
        const data = await res.json();
        const serverRooms: WatchRoom[] = data.rooms || [];
        const mergedMap: Record<string, WatchRoom> = { ...localMap };
        for (const r of serverRooms) {
          mergedMap[r.code.toUpperCase()] = r;
        }
        setRooms(Object.values(mergedMap).filter((r) => r.isActive));
        setFriends(data.users || []);
        setWatchlists(data.watchlists || []);
        setInvitations(data.invitations || []);
        return;
      }
    } catch {
      // Fallback to local rooms cache
    } finally {
      setLoading(false);
    }
    setRooms(Object.values(localMap).filter((r) => r.isActive));
  }, [user?.id]);

  useEffect(() => {
    fetchDashboardState();
    const interval = setInterval(fetchDashboardState, 8000);
    return () => clearInterval(interval);
  }, [fetchDashboardState]);

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = joinCodeInput.trim();
    if (!raw) {
      addToast({
        title: 'Enter a room code',
        description: 'Try VYB-4K1 for YouTube or NFX-808 for Netflix.',
        variant: 'warning',
      });
      return;
    }
    const codeMatch = raw.match(/\/room\/([A-Za-z0-9-]+)/);
    const code = (codeMatch ? codeMatch[1] : raw).toUpperCase();
    router.push(`/room/${code}`);
  };

  const handleAddWatchlistItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWatchlistItemInput.trim()) return;
    setAddingToWatchlist(true);

    try {
      const activeList: SavedWatchlist = watchlists[0] || {
        id: `wl-${Date.now()}`,
        ownerId: user?.id || 'default',
        title: 'Weekend Sci-Fi & Animation Anthology',
        description: 'Saved titles ready to launch into a watch party.',
        items: [],
        createdAt: new Date().toISOString(),
      };

      if (newWatchlistPlatform === 'youtube') {
        const ytId = extractYouTubeId(newWatchlistItemInput);
        if (!ytId) {
          addToast({
            title: 'Invalid YouTube URL',
            description: 'Paste a valid YouTube link or 11-character video ID.',
            variant: 'error',
          });
          return;
        }
        const meta = await fetchYouTubeMetadata(ytId);
        activeList.items = [
          {
            id: `wli-${Date.now()}`,
            platform: 'youtube',
            videoId: ytId,
            title: meta.title,
            thumbnailUrl: meta.thumbnailUrl,
            durationLabel: '4K HD',
            addedAt: new Date().toISOString(),
          },
          ...activeList.items,
        ];
      } else {
        const nfId = extractNetflixWatchId(newWatchlistItemInput);
        if (!nfId) {
          addToast({
            title: 'Invalid Netflix Watch ID',
            description: 'Enter a numeric Netflix title ID (e.g. 80057281).',
            variant: 'error',
          });
          return;
        }
        const nfMeta = resolveNetflixMetadata(nfId);
        activeList.items = [
          {
            id: `wli-${Date.now()}`,
            platform: 'netflix',
            videoId: nfId,
            title: nfMeta.title,
            thumbnailUrl: nfMeta.posterUrl,
            durationLabel: nfMeta.durationLabel,
            addedAt: new Date().toISOString(),
          },
          ...activeList.items,
        ];
      }

      setWatchlists([activeList]);
      setNewWatchlistItemInput('');
      addToast({
        title: 'Added to Watchlist',
        description: 'You can launch a watch party directly from any saved item.',
        variant: 'success',
      });

      await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SAVE_WATCHLIST',
          userId: user?.id || 'default',
          watchlist: activeList,
        }),
      }).catch(() => {});
    } finally {
      setAddingToWatchlist(false);
    }
  };

  const handleRespondInvitation = async (
    inv: RoomInvitation,
    status: 'accepted' | 'declined'
  ) => {
    setInvitations((prev) =>
      prev.map((item) => (item.id === inv.id ? { ...item, status } : item))
    );
    fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'RESPOND_INVITATION',
        invitationId: inv.id,
        status,
      }),
    }).catch(() => {});

    if (status === 'accepted') {
      router.push(`/room/${inv.roomCode}`);
    } else {
      addToast({ title: 'Invitation declined' });
    }
  };

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmailInput.trim()) return;
    const targetRoom = rooms.find((r) => r.code === inviteRoomCode) || rooms[0];
    if (!targetRoom) return;

    const newInv: RoomInvitation = {
      id: `inv-${Date.now()}`,
      roomId: targetRoom.id,
      roomCode: targetRoom.code,
      roomTitle: targetRoom.title,
      platform: targetRoom.platform,
      senderId: user?.id || 'guest',
      senderName: user?.displayName || 'Cinema Host',
      senderAvatar:
        user?.avatarUrl ||
        'https://api.dicebear.com/9.x/glass/svg?seed=Host&backgroundColor=6d5dfb',
      recipientEmail: inviteEmailInput.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    setInvitations((prev) => [newInv, ...prev]);
    setInviteEmailInput('');
    addToast({
      title: 'Invitation Sent!',
      description: `Invited ${newInv.recipientEmail} to room ${targetRoom.code}.`,
      variant: 'success',
    });

    fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'CREATE_INVITATION',
        invitation: newInv,
      }),
    }).catch(() => {});
  };

  const recentActivity = [
    {
      id: 'act-1',
      text: 'Elena Vance started screening "Big Buck Bunny — 4K 60fps" in VYB-4K1',
      roomCode: 'VYB-4K1',
    },
    {
      id: 'act-2',
      text: 'Aria Thorne opened Netflix Room NFX-808 (Stranger Things)',
      roomCode: 'NFX-808',
    },
    {
      id: 'act-3',
      text: 'Marcus Chen upvoted "Sintel — Fantasy Short Film" to #1 in queue',
      roomCode: 'VYB-4K1',
    },
  ];

  return (
    <div className="relative min-h-screen bg-[#07080D] text-slate-100 overflow-x-hidden">
      <CinemaSpotlight withAscii={true} />
      <Navbar
        onQuickCreateRoom={() => {
          setCreatePreset({ platform: 'youtube' });
          setCreateModalOpen(true);
        }}
      />

      <main className="relative z-10 mx-auto max-w-7xl px-3.5 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-6 sm:space-y-8">
        {/* ================================================================== */}
        {/* 1. WELCOME BANNER                                                  */}
        {/* ================================================================== */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl vybe-glass p-4 sm:p-8"
        >
          <AsciiWaveCanvas density={26} opacity={0.35} />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              {user ? (
                <div className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={user.avatarUrl}
                    alt={user.displayName}
                    className="h-12 w-12 sm:h-14 sm:w-14 rounded-full object-cover ring-2 ring-vybe-accent/70 shadow-vybe-accent"
                  />
                  <span
                    className="absolute bottom-0 right-0 h-3 w-3 sm:h-3.5 sm:w-3.5 rounded-full ring-2 ring-[#131624]"
                    style={{
                      backgroundColor:
                        user.presenceStatus === 'watching'
                          ? '#6D5DFB'
                          : user.presenceStatus === 'online'
                          ? '#10B981'
                          : '#F59E0B',
                    }}
                  />
                </div>
              ) : (
                <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-full vybe-glass-pill text-vybe-accentLight">
                  <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-xl sm:text-3xl font-extrabold text-white tracking-tight truncate">
                    {user
                      ? `Welcome back, ${user.displayName}`
                      : 'Welcome to VYBE'}
                  </h1>
                  <span className="inline-flex items-center gap-1.5 rounded-full vybe-glass-pill px-3 py-0.5 text-xs font-medium text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{rooms.length} Active Rooms</span>
                  </span>
                </div>
                <p className="mt-1 text-xs sm:text-sm text-slate-300/90 line-clamp-2">
                  {user
                    ? user.bio || 'Host a synchronized watch party or join friends.'
                    : 'Sign in or continue as a guest to host rooms, save watchlists, and react in real time.'}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row w-full lg:w-auto items-stretch sm:items-center gap-2.5 shrink-0">
              {user ? (
                <GlowButton
                  variant="secondary"
                  onClick={() => setProfileModalOpen(true)}
                  className="w-full sm:w-auto"
                >
                  <Sliders className="h-4 w-4 text-vybe-accentLight shrink-0" />
                  <span>Customize Profile</span>
                </GlowButton>
              ) : (
                <GlowButton
                  variant="secondary"
                  onClick={() => setAuthModalOpen(true)}
                  className="w-full sm:w-auto"
                >
                  <span>Sign In / Guest</span>
                </GlowButton>
              )}

              <GlowButton
                variant="primary"
                onClick={() => {
                  setCreatePreset({ platform: 'youtube' });
                  setCreateModalOpen(true);
                }}
                className="w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span>Create Watch Party</span>
              </GlowButton>
            </div>
          </div>

          {/* Create & Join Quick Cards */}
          <div className="relative z-10 mt-5 sm:mt-7 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 pt-5 sm:pt-6 border-t border-white/10">
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  setCreatePreset({ platform: 'youtube' });
                  setCreateModalOpen(true);
                }}
                className="group flex items-center justify-between gap-2 rounded-2xl sm:rounded-full vybe-glass-pill hover:bg-white/[0.1] hover:border-vybe-accent px-4 sm:px-5 py-3 text-left transition-all min-w-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    <Youtube className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-white group-hover:text-vybe-accentLight transition-colors truncate">
                      Host YouTube Party
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      Paste any YouTube link & sync
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setCreatePreset({ platform: 'netflix' });
                  setCreateModalOpen(true);
                }}
                className="group flex items-center justify-between gap-2 rounded-2xl sm:rounded-full vybe-glass-pill hover:bg-white/[0.1] hover:border-rose-500/60 px-4 sm:px-5 py-3 text-left transition-all min-w-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-[#E50914]/25 text-rose-300 border border-[#E50914]/50">
                    <Tv className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-white group-hover:text-rose-300 transition-colors truncate">
                      Host Netflix Party
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      Sync via Chrome Extension
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            </div>

            {/* Join a Watch Party by Code Pill Bar */}
            <form
              onSubmit={handleJoinByCode}
              className="lg:col-span-5 flex items-center gap-2 rounded-full vybe-glass-pill p-1.5 min-w-0"
            >
              <input
                type="text"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value)}
                placeholder="Enter Room Code (e.g. VYB-4K1)"
                className="flex-1 min-w-0 bg-transparent px-3.5 py-2 text-xs text-white placeholder-slate-400 focus:outline-none"
              />
              <GlowButton type="submit" className="py-2 px-4 sm:px-5 text-xs shrink-0">
                <span>Join</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
              </GlowButton>
            </form>
          </div>
        </motion.section>

        {/* ================================================================== */}
        {/* 2. LIVE & RECENTLY JOINED ROOMS + FRIENDS CURRENTLY WATCHING       */}
        {/* ================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Active & Recently Joined Rooms (8 cols) */}
          <div className="lg:col-span-8 space-y-4 min-w-0">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Radio className="h-4 w-4 text-vybe-accentLight shrink-0" />
                <span>Recently Joined & Active Rooms</span>
              </h2>
              <p className="text-xs text-slate-400">
                Jump directly into an active watch party
              </p>
            </div>

            {loading && rooms.length === 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2].map((n) => (
                  <div
                    key={n}
                    className="h-64 rounded-3xl vybe-glass animate-pulse p-5"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rooms.map((room) => {
                  const activeMembers = room.participants.filter(
                    (p) => p.status === 'joined'
                  );
                  return (
                    <motion.div
                      key={room.id}
                      whileHover={{ y: -3 }}
                      className="group relative min-w-0 flex flex-col justify-between overflow-hidden rounded-3xl vybe-glass hover:border-vybe-accent/60 transition-all"
                    >
                      {/* Thumbnail Header */}
                      <div className="relative h-36 sm:h-40 w-full bg-[#07080D] overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            room.playback.videoThumbnail ||
                            `https://i.ytimg.com/vi/${room.playback.videoId}/hqdefault.jpg`
                          }
                          alt={room.playback.videoTitle}
                          className="h-full w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0D0F18] via-[#0D0F18]/30 to-transparent" />

                        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border backdrop-blur-md ${
                              room.platform === 'youtube'
                                ? 'bg-rose-500/25 border-rose-500/40 text-rose-200'
                                : 'bg-[#E50914]/30 border-[#E50914]/50 text-rose-200'
                            }`}
                          >
                            {room.platform === 'youtube' ? (
                              <Youtube className="h-3 w-3" />
                            ) : (
                              <Tv className="h-3 w-3" />
                            )}
                            <span>{room.platform}</span>
                          </span>

                          <span className="inline-flex items-center gap-1 rounded-full vybe-glass-pill px-2.5 py-0.5 text-[10px] font-medium text-slate-200">
                            {room.privacy === 'private' ? (
                              <Lock className="h-2.5 w-2.5 text-amber-400" />
                            ) : (
                              <Globe className="h-2.5 w-2.5 text-emerald-400" />
                            )}
                            <span>{room.code}</span>
                          </span>
                        </div>

                        <div className="absolute bottom-2.5 left-4 right-4 flex items-center justify-between">
                          <span className="text-xs font-semibold text-white truncate">
                            {room.playback.videoTitle}
                          </span>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
                        <div>
                          <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-vybe-accentLight transition-colors line-clamp-1">
                            {room.title}
                          </h3>
                          <p className="mt-1 text-xs text-slate-300/80 line-clamp-2">
                            {room.description}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/[0.08]">
                          <div className="flex items-center gap-2">
                            <AnimatedAvatarStack
                              maxVisible={3}
                              items={activeMembers.map((m) => ({
                                id: m.userId,
                                name: `${m.displayName} (${m.role})`,
                                subtitle: 'In Room',
                                image: m.avatarUrl,
                                statusColor: '#10B981',
                              }))}
                            />
                            <span className="text-[11px] text-slate-400">
                              {activeMembers.length}/{room.participantLimit}
                            </span>
                          </div>

                          <Link
                            href={`/room/${room.code}`}
                            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-b from-[#8374FE] to-[#5645E8] hover:brightness-110 px-4 py-2 text-xs font-bold text-white shadow-[0_6px_20px_-4px_rgba(109,93,251,0.6),inset_0_1px_0_0_rgba(255,255,255,0.35)] transition"
                          >
                            <Play className="h-3.5 w-3.5 fill-current" />
                            <span>Join Party</span>
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Friends Currently Watching (4 cols) */}
          <div className="lg:col-span-4 space-y-4 min-w-0">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Friends Currently Watching</span>
              </h2>
              <p className="text-xs text-slate-400">
                Friends active in watch parties right now
              </p>
            </div>

            <div className="rounded-3xl vybe-glass p-4 space-y-2.5">
              {friends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center justify-between gap-2 rounded-full vybe-glass-pill pl-2.5 pr-3 py-2 hover:border-white/25 transition-all min-w-0"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={friend.avatarUrl}
                        alt={friend.displayName}
                        className="h-8 w-8 sm:h-9 sm:w-9 rounded-full object-cover"
                      />
                      <span
                        className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-[#07080D]"
                        style={{
                          backgroundColor:
                            friend.presenceStatus === 'watching'
                              ? '#6D5DFB'
                              : friend.presenceStatus === 'online'
                              ? '#10B981'
                              : '#F59E0B',
                        }}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {friend.displayName}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {friend.currentRoomCode
                          ? `Watching in ${friend.currentRoomCode}`
                          : 'Online'}
                      </div>
                    </div>
                  </div>

                  {friend.currentRoomCode && (
                    <Link
                      href={`/room/${friend.currentRoomCode}`}
                      className="shrink-0 rounded-full bg-vybe-accent/25 hover:bg-vybe-accent border border-vybe-accent/50 px-3 py-1 text-[11px] font-bold text-white transition-colors"
                    >
                      Join
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ================================================================== */}
        {/* 3. SAVED WATCHLISTS + INVITATIONS & RECENT ACTIVITY                */}
        {/* ================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Saved Watchlists (7 cols) */}
          <div className="lg:col-span-7 min-w-0 rounded-3xl vybe-glass p-4 sm:p-6 space-y-5">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Bookmark className="h-4 w-4 text-vybe-accentLight shrink-0" />
                <span>Saved Watchlists</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Save YouTube videos or Netflix titles and launch a watch party anytime
              </p>
            </div>

            {/* Add to Watchlist Pill Form */}
            <form
              onSubmit={handleAddWatchlistItem}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
            >
              <select
                value={newWatchlistPlatform}
                onChange={(e) =>
                  setNewWatchlistPlatform(e.target.value as PlatformType)
                }
                className="rounded-full bg-[#0D0F18] border border-white/15 px-4 py-2.5 text-xs font-semibold text-white focus:border-vybe-accent focus:outline-none"
              >
                <option value="youtube">YouTube URL / ID</option>
                <option value="netflix">Netflix Title ID</option>
              </select>

              <input
                type="text"
                value={newWatchlistItemInput}
                onChange={(e) => setNewWatchlistItemInput(e.target.value)}
                placeholder={
                  newWatchlistPlatform === 'youtube'
                    ? 'Paste YouTube URL (e.g. https://youtu.be/eRsGyueVLvQ)'
                    : 'Enter Netflix Watch ID (e.g. 81040344)'
                }
                className="flex-1 min-w-0 rounded-full bg-white/[0.04] border border-white/15 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-vybe-accent focus:outline-none"
              />

              <GlowButton
                type="submit"
                disabled={addingToWatchlist}
                className="py-2.5 px-5 text-xs shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{addingToWatchlist ? 'Saving...' : 'Save Title'}</span>
              </GlowButton>
            </form>

            {/* Watchlist Items */}
            <div className="space-y-2.5">
              {(watchlists[0]?.items || []).map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-white/[0.03] border border-white/10 p-3 hover:border-white/20 transition-all min-w-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      className="h-12 w-20 rounded-xl object-cover shrink-0 bg-[#131624]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            item.platform === 'youtube'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-[#E50914]/25 text-rose-300'
                          }`}
                        >
                          {item.platform}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {item.durationLabel}
                        </span>
                      </div>
                      <div className="mt-1 text-xs font-bold text-white truncate">
                        {item.title}
                      </div>
                    </div>
                  </div>

                  <GlowButton
                    variant="secondary"
                    onClick={() => {
                      setCreatePreset({
                        platform: item.platform,
                        videoId: item.videoId,
                        videoTitle: item.title,
                      });
                      setCreateModalOpen(true);
                    }}
                    className="w-full sm:w-auto py-1.5 px-4 text-xs shrink-0"
                  >
                    <Play className="h-3 w-3" />
                    <span>Host Party</span>
                  </GlowButton>
                </div>
              ))}
            </div>
          </div>

          {/* Invitations & Recent Activity (5 cols) */}
          <div className="lg:col-span-5 space-y-6 min-w-0">
            {/* Room Invitations */}
            <div className="rounded-3xl vybe-glass p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Mail className="h-4 w-4 text-vybe-accentLight shrink-0" />
                  <span>Invitations</span>
                </h2>
                <span className="rounded-full bg-vybe-accent/20 border border-vybe-accent/40 px-3 py-0.5 text-[11px] font-bold text-vybe-accentLight shrink-0">
                  {invitations.filter((i) => i.status === 'pending').length} Pending
                </span>
              </div>

              <div className="space-y-2.5">
                {invitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="rounded-2xl bg-white/[0.03] border border-white/10 p-3.5 flex flex-wrap items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white truncate">
                        {inv.roomTitle}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        From <span className="text-slate-200">{inv.senderName}</span> •{' '}
                        <span className="text-vybe-accentLight">
                          {inv.roomCode}
                        </span>
                      </div>
                    </div>

                    {inv.status === 'pending' ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleRespondInvitation(inv, 'accepted')}
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Join</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRespondInvitation(inv, 'declined')}
                          className="rounded-full bg-white/5 hover:bg-rose-500/20 p-1.5 text-slate-400 hover:text-rose-300 transition"
                          aria-label="Decline invitation"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] font-medium capitalize text-slate-400">
                        {inv.status}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Send Invitation Pill Form */}
              <form
                onSubmit={handleSendInvitation}
                className="pt-3 border-t border-white/10 space-y-2"
              >
                <div className="text-xs font-semibold text-slate-300">
                  Invite a Friend
                </div>
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                  <select
                    value={inviteRoomCode}
                    onChange={(e) => setInviteRoomCode(e.target.value)}
                    className="rounded-full bg-[#0D0F18] border border-white/15 px-3 py-2 text-xs text-white shrink-0"
                  >
                    {rooms.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.code}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={inviteEmailInput}
                    onChange={(e) => setInviteEmailInput(e.target.value)}
                    placeholder="Friend's email or @username"
                    className="flex-1 min-w-0 rounded-full bg-white/[0.04] border border-white/15 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-vybe-accent focus:outline-none"
                  />
                  <GlowButton type="submit" className="py-2 px-3.5 text-xs shrink-0">
                    <Send className="h-3.5 w-3.5" />
                  </GlowButton>
                </div>
              </form>
            </div>

            {/* Recent Activity */}
            <div className="rounded-3xl vybe-glass p-4 sm:p-6 space-y-3.5">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Recent Activity</span>
              </h2>
              <div className="space-y-2.5">
                {recentActivity.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-start justify-between gap-3 rounded-2xl bg-white/[0.03] border border-white/10 p-3 text-xs"
                  >
                    <div className="text-slate-300 leading-relaxed min-w-0">
                      {act.text}
                    </div>
                    <Link
                      href={`/room/${act.roomCode}`}
                      className="shrink-0 rounded-full vybe-glass-pill px-2.5 py-0.5 text-[11px] font-medium text-vybe-accentLight hover:underline"
                    >
                      {act.roomCode}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <CreateRoomModal
        isOpen={isCreateModalOpen}
        onClose={() => setCreateModalOpen(false)}
        initialPlatform={createPreset.platform}
        initialVideoId={createPreset.videoId}
        initialVideoTitle={createPreset.videoTitle}
      />
    </div>
  );
}
