'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  Lock,
  Globe,
  Users,
  Shield,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { useVybe } from '@/context/VybeContext';
import { SUPPORTED_NETFLIX_TITLES } from '@/lib/constants';
import {
  buildClientRoomObject,
  resolveNetflixMetadata,
  saveLocalRoom,
} from '@/lib/utils';
import { ControlPermission, RoomPrivacy, WatchRoom } from '@/types/vybe';
import { GlowButton } from '@/components/ui/AceternityPrimitives';

export function CreateRoomModal({
  isOpen,
  onClose,
  initialNetflixWatchId,
  initialNetflixTitle,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialNetflixWatchId?: string;
  initialNetflixTitle?: string;
}) {
  const router = useRouter();
  const { user, continueAsGuest, addToast } = useVybe();

  const [title, setTitle] = useState('Movie Night Watch Party');
  const [description, setDescription] = useState(
    'Grab snacks, jump on voice or chat, and react in real time.'
  );
  // Rooms always start with the featured Netflix title; each viewer then
  // watches the same title through their own Netflix.com account.
  const netflixWatchId = initialNetflixWatchId || SUPPORTED_NETFLIX_TITLES[0].watchId;
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

      const watchId = netflixWatchId;
      const meta = resolveNetflixMetadata(watchId);

      const payload = {
        title: title.trim() || 'Movie Night Watch Party',
        description: description.trim(),
        hostId: activeUser.id,
        hostName: activeUser.displayName,
        hostUsername: activeUser.username,
        hostAvatar: activeUser.avatarUrl,
        isGuest: activeUser.isGuest,
        platform: 'netflix' as const,
        privacy,
        password: password.trim(),
        hasPassword: password.trim().length > 0,
        allowGuests,
        waitingRoomEnabled,
        participantLimit,
        controlPermission,
        videoId: watchId,
        videoTitle: initialNetflixTitle || meta.title,
        videoThumbnail: meta.posterUrl,
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
        description: `Share code ${createdRoom.code} with friends to watch together on Netflix.`,
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
                Start a Netflix Watch Party
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Pick your room settings — everyone watches the same Netflix title on their own account
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
