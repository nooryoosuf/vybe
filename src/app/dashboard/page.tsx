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
  Mail,
  Lock,
  Globe,
  Check,
  X,
  ArrowRight,
  Sparkles,
  Radio,
  Sliders,
  Film,
  UserPlus,
  UserMinus,
  AtSign,
  ThumbsUp,
  MessageSquarePlus,
  Trash2,
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
  MovieRequestItem,
  PlatformType,
  RoomInvitation,
  SiteMovieItem,
  UserProfile,
  WatchRoom,
} from '@/types/vybe';
import {
  buildClientRoomObject,
  extractNetflixWatchId,
  extractYouTubeId,
  fetchYouTubeMetadata,
  getLocalMovieRequests,
  getLocalRoomsMap,
  getLocalSiteMovies,
  resolveNetflixMetadata,
  saveLocalMovieRequests,
  saveLocalRoom,
  saveLocalSiteMovie,
} from '@/lib/utils';

export default function DashboardPage() {
  const router = useRouter();
  const {
    user,
    continueAsGuest,
    setAuthModalOpen,
    setProfileModalOpen,
    addFriend,
    removeFriend,
    addToast,
  } = useVybe();

  const [rooms, setRooms] = useState<WatchRoom[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<UserProfile[]>([]);
  const [siteMovies, setSiteMovies] = useState<SiteMovieItem[]>([]);
  const [movieRequests, setMovieRequests] = useState<MovieRequestItem[]>([]);
  const [invitations, setInvitations] = useState<RoomInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [createPreset, setCreatePreset] = useState<{
    platform: PlatformType;
    videoId?: string;
    videoTitle?: string;
  }>({ platform: 'youtube' });

  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [friendUsernameInput, setFriendUsernameInput] = useState('');
  const [addingFriend, setAddingFriend] = useState(false);

  // Add Movie to Site Library Modal/Drawer
  const [showAddMovieForm, setShowAddMovieForm] = useState(false);
  const [newMovieTitle, setNewMovieTitle] = useState('');
  const [newMovieGenre, setNewMovieGenre] = useState('Sci-Fi • Thriller');
  const [newMoviePlatform, setNewMoviePlatform] =
    useState<PlatformType>('youtube');
  const [newMovieUrl, setNewMovieUrl] = useState('');
  const [newMovieDirectStreamUrl, setNewMovieDirectStreamUrl] = useState('');
  const [addingMovie, setAddingMovie] = useState(false);
  const [fulfillingRequestId, setFulfillingRequestId] = useState<string | null>(null);
  const [launchingMovieId, setLaunchingMovieId] = useState<string | null>(null);

  // Request a Movie Form
  const [reqTitle, setReqTitle] = useState('');
  const [reqPlatform, setReqPlatform] = useState<PlatformType>('netflix');
  const [reqNote, setReqNote] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const fetchDashboardState = useCallback(async () => {
    const localMap = getLocalRoomsMap();
    const localMovies = getLocalSiteMovies();
    const localRequests = getLocalMovieRequests();
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
        setRegisteredUsers(data.users || []);
        setInvitations(data.invitations || []);

        const serverMovies: SiteMovieItem[] = data.siteMovies || [];
        const movieMap = new Map<string, SiteMovieItem>();
        for (const m of [...localMovies, ...serverMovies]) {
          movieMap.set(m.id, m);
        }
        setSiteMovies(Array.from(movieMap.values()));

        const serverReqs: MovieRequestItem[] = data.movieRequests || [];
        const reqMap = new Map<string, MovieRequestItem>();
        for (const r of [...localRequests, ...serverReqs]) {
          reqMap.set(r.id, r);
        }
        setMovieRequests(Array.from(reqMap.values()));
        return;
      }
    } catch {
      // Fallback to local cache
    } finally {
      setLoading(false);
    }
    setRooms(Object.values(localMap).filter((r) => r.isActive));
    setSiteMovies(localMovies);
    setMovieRequests(localRequests);
  }, [user?.id]);

  useEffect(() => {
    fetchDashboardState();
    const interval = setInterval(fetchDashboardState, 7000);
    return () => clearInterval(interval);
  }, [fetchDashboardState]);

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = joinCodeInput.trim();
    if (!raw) {
      addToast({
        title: 'Enter a room code',
        description: 'Paste a 6-character room code or invite link.',
        variant: 'warning',
      });
      return;
    }
    const queryMatch = raw.match(/[?&]code=([A-Za-z0-9-]+)/);
    const pathMatch = raw.match(/\/room\/([A-Za-z0-9-]+)/);
    const code = (queryMatch ? queryMatch[1] : pathMatch ? pathMatch[1] : raw).toUpperCase();
    router.push(`/room?code=${encodeURIComponent(code)}`);
  };

  // 1-Click Instant Watch Party Launch from any Ready-to-Play Movie Card
  const handleInstantLaunchMovie = async (movie: SiteMovieItem) => {
    setLaunchingMovieId(movie.id);
    try {
      let activeUser = user;
      if (!activeUser) {
        activeUser = await continueAsGuest('Host');
      }

      const payload = {
        title: `${movie.title} — Watch Party`,
        description: movie.description,
        hostId: activeUser.id,
        hostName: activeUser.displayName,
        hostUsername: activeUser.username,
        hostAvatar: activeUser.avatarUrl,
        isGuest: activeUser.isGuest,
        platform: movie.platform,
        privacy: 'public' as const,
        hasPassword: false,
        allowGuests: true,
        waitingRoomEnabled: false,
        participantLimit: 25,
        controlPermission: 'everyone' as const,
        videoId: movie.videoId,
        videoTitle: movie.title,
        videoThumbnail: movie.thumbnailUrl,
      };

      let createdRoom = buildClientRoomObject(payload);

      try {
        const res = await fetch('/api/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            code: createdRoom.code,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.room) {
            createdRoom = data.room as WatchRoom;
            saveLocalRoom(createdRoom);
          }
        }
      } catch {
        // Local room already saved
      }

      addToast({
        title: `Now Hosting: ${movie.title}`,
        description: `Room ${createdRoom.code} is ready — invite your friends!`,
        variant: 'success',
      });

      router.push(`/room?code=${encodeURIComponent(createdRoom.code)}`);
    } finally {
      setLaunchingMovieId(null);
    }
  };

  // Add a New Movie to the Site Library
  const handleAddMovieToSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMovieUrl.trim()) return;
    setAddingMovie(true);

    try {
      let videoId = '';
      let resolvedTitle = newMovieTitle.trim();
      let thumbnailUrl = '';
      let durationLabel = 'Full Movie';

      if (newMoviePlatform === 'youtube') {
        const ytId = extractYouTubeId(newMovieUrl);
        if (!ytId) {
          addToast({
            title: 'Invalid YouTube Link',
            description: 'Paste a valid YouTube video URL or 11-character ID.',
            variant: 'error',
          });
          return;
        }
        videoId = ytId;
        const meta = await fetchYouTubeMetadata(ytId);
        if (!resolvedTitle) resolvedTitle = meta.title;
        thumbnailUrl = meta.thumbnailUrl;
        durationLabel = 'YouTube HD';
      } else {
        const nfId = extractNetflixWatchId(newMovieUrl);
        if (!nfId) {
          addToast({
            title: 'Invalid Netflix Link or ID',
            description: 'Paste a netflix.com/watch/... link or numeric Watch ID.',
            variant: 'error',
          });
          return;
        }
        videoId = nfId;
        const nfMeta = resolveNetflixMetadata(nfId);
        if (!resolvedTitle) resolvedTitle = nfMeta.title;
        thumbnailUrl = nfMeta.posterUrl;
        durationLabel = 'Netflix';
      }

      const newMovie: SiteMovieItem = {
        id: `mov-custom-${Date.now()}`,
        title: resolvedTitle,
        genre: newMovieGenre.trim() || 'Movie Night',
        durationLabel,
        year: 'Added by ' + (user?.displayName || 'Friend'),
        platform: newMoviePlatform,
        videoId,
        directVideoUrl: newMovieDirectStreamUrl.trim() || undefined,
        thumbnailUrl,
        description: `Added to VYBE by ${user?.displayName || 'a friend'} — click Watch with Friends to launch a room!`,
        addedBy: user?.displayName || 'Friend',
      };

      if (newMovieDirectStreamUrl.trim() && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(
            `vybe_custom_stream_${videoId}`,
            newMovieDirectStreamUrl.trim()
          );
        } catch {
          // ignore
        }
      }

      const updatedLocal = saveLocalSiteMovie(newMovie);
      setSiteMovies(updatedLocal);

      await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADD_SITE_MOVIE',
          movie: newMovie,
        }),
      }).catch(() => {});

      setNewMovieTitle('');
      setNewMovieUrl('');
      setNewMovieDirectStreamUrl('');
      setShowAddMovieForm(false);

      if (fulfillingRequestId) {
        handleUpdateRequestStatus(fulfillingRequestId, 'added');
        setFulfillingRequestId(null);
      }

      addToast({
        title: `"${newMovie.title}" added to Movies!`,
        description: 'Anyone can now launch a watch party with it.',
        variant: 'success',
      });
    } finally {
      setAddingMovie(false);
    }
  };

  // Submit a Movie Request
  const handleCreateMovieRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqTitle.trim()) return;
    setSubmittingRequest(true);
    try {
      let activeUser = user;
      if (!activeUser) {
        activeUser = await continueAsGuest('Friend');
      }
      const newReq: MovieRequestItem = {
        id: `req-${Date.now()}`,
        title: reqTitle.trim(),
        platform: reqPlatform,
        note: reqNote.trim(),
        requestedById: activeUser.id,
        requestedByName: activeUser.displayName,
        requestedByUsername: activeUser.username,
        upvoterIds: [activeUser.id],
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      const updated = [newReq, ...movieRequests];
      setMovieRequests(updated);
      saveLocalMovieRequests(updated);

      await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_MOVIE_REQUEST',
          requestItem: newReq,
        }),
      }).catch(() => {});

      setReqTitle('');
      setReqNote('');
      addToast({
        title: 'Movie Requested!',
        description: `"${newReq.title}" is now on the request board.`,
        variant: 'success',
      });
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleVoteMovieRequest = async (requestId: string) => {
    const uid = user?.id || 'guest';
    const updated = movieRequests
      .map((r) => {
        if (r.id !== requestId) return r;
        const exists = r.upvoterIds.includes(uid);
        return {
          ...r,
          upvoterIds: exists
            ? r.upvoterIds.filter((id) => id !== uid)
            : [...r.upvoterIds, uid],
        };
      })
      .sort((a, b) => b.upvoterIds.length - a.upvoterIds.length);

    setMovieRequests(updated);
    saveLocalMovieRequests(updated);

    await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'VOTE_MOVIE_REQUEST',
        requestId,
        userId: uid,
      }),
    }).catch(() => {});
  };

  const handleUpdateRequestStatus = async (
    requestId: string,
    status: 'added' | 'delete'
  ) => {
    const updated =
      status === 'delete'
        ? movieRequests.filter((r) => r.id !== requestId)
        : movieRequests.map((r) =>
            r.id === requestId ? { ...r, status: 'added' as const } : r
          );

    setMovieRequests(updated);
    saveLocalMovieRequests(updated);

    await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'UPDATE_MOVIE_REQUEST_STATUS',
        requestId,
        status,
      }),
    }).catch(() => {});
  };

  const handleAddFriendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendUsernameInput.trim()) return;
    setAddingFriend(true);
    try {
      const ok = await addFriend(friendUsernameInput);
      if (ok) {
        setFriendUsernameInput('');
        await fetchDashboardState();
      }
    } finally {
      setAddingFriend(false);
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
      router.push(`/room?code=${encodeURIComponent(inv.roomCode)}`);
    } else {
      addToast({ title: 'Invitation declined' });
    }
  };

  const handleInviteFriendToRoom = async (friend: UserProfile) => {
    const activeRoom = rooms[0];
    if (!activeRoom) {
      addToast({
        title: 'Start a room first!',
        description: 'Click "Watch with Friends" on any movie below to create a room.',
        variant: 'warning',
      });
      return;
    }

    const newInv: RoomInvitation = {
      id: `inv-${Date.now()}`,
      roomId: activeRoom.id,
      roomCode: activeRoom.code,
      roomTitle: activeRoom.title,
      platform: activeRoom.platform,
      senderId: user?.id || 'host',
      senderName: user?.displayName || 'Host',
      senderAvatar: user?.avatarUrl || '',
      recipientId: friend.id,
      recipientEmail: friend.username,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    setInvitations((prev) => [newInv, ...prev]);
    await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'CREATE_INVITATION',
        invitation: newInv,
      }),
    }).catch(() => {});

    addToast({
      title: `Invited ${friend.displayName}!`,
      description: `Sent invite for room ${activeRoom.code}.`,
      variant: 'success',
    });
  };

  // Compute user's connected friends vs other registered users on the site
  const myFriendIds = new Set(user?.friendIds || []);
  const myFriends = registeredUsers.filter(
    (u) => u.id !== user?.id && myFriendIds.has(u.id)
  );
  const discoverUsers = registeredUsers.filter(
    (u) => u.id !== user?.id && !myFriendIds.has(u.id)
  );
  const pendingInvitations = invitations.filter((i) => i.status === 'pending');

  return (
    <div className="relative min-h-screen bg-[#07080D] text-slate-100 overflow-x-hidden">
      <CinemaSpotlight withAscii={true} />
      <Navbar
        onQuickCreateRoom={() => {
          setCreatePreset({ platform: 'youtube' });
          setCreateModalOpen(true);
        }}
      />

      <main className="relative z-10 mx-auto max-w-7xl px-3.5 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-8">
        {/* ================================================================== */}
        {/* 1. TOP LOBBY CARD (ACCOUNT, @USERNAME & QUICK JOIN)                */}
        {/* ================================================================== */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl vybe-glass p-4 sm:p-7"
        >
          <AsciiWaveCanvas density={26} opacity={0.32} />
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
                  <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-400 ring-2 ring-[#131624]" />
                </div>
              ) : (
                <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-full vybe-glass-pill text-vybe-accentLight">
                  <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-xl sm:text-3xl font-extrabold text-white tracking-tight truncate">
                    {user ? `Hey, ${user.displayName}` : 'VYBE Watch Lobby'}
                  </h1>
                  {user && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(`@${user.username}`).catch(() => {});
                        addToast({
                          title: `Copied @${user.username}`,
                          description: 'Share your @username with friends so they can add you!',
                          variant: 'success',
                        });
                      }}
                      className="inline-flex items-center gap-1 rounded-full vybe-glass-pill hover:border-vybe-accent px-3 py-0.5 text-xs font-semibold text-vybe-accentLight transition"
                      title="Click to copy your @username"
                    >
                      <AtSign className="h-3 w-3" />
                      <span>{user.username}</span>
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs sm:text-sm text-slate-300/90">
                  {user
                    ? `Share @${user.username} with friends to connect, or pick a movie below to start a watch party.`
                    : 'Create an account with a @username so your friends can add you and watch movies together.'}
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
                  <span>Edit Profile</span>
                </GlowButton>
              ) : (
                <GlowButton
                  variant="secondary"
                  onClick={() => setAuthModalOpen(true)}
                  className="w-full sm:w-auto"
                >
                  <UserPlus className="h-4 w-4 text-vybe-accentLight shrink-0" />
                  <span>Create Account / Sign In</span>
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
                <span>Create Custom Room</span>
              </GlowButton>
            </div>
          </div>

          {/* Join by Code Bar */}
          <div className="relative z-10 mt-5 pt-5 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-300">
              Have a friend&apos;s room code? Enter it here to jump straight into their party:
            </div>
            <form
              onSubmit={handleJoinByCode}
              className="flex items-center gap-2 rounded-full vybe-glass-pill p-1.5 min-w-0 sm:w-96"
            >
              <input
                type="text"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value)}
                placeholder="Enter Room Code (e.g. K7M-9P2)"
                className="flex-1 min-w-0 bg-transparent px-3.5 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none"
              />
              <GlowButton type="submit" className="py-1.5 px-4 text-xs shrink-0">
                <span>Join Room</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
              </GlowButton>
            </form>
          </div>
        </motion.section>

        {/* ================================================================== */}
        {/* 2. READY-TO-WATCH MOVIES ON THE SITE (1-CLICK START PARTY)         */}
        {/* ================================================================== */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <Film className="h-5 w-5 text-vybe-accentLight shrink-0" />
                <span>Movies Ready to Watch</span>
              </h2>
              <p className="text-xs text-slate-400">
                Click any movie to immediately launch a synchronized watch party room with it loaded
              </p>
            </div>

            <GlowButton
              variant="secondary"
              onClick={() => setShowAddMovieForm((v) => !v)}
              className="py-2 px-4 text-xs"
            >
              <Plus className="h-3.5 w-3.5 text-vybe-accentLight" />
              <span>{showAddMovieForm ? 'Close' : 'Add Movie to Site'}</span>
            </GlowButton>
          </div>

          {/* Collapsible "Add Movie to Site" Form */}
          {showAddMovieForm && (
            <motion.form
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleAddMovieToSite}
              className="rounded-3xl vybe-glass p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">
                  Add a Movie to the Shared Library
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddMovieForm(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Platform
                  </label>
                  <select
                    value={newMoviePlatform}
                    onChange={(e) =>
                      setNewMoviePlatform(e.target.value as PlatformType)
                    }
                    className="w-full rounded-full bg-[#0D0F18] border border-white/15 px-3.5 py-2.5 text-xs text-white focus:border-vybe-accent focus:outline-none"
                  >
                    <option value="youtube">YouTube Movie / Video</option>
                    <option value="netflix">Netflix / Custom File</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Movie Title (optional)
                  </label>
                  <input
                    type="text"
                    value={newMovieTitle}
                    onChange={(e) => setNewMovieTitle(e.target.value)}
                    placeholder="Auto-detected if blank"
                    className="w-full rounded-full bg-white/[0.04] border border-white/15 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-vybe-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Genre Tag
                  </label>
                  <input
                    type="text"
                    value={newMovieGenre}
                    onChange={(e) => setNewMovieGenre(e.target.value)}
                    placeholder="Sci-Fi • Action"
                    className="w-full rounded-full bg-white/[0.04] border border-white/15 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-vybe-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    {newMoviePlatform === 'youtube'
                      ? 'YouTube Link or ID'
                      : 'Netflix Link or Watch ID'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newMovieUrl}
                    onChange={(e) => setNewMovieUrl(e.target.value)}
                    placeholder={
                      newMoviePlatform === 'youtube'
                        ? 'https://youtube.com/watch?v=...'
                        : 'https://netflix.com/watch/81435684'
                    }
                    className="w-full rounded-full bg-white/[0.04] border border-white/15 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-vybe-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Direct .MP4 / .M3U8 Link (optional)
                  </label>
                  <input
                    type="text"
                    value={newMovieDirectStreamUrl}
                    onChange={(e) => setNewMovieDirectStreamUrl(e.target.value)}
                    placeholder="https://.../video.mp4"
                    className="w-full rounded-full bg-white/[0.04] border border-white/15 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-vybe-accent focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <GlowButton type="submit" disabled={addingMovie} className="py-2 px-5 text-xs">
                  <Plus className="h-3.5 w-3.5" />
                  <span>{addingMovie ? 'Adding Movie...' : 'Save Movie to Library'}</span>
                </GlowButton>
              </div>
            </motion.form>
          )}

          {/* Movie Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {siteMovies.map((movie) => {
              const isLaunching = launchingMovieId === movie.id;
              return (
                <motion.div
                  key={movie.id}
                  whileHover={{ y: -4 }}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-3xl vybe-glass hover:border-vybe-accent/60 transition-all"
                >
                  {/* Movie Poster Thumbnail */}
                  <div className="relative h-44 w-full bg-[#07080D] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={movie.thumbnailUrl}
                      alt={movie.title}
                      className="h-full w-full object-cover opacity-85 transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0D0F18] via-[#0D0F18]/25 to-transparent" />

                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border backdrop-blur-md ${
                          movie.platform === 'youtube'
                            ? 'bg-rose-500/25 border-rose-500/40 text-rose-200'
                            : 'bg-[#E50914]/30 border-[#E50914]/50 text-rose-200'
                        }`}
                      >
                        {movie.platform === 'youtube' ? (
                          <Youtube className="h-3 w-3" />
                        ) : (
                          <Tv className="h-3 w-3" />
                        )}
                        <span>{movie.platform}</span>
                      </span>

                      <span className="rounded-full vybe-glass-pill px-2.5 py-0.5 text-[10px] font-medium text-slate-200">
                        {movie.durationLabel}
                      </span>
                    </div>

                    <div className="absolute bottom-2.5 left-3.5 right-3.5">
                      <div className="text-[10px] font-semibold text-vybe-accentLight">
                        {movie.genre}
                      </div>
                      <h3 className="text-base font-bold text-white truncate">
                        {movie.title}
                      </h3>
                    </div>
                  </div>

                  {/* Description & 1-Click Watch Button */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3.5">
                    <p className="text-xs text-slate-300/80 line-clamp-2 leading-relaxed">
                      {movie.description}
                    </p>

                    <button
                      type="button"
                      disabled={isLaunching}
                      onClick={() => handleInstantLaunchMovie(movie)}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#8374FE] to-[#5645E8] hover:brightness-110 disabled:opacity-50 py-2.5 px-4 text-xs font-bold text-white shadow-[0_6px_20px_-4px_rgba(109,93,251,0.55),inset_0_1px_0_0_rgba(255,255,255,0.35)] transition"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>
                        {isLaunching ? 'Starting Room...' : 'Watch with Friends'}
                      </span>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* ================================================================== */}
        {/* 3. ACTIVE WATCH PARTY ROOMS + ADD & MANAGE FRIENDS                 */}
        {/* ================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Active Rooms (7 cols) */}
          <div className="lg:col-span-7 space-y-4 min-w-0">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Radio className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Active Watch Parties ({rooms.length})</span>
              </h2>
              <p className="text-xs text-slate-400">
                Live rooms created by you and your friends
              </p>
            </div>

            {rooms.length === 0 ? (
              <div className="rounded-3xl vybe-glass p-8 text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full vybe-glass-pill text-vybe-accentLight">
                  <Tv className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-white">
                  No Active Watch Parties Right Now
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  Click <strong>&ldquo;Watch with Friends&rdquo;</strong> on any episode above to spin up a room and share the room code with your friends!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      <div className="relative h-36 w-full bg-[#07080D] overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            room.playback.videoThumbnail ||
                            `https://i.ytimg.com/vi/${room.playback.videoId}/hqdefault.jpg`
                          }
                          alt={room.playback.videoTitle}
                          className="h-full w-full object-cover opacity-80"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0D0F18] via-[#0D0F18]/30 to-transparent" />

                        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase border backdrop-blur-md ${
                              room.platform === 'youtube'
                                ? 'bg-rose-500/25 border-rose-500/40 text-rose-200'
                                : 'bg-[#E50914]/30 border-[#E50914]/50 text-rose-200'
                            }`}
                          >
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

                        <div className="absolute bottom-2.5 left-4 right-4">
                          <span className="text-xs font-semibold text-white truncate block">
                            {room.playback.videoTitle}
                          </span>
                        </div>
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <h3 className="text-sm font-bold text-white truncate">
                            {room.title}
                          </h3>
                          <p className="text-[11px] text-slate-400">
                            Hosted by {room.hostName}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-white/[0.08]">
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
                              {activeMembers.length} watching
                            </span>
                          </div>

                          <Link
                            href={`/room?code=${encodeURIComponent(room.code)}`}
                            className="inline-flex items-center gap-1.5 rounded-full bg-vybe-accent hover:bg-vybe-accentLight px-4 py-1.5 text-xs font-bold text-white transition"
                          >
                            <Play className="h-3 w-3 fill-current" />
                            <span>Join</span>
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* ============================================================== */}
            {/* MOVIE & SERIES REQUEST BOARD (REQUEST NOW, ADD LATER)          */}
            {/* ============================================================== */}
            <div className="rounded-3xl vybe-glass p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <MessageSquarePlus className="h-4 w-4 text-vybe-accentLight shrink-0" />
                    <span>Movie & Series Requests ({movieRequests.length})</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Friends can request movies or shows here so you can add them to the library later
                  </p>
                </div>
              </div>

              {/* Request Form */}
              <form
                onSubmit={handleCreateMovieRequest}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2.5"
              >
                <input
                  type="text"
                  required
                  value={reqTitle}
                  onChange={(e) => setReqTitle(e.target.value)}
                  placeholder="Movie or show title (e.g. Arcane Season 2, Interstellar)"
                  className="sm:col-span-5 rounded-full bg-white/[0.04] border border-white/15 px-4 py-2 text-xs text-white placeholder-slate-400 focus:border-vybe-accent focus:outline-none min-w-0"
                />

                <select
                  value={reqPlatform}
                  onChange={(e) => setReqPlatform(e.target.value as PlatformType)}
                  className="sm:col-span-2 rounded-full bg-[#0D0F18] border border-white/15 px-3 py-2 text-xs text-white focus:border-vybe-accent focus:outline-none"
                >
                  <option value="netflix">Netflix</option>
                  <option value="youtube">YouTube</option>
                </select>

                <input
                  type="text"
                  value={reqNote}
                  onChange={(e) => setReqNote(e.target.value)}
                  placeholder="Note or link (optional)"
                  className="sm:col-span-3 rounded-full bg-white/[0.04] border border-white/15 px-3.5 py-2 text-xs text-white placeholder-slate-400 focus:border-vybe-accent focus:outline-none min-w-0"
                />

                <GlowButton
                  type="submit"
                  disabled={submittingRequest || !reqTitle.trim()}
                  className="sm:col-span-2 py-2 px-3 text-xs"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  <span>Request</span>
                </GlowButton>
              </form>

              {/* Requests List */}
              {movieRequests.length === 0 ? (
                <div className="rounded-2xl bg-white/[0.02] border border-white/10 p-4 text-center text-xs text-slate-400">
                  No movie requests yet. Submit a title above to start the wishlist!
                </div>
              ) : (
                <div className="space-y-2.5">
                  {movieRequests.map((req) => {
                    const hasVoted = req.upvoterIds.includes(user?.id || 'guest');
                    return (
                      <div
                        key={req.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-white/[0.03] border border-white/10 p-3.5"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                req.platform === 'youtube'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-[#E50914]/25 text-rose-200'
                              }`}
                            >
                              {req.platform}
                            </span>

                            <span className="text-xs sm:text-sm font-bold text-white truncate">
                              {req.title}
                            </span>

                            {req.status === 'added' && (
                              <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                                Added to Library ✓
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-slate-400">
                            Requested by{' '}
                            <span className="text-slate-200 font-medium">
                              {req.requestedByName} (@{req.requestedByUsername})
                            </span>
                            {req.note ? ` • "${req.note}"` : ''}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleVoteMovieRequest(req.id)}
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold border transition ${
                              hasVoted
                                ? 'bg-vybe-accent/25 border-vybe-accent text-white'
                                : 'vybe-glass-pill text-slate-300 hover:text-white'
                            }`}
                          >
                            <ThumbsUp className="h-3 w-3" />
                            <span>{req.upvoterIds.length}</span>
                          </button>

                          {req.status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => {
                                setNewMovieTitle(req.title);
                                setNewMoviePlatform(req.platform);
                                setFulfillingRequestId(req.id);
                                setShowAddMovieForm(true);
                                window.scrollTo({ top: 180, behavior: 'smooth' });
                              }}
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 px-3 py-1 text-xs font-semibold text-emerald-300 transition"
                              title="Pre-fill Add Movie form to add this requested title now"
                            >
                              <Plus className="h-3 w-3" />
                              <span>Add to Site</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleUpdateRequestStatus(req.id, 'delete')}
                            className="rounded-full p-1.5 text-slate-400 hover:text-rose-400 transition"
                            title="Remove request"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Friends & Invitations Column (5 cols) */}
          <div className="lg:col-span-5 space-y-6 min-w-0">
            {/* Add & Manage Friends Card */}
            <div className="rounded-3xl vybe-glass p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Friends ({myFriends.length})</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Add friends by their @username to watch together
                  </p>
                </div>
              </div>

              {/* Add Friend by @username Form */}
              <form
                onSubmit={handleAddFriendSubmit}
                className="flex items-center gap-2 rounded-full vybe-glass-pill p-1.5"
              >
                <AtSign className="h-3.5 w-3.5 text-vybe-accentLight ml-2.5 shrink-0" />
                <input
                  type="text"
                  value={friendUsernameInput}
                  onChange={(e) => setFriendUsernameInput(e.target.value)}
                  placeholder="Enter friend's @username"
                  className="flex-1 min-w-0 bg-transparent px-1.5 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none"
                />
                <GlowButton
                  type="submit"
                  disabled={addingFriend || !friendUsernameInput.trim()}
                  className="py-1.5 px-4 text-xs shrink-0"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Add</span>
                </GlowButton>
              </form>

              {/* My Added Friends List */}
              {myFriends.length === 0 ? (
                <div className="rounded-2xl bg-white/[0.02] border border-white/10 p-4 text-center text-xs text-slate-400 leading-relaxed">
                  You haven&apos;t added any friends yet. Ask your friends to create an account on{' '}
                  <strong className="text-white">vybe.nooryoosuf.com</strong> and enter their{' '}
                  <strong className="text-vybe-accentLight">@username</strong> above!
                </div>
              ) : (
                <div className="space-y-2">
                  {myFriends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between gap-2 rounded-full vybe-glass-pill pl-2.5 pr-3 py-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={friend.avatarUrl}
                          alt={friend.displayName}
                          className="h-8 w-8 rounded-full object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">
                            {friend.displayName}{' '}
                            <span className="font-normal text-slate-400">
                              @{friend.username}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {friend.currentRoomCode
                              ? `Watching in Room ${friend.currentRoomCode}`
                              : 'Online'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {friend.currentRoomCode ? (
                          <Link
                            href={`/room?code=${encodeURIComponent(
                              friend.currentRoomCode
                            )}`}
                            className="rounded-full bg-vybe-accent hover:bg-vybe-accentLight px-3 py-1 text-[11px] font-bold text-white transition"
                          >
                            Join
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleInviteFriendToRoom(friend)}
                            className="rounded-full bg-white/10 hover:bg-vybe-accent/30 px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition"
                          >
                            Invite
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeFriend(friend.id)}
                          className="rounded-full p-1 text-slate-400 hover:text-rose-400 transition"
                          title="Remove friend"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* People Signed Up on This VYBE Server (Quick 1-Click Add) */}
              {discoverUsers.length > 0 && (
                <div className="pt-3 border-t border-white/10 space-y-2">
                  <div className="text-xs font-semibold text-slate-300">
                    People on VYBE (Quick Add)
                  </div>
                  <div className="space-y-1.5">
                    {discoverUsers.slice(0, 6).map((person) => (
                      <div
                        key={person.id}
                        className="flex items-center justify-between gap-2 rounded-full bg-white/[0.03] border border-white/10 pl-2.5 pr-3 py-1.5"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={person.avatarUrl}
                            alt={person.displayName}
                            className="h-7 w-7 rounded-full object-cover shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white truncate">
                              {person.displayName}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              @{person.username}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={async () => {
                            await addFriend(person.username);
                            await fetchDashboardState();
                          }}
                          className="inline-flex items-center gap-1 rounded-full bg-vybe-accent/25 hover:bg-vybe-accent border border-vybe-accent/50 px-3 py-1 text-[11px] font-bold text-white transition shrink-0"
                        >
                          <UserPlus className="h-3 w-3" />
                          <span>Add</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Room Invitations (Only Shown When You Have Real Invitations) */}
            {pendingInvitations.length > 0 && (
              <div className="rounded-3xl vybe-glass p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Mail className="h-4 w-4 text-vybe-accentLight shrink-0" />
                    <span>Room Invitations</span>
                  </h2>
                  <span className="rounded-full bg-vybe-accent/20 border border-vybe-accent/40 px-3 py-0.5 text-[11px] font-bold text-vybe-accentLight">
                    {pendingInvitations.length} New
                  </span>
                </div>

                <div className="space-y-2">
                  {pendingInvitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="rounded-2xl bg-white/[0.03] border border-white/10 p-3 flex items-center justify-between gap-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate">
                          {inv.roomTitle}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          From {inv.senderName} • Code {inv.roomCode}
                        </div>
                      </div>

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
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
