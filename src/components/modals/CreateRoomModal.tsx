'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  Youtube,
  Tv,
  Lock,
  Globe,
  Users,
  Shield,
  Sparkles,
  ArrowRight,
  Link2,
} from 'lucide-react';
import { useVybe } from '@/context/VybeContext';
import { CURATED_YOUTUBE_VIDEOS, SUPPORTED_NETFLIX_TITLES } from '@/lib/constants';
import {
  buildClientRoomObject,
  extractNetflixWatchId,
  extractYouTubeId,
  fetchYouTubeMetadata,
  resolveNetflixMetadata,
  saveLocalRoom,
} from '@/lib/utils';
import { ControlPermission, PlatformType, RoomPrivacy, WatchRoom } from '@/types/vybe';
import { GlowButton } from '@/components/ui/AceternityPrimitives';
import { AsciiCinemaBadge } from '@/components/ui/AsciiBackdrop';

export function CreateRoomModal({
  isOpen,
  onClose,
  initialPlatform = 'youtube',
  initialVideoId,
  initialVideoTitle,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialPlatform?: PlatformType;
  initialVideoId?: string;
  initialVideoTitle?: string;
}) {
  const router = useRouter();
  const { user, continueAsGuest, addToast } = useVybe();

  const [title, setTitle] = useState('Midnight 4K Screening Room');
  const [description, setDescription] = useState(
    'Grab snacks, jump on voice or chat, and react in real time.'
  );
  const [platform, setPlatform] = useState<PlatformType>(initialPlatform);
  const [mediaInput, setMediaInput] = useState(
    initialVideoId || CURATED_YOUTUBE_VIDEOS[0].videoId
  );
  const [selectedTitle, setSelectedTitle] = useState(
    initialVideoTitle || CURATED_YOUTUBE_VIDEOS[0].title
  );
  const [privacy, setPrivacy] = useState<RoomPrivacy>('public');
  const [password, setPassword] = useState('');
  const [allowGuests, setAllowGuests] = useState(true);
  const [waitingRoomEnabled, setWaitingRoomEnabled] = useState(false);
  const [controlPermission, setControlPermission] =
    useState<ControlPermission>('everyone');
  const [participantLimit, setParticipantLimit] = useState(25);
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePlatformSwitch = (nextPlatform: PlatformType) => {
    setPlatform(nextPlatform);
    setErrorMsg(null);
    if (nextPlatform === 'youtube') {
      setMediaInput(CURATED_YOUTUBE_VIDEOS[0].videoId);
      setSelectedTitle(CURATED_YOUTUBE_VIDEOS[0].title);
    } else {
      setMediaInput(SUPPORTED_NETFLIX_TITLES[0].watchId);
      setSelectedTitle(SUPPORTED_NETFLIX_TITLES[0].title);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setCreating(true);

    try {
      let activeUser = user;
      if (!activeUser) {
        activeUser = await continueAsGuest('Cinema Host');
      }

      let resolvedVideoId = '';
      let resolvedTitle = selectedTitle;
      let resolvedThumbnail = '';

      if (platform === 'youtube') {
        const ytId = extractYouTubeId(mediaInput);
        if (!ytId) {
          throw new Error(
            'Please paste a valid YouTube URL (e.g. https://www.youtube.com/watch?v=aqz-KE-bpKQ) or select a preset film.'
          );
        }
        resolvedVideoId = ytId;
        const meta = await fetchYouTubeMetadata(ytId);
        resolvedTitle = meta.title;
        resolvedThumbnail = meta.thumbnailUrl;
      } else {
        const nfId = extractNetflixWatchId(mediaInput);
        if (!nfId) {
          throw new Error(
            'Please select a supported Netflix title or enter a valid Netflix Watch ID (e.g. 80057281).'
          );
        }
        resolvedVideoId = nfId;
        const nfMeta = resolveNetflixMetadata(nfId);
        resolvedTitle = nfMeta.title;
        resolvedThumbnail = nfMeta.posterUrl;
      }

      const payload = {
        title: title.trim() || 'Midnight Screening Room',
        description: description.trim(),
        hostId: activeUser.id,
        hostName: activeUser.displayName,
        hostUsername: activeUser.username,
        hostAvatar: activeUser.avatarUrl,
        isGuest: activeUser.isGuest,
        platform,
        privacy,
        password: password.trim(),
        hasPassword: password.trim().length > 0,
        allowGuests,
        waitingRoomEnabled,
        participantLimit,
        controlPermission,
        videoId: resolvedVideoId,
        videoTitle: resolvedTitle,
        videoThumbnail: resolvedThumbnail,
      };

      let createdRoom: WatchRoom | null = null;

      try {
        const res = await fetch('/api/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.room) {
            createdRoom = data.room as WatchRoom;
            saveLocalRoom(createdRoom);
          }
        }
      } catch {
        // Resilient local fallback if server is restarting
      }

      if (!createdRoom) {
        createdRoom = buildClientRoomObject(payload);
      }

      addToast({
        title: `Room ${createdRoom.code} is Live!`,
        description: `Share code ${createdRoom.code} with friends to watch together.`,
        variant: 'success',
      });

      onClose();
      router.push(`/room/${createdRoom.code}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setCreating(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/75 backdrop-blur-md"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          className="relative z-10 w-full max-w-2xl rounded-3xl vybe-glass p-6 sm:p-7 max-h-[92vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Start a Watch Party
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Choose a platform, pick a video, and invite friends
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full bg-white/[0.06] hover:bg-white/[0.14] border border-white/10 p-2 text-slate-300 hover:text-white transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {errorMsg && (
            <div className="mt-4 rounded-2xl bg-rose-500/15 border border-rose-500/35 px-4 py-3 text-xs text-rose-200">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleCreate} className="mt-5 space-y-5">
            {/* Platform Selection Pills */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                1. Choose Platform
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handlePlatformSwitch('youtube')}
                  className={`flex items-center gap-3.5 rounded-full px-5 py-3 border text-left transition-all ${
                    platform === 'youtube'
                      ? 'bg-gradient-to-r from-[#6D5DFB]/30 to-[#7C3AED]/20 border-vybe-accent shadow-[0_0_28px_-6px_rgba(109,93,251,0.5)]'
                      : 'bg-white/[0.03] border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    <Youtube className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">YouTube 4K Sync</div>
                    <div className="text-[11px] text-slate-400">
                      Official IFrame Player API
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handlePlatformSwitch('netflix')}
                  className={`flex items-center gap-3.5 rounded-full px-5 py-3 border text-left transition-all ${
                    platform === 'netflix'
                      ? 'bg-gradient-to-r from-[#E50914]/30 to-rose-900/20 border-rose-500/70 shadow-[0_0_28px_-6px_rgba(229,9,20,0.45)]'
                      : 'bg-white/[0.03] border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E50914]/25 text-rose-300 border border-[#E50914]/50">
                    <Tv className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Netflix Companion</div>
                    <div className="text-[11px] text-slate-400">
                      MV3 Chrome Extension Bridge
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Media Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                {platform === 'youtube'
                  ? '2. Paste YouTube URL or Choose a Film'
                  : '2. Choose Netflix Title or Watch ID'}
              </label>

              <div className="relative">
                <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={mediaInput}
                  onChange={(e) => setMediaInput(e.target.value)}
                  placeholder={
                    platform === 'youtube'
                      ? 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'
                      : 'Netflix Watch ID (e.g. 80057281 for Stranger Things)'
                  }
                  className="w-full rounded-full bg-white/[0.04] backdrop-blur-xl border border-white/15 pl-11 pr-5 py-3 text-sm text-white placeholder-slate-500 focus:border-vybe-accent focus:outline-none"
                />
              </div>

              {platform === 'youtube' ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {CURATED_YOUTUBE_VIDEOS.map((vid) => (
                    <button
                      key={vid.videoId}
                      type="button"
                      onClick={() => {
                        setMediaInput(vid.videoId);
                        setSelectedTitle(vid.title);
                      }}
                      className={`inline-flex items-center gap-2 rounded-full pl-1.5 pr-3.5 py-1 border text-xs transition-all ${
                        extractYouTubeId(mediaInput) === vid.videoId
                          ? 'bg-vybe-accent/25 border-vybe-accent text-white font-semibold shadow-vybe-accent'
                          : 'bg-white/[0.04] border-white/10 text-slate-300 hover:text-white hover:bg-white/[0.08]'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={vid.thumbnailUrl}
                        alt={vid.title}
                        className="h-6 w-6 rounded-full object-cover shrink-0"
                      />
                      <span className="truncate max-w-[160px]">
                        {vid.title.split('—')[0].trim()}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-3 space-y-2.5">
                  <div className="flex flex-wrap gap-2">
                    {SUPPORTED_NETFLIX_TITLES.map((nf) => (
                      <button
                        key={nf.watchId}
                        type="button"
                        onClick={() => {
                          setMediaInput(nf.watchId);
                          setSelectedTitle(nf.title);
                        }}
                        className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 border text-xs transition-all ${
                          extractNetflixWatchId(mediaInput) === nf.watchId
                            ? 'bg-rose-500/25 border-rose-500/70 text-white font-semibold'
                            : 'bg-white/[0.04] border-white/10 text-slate-300 hover:text-white'
                        }`}
                      >
                        <span>{nf.title.split('—')[0].trim()}</span>
                        <span className="font-mono text-[10px] opacity-70">
                          #{nf.watchId}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-amber-200/90 bg-amber-500/10 border border-amber-500/25 rounded-2xl px-3.5 py-2">
                    Netflix titles are never embedded in an iframe. Each viewer watches through their own authenticated Netflix account synchronized by the VYBE Manifest V3 Chrome Extension.
                  </p>
                </div>
              )}
            </div>

            {/* Room Identity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Room Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-full bg-white/[0.04] border border-white/15 px-4 py-2.5 text-sm text-white focus:border-vybe-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Atmosphere / Note
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-full bg-white/[0.04] border border-white/15 px-4 py-2.5 text-sm text-white focus:border-vybe-accent focus:outline-none"
                />
              </div>
            </div>

            {/* Privacy & Permissions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Room Visibility
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPrivacy('public')}
                    className={`flex items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold border transition ${
                      privacy === 'public'
                        ? 'bg-vybe-accent/25 border-vybe-accent text-white'
                        : 'bg-white/[0.03] border-white/10 text-slate-400'
                    }`}
                  >
                    <Globe className="h-3.5 w-3.5" />
                    <span>Public</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrivacy('private')}
                    className={`flex items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold border transition ${
                      privacy === 'private'
                        ? 'bg-vybe-accent/25 border-vybe-accent text-white'
                        : 'bg-white/[0.03] border-white/10 text-slate-400'
                    }`}
                  >
                    <Lock className="h-3.5 w-3.5" />
                    <span>Private</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Playback Control
                </label>
                <select
                  value={controlPermission}
                  onChange={(e) =>
                    setControlPermission(e.target.value as ControlPermission)
                  }
                  className="w-full rounded-full bg-[#0D0F18] border border-white/15 px-4 py-2 text-xs text-white focus:border-vybe-accent focus:outline-none"
                >
                  <option value="host_only">Host Only</option>
                  <option value="cohosts">Host & Co-Hosts</option>
                  <option value="everyone">All Participants</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Optional Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="None"
                  className="w-full rounded-full bg-white/[0.04] border border-white/15 px-4 py-2 text-xs text-white placeholder-slate-500 focus:border-vybe-accent focus:outline-none"
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <label className="flex items-center justify-between rounded-full bg-white/[0.03] border border-white/10 px-4 py-2.5 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-vybe-accentLight" />
                  <span className="text-xs font-medium text-slate-200">
                    Allow Guests
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={allowGuests}
                  onChange={(e) => setAllowGuests(e.target.checked)}
                  className="h-4 w-4 accent-vybe-accent rounded-full"
                />
              </label>

              <label className="flex items-center justify-between rounded-full bg-white/[0.03] border border-white/10 px-4 py-2.5 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-medium text-slate-200">
                    Waiting Room
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={waitingRoomEnabled}
                  onChange={(e) => setWaitingRoomEnabled(e.target.checked)}
                  className="h-4 w-4 accent-vybe-accent rounded-full"
                />
              </label>

              <div className="flex items-center justify-between rounded-full bg-white/[0.03] border border-white/10 px-4 py-2">
                <span className="text-xs font-medium text-slate-300">
                  Max Viewers
                </span>
                <input
                  type="number"
                  min={2}
                  max={100}
                  value={participantLimit}
                  onChange={(e) => setParticipantLimit(Number(e.target.value) || 25)}
                  className="w-16 rounded-full bg-white/[0.08] border border-white/10 px-2.5 py-0.5 text-right text-xs text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
              <GlowButton variant="secondary" onClick={onClose}>
                Cancel
              </GlowButton>
              <GlowButton type="submit" disabled={creating}>
                <Sparkles className="h-4 w-4" />
                <span>{creating ? 'Spinning Up Room...' : 'Launch Watch Party'}</span>
                <ArrowRight className="h-4 w-4" />
              </GlowButton>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
