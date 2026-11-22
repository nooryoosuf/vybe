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

  const [title, setTitle] = useState('Midnight Watch Party');
  const [description, setDescription] = useState(
    'Grab snacks, jump on voice or chat, and react in real time.'
  );
  const [platform, setPlatform] = useState<PlatformType>(initialPlatform);
  const [optionalUrl, setOptionalUrl] = useState(initialVideoId || '');
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setCreating(true);

    try {
      let activeUser = user;
      if (!activeUser) {
        activeUser = await continueAsGuest('Cinema Host');
      }

      let resolvedVideoId =
        platform === 'youtube'
          ? CURATED_YOUTUBE_VIDEOS[0].videoId
          : SUPPORTED_NETFLIX_TITLES[0].watchId;
      let resolvedTitle =
        initialVideoTitle ||
        (platform === 'youtube'
          ? CURATED_YOUTUBE_VIDEOS[0].title
          : SUPPORTED_NETFLIX_TITLES[0].title);
      let resolvedThumbnail =
        platform === 'youtube'
          ? CURATED_YOUTUBE_VIDEOS[0].thumbnailUrl
          : SUPPORTED_NETFLIX_TITLES[0].posterUrl;

      if (optionalUrl.trim()) {
        if (platform === 'youtube') {
          const ytId = extractYouTubeId(optionalUrl);
          if (ytId) {
            resolvedVideoId = ytId;
            const meta = await fetchYouTubeMetadata(ytId);
            resolvedTitle = meta.title;
            resolvedThumbnail = meta.thumbnailUrl;
          }
        } else {
          const nfId = extractNetflixWatchId(optionalUrl);
          if (nfId) {
            resolvedVideoId = nfId;
            const nfMeta = resolveNetflixMetadata(nfId);
            resolvedTitle = nfMeta.title;
            resolvedThumbnail = nfMeta.posterUrl;
          }
        }
      }

      const payload = {
        title: title.trim() || 'Midnight Watch Party',
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

      // Always build local room object first so it is immediately available
      let createdRoom: WatchRoom = buildClientRoomObject(payload);

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
        // Local room is already saved and ready
      }

      addToast({
        title: `Room ${createdRoom.code} is Live!`,
        description: `Share code ${createdRoom.code} with friends to watch together.`,
        variant: 'success',
      });

      onClose();
      router.push(`/room?code=${encodeURIComponent(createdRoom.code)}`);
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
          className="relative z-10 w-full max-w-xl rounded-3xl vybe-glass p-6 sm:p-7 max-h-[92vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Start a Watch Party
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Pick your platform and room settings — load or switch videos anytime inside the room
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
                Streaming Platform
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPlatform('youtube')}
                  className={`flex items-center gap-3.5 rounded-2xl sm:rounded-full px-5 py-3 border text-left transition-all ${
                    platform === 'youtube'
                      ? 'bg-gradient-to-r from-[#6D5DFB]/30 to-[#7C3AED]/20 border-vybe-accent shadow-[0_0_28px_-6px_rgba(109,93,251,0.5)]'
                      : 'bg-white/[0.03] border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    <Youtube className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">YouTube</div>
                    <div className="text-[11px] text-slate-400">
                      Paste links & watch in-browser
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPlatform('netflix')}
                  className={`flex items-center gap-3.5 rounded-2xl sm:rounded-full px-5 py-3 border text-left transition-all ${
                    platform === 'netflix'
                      ? 'bg-gradient-to-r from-[#E50914]/30 to-rose-900/20 border-rose-500/70 shadow-[0_0_28px_-6px_rgba(229,9,20,0.45)]'
                      : 'bg-white/[0.03] border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E50914]/25 text-rose-300 border border-[#E50914]/50">
                    <Tv className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Netflix</div>
                    <div className="text-[11px] text-slate-400">
                      Log in & stream tab or extension
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Room Identity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Room Name
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
                  Room Description
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
                  Visibility
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
                <span>{creating ? 'Creating Room...' : 'Launch Watch Party'}</span>
                <ArrowRight className="h-4 w-4" />
              </GlowButton>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
