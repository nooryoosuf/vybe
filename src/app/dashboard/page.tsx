'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Plus,
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
  AtSign,
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
  SiteMovieItem,
  WatchRoom,
} from '@/types/vybe';
import {
  buildClientRoomObject,
  extractNetflixWatchId,
  getLocalSiteMovies,
  resolveNetflixMetadata,
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
    addToast,
  } = useVybe();

  const [siteMovies, setSiteMovies] = useState<SiteMovieItem[]>([]);
  const [invitations, setInvitations] = useState<RoomInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [createPreset, setCreatePreset] = useState<{
    platform: PlatformType;
    videoId?: string;
    videoTitle?: string;
  }>({ platform: 'netflix' });

  const [joinCodeInput, setJoinCodeInput] = useState('');


  // Add Movie to Site Library Modal/Drawer
  const [showAddMovieForm, setShowAddMovieForm] = useState(false);
  const [newMovieTitle, setNewMovieTitle] = useState('');
  const [newMovieGenre, setNewMovieGenre] = useState('Sci-Fi • Thriller');
  const newMoviePlatform = 'netflix' as PlatformType;
  const [newMovieUrl, setNewMovieUrl] = useState('');
  const [addingMovie, setAddingMovie] = useState(false);
  const [launchingMovieId, setLaunchingMovieId] = useState<string | null>(null);

  const fetchDashboardState = useCallback(async () => {
    const localMovies = getLocalSiteMovies();
    try {
      const uid = user?.id || 'default';
      const res = await fetch(`/api/state?userId=${encodeURIComponent(uid)}`);
      if (res.ok) {
        const data = await res.json();
        const serverMovies: SiteMovieItem[] = data.siteMovies || [];
        const movieMap = new Map<string, SiteMovieItem>();
        for (const m of [...localMovies, ...serverMovies]) {
          movieMap.set(m.id, m);
        }
        setSiteMovies(Array.from(movieMap.values()));
        setInvitations(data.invitations || []);
        return;
      }
    } catch {
      // Fallback to local cache
    } finally {
      setLoading(false);
    }
    setSiteMovies(localMovies);
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
      let durationLabel = 'Netflix';

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

      const newMovie: SiteMovieItem = {
        id: `mov-custom-${Date.now()}`,
        title: resolvedTitle,
        genre: newMovieGenre.trim() || 'Movie Night',
        durationLabel,
        year: 'Added by ' + (user?.displayName || 'Friend'),
        platform: 'netflix',
        videoId,
        thumbnailUrl,
        description: `Added to VYBE by ${user?.displayName || 'a friend'} — click Watch with Friends to launch a room!`,
        addedBy: user?.displayName || 'Friend',
      };

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
      setShowAddMovieForm(false);

      addToast({
        title: `"${newMovie.title}" added to Movies!`,
        description: 'Anyone can now launch a watch party with it.',
        variant: 'success',
      });
    } finally {
      setAddingMovie(false);
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

  const pendingInvitations = invitations.filter((i) => i.status === 'pending');

  return (
    <div className="relative min-h-screen bg-[#07080D] text-slate-100 overflow-x-hidden">
      <CinemaSpotlight withAscii={true} />
      <Navbar
        onQuickCreateRoom={() => {
          setCreatePreset({ platform: 'netflix' });
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
                  setCreatePreset({ platform: 'netflix' });
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
                placeholder="Enter Room Code (e.g. NFX-808)"
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
                  <div className="w-full rounded-full bg-[#0D0F18] border border-white/15 px-3.5 py-2.5 text-xs text-white">Netflix</div>
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
                    Netflix Link or Watch ID
                  </label>
                  <input
                    type="text"
                    required
                    value={newMovieUrl}
                    onChange={(e) => setNewMovieUrl(e.target.value)}
                    placeholder="https://netflix.com/watch/81435684"
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

          {/* Movies Empty State */}
          {siteMovies.length === 0 && !showAddMovieForm && (
            <div className="rounded-3xl bg-[#07080D]/50 border border-white/[0.06] p-6 text-center space-y-2">
              <div className="text-sm font-bold text-white">No movies added yet</div>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Enter a netflix.com/watch/… link or a numeric Watch ID in the form above — each title is added when someone hosts a party with it.
              </p>
            </div>
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
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border backdrop-blur-md bg-[#E50914]/30 border-[#E50914]/50 text-rose-200">
                        <Tv className="h-3 w-3" />
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
          {/* 3. ROOM INVITATIONS                                                */}
        {/* ================================================================== */}
        <div className="grid grid-cols-1 gap-6">

          {/* Friends & Invitations Column (5 cols) */}
          <div className="space-y-6 min-w-0">
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
        initialNetflixWatchId={createPreset.videoId}
        initialNetflixTitle={createPreset.videoTitle}
      />
    </div>
  );
}
