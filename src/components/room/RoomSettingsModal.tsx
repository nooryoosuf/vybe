'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  Settings,
  Lock,
  Unlock,
  Globe,
  Shield,
  Users,
  Power,
  Check,
} from 'lucide-react';
import { ControlPermission, RoomPrivacy, WatchRoom } from '@/types/vybe';
import { GlowButton } from '@/components/ui/AceternityPrimitives';

interface RoomSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: WatchRoom;
  isHost: boolean;
  onSaveSettings: (settings: {
    title: string;
    description: string;
    privacy: RoomPrivacy;
    password?: string;
    allowGuests: boolean;
    waitingRoomEnabled: boolean;
    isLocked: boolean;
    participantLimit: number;
    controlPermission: ControlPermission;
  }) => Promise<void>;
  onEndRoom: () => Promise<void>;
}

export function RoomSettingsModal({
  isOpen,
  onClose,
  room,
  isHost,
  onSaveSettings,
  onEndRoom,
}: RoomSettingsModalProps) {
  const [title, setTitle] = useState(room.title);
  const [description, setDescription] = useState(room.description);
  const [privacy, setPrivacy] = useState<RoomPrivacy>(room.privacy);
  const [password, setPassword] = useState('');
  const [allowGuests, setAllowGuests] = useState(room.allowGuests);
  const [waitingRoomEnabled, setWaitingRoomEnabled] = useState(
    room.waitingRoomEnabled
  );
  const [isLocked, setIsLocked] = useState(room.isLocked);
  const [participantLimit, setParticipantLimit] = useState(room.participantLimit);
  const [controlPermission, setControlPermission] = useState<ControlPermission>(
    room.controlPermission
  );
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveSettings({
        title,
        description,
        privacy,
        password: password || undefined,
        allowGuests,
        waitingRoomEnabled,
        isLocked,
        participantLimit,
        controlPermission,
      });
      onClose();
    } finally {
      setSaving(false);
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
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          className="relative z-10 w-full max-w-xl rounded-2xl bg-[#0D0F18] border border-white/10 p-6 shadow-vybe-lg max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-vybe-accent/20 border border-vybe-accent/40 text-vybe-accentLight">
                <Settings className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  Room Settings & Access Controls
                </h2>
                <p className="text-xs text-slate-400">
                  Room Code <span className="font-mono text-white">{room.code}</span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Room Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl bg-[#07080D] border border-white/10 px-3 py-2 text-xs text-white focus:border-vybe-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Room Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl bg-[#07080D] border border-white/10 px-3 py-2 text-xs text-white focus:border-vybe-accent focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Visibility
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPrivacy('public')}
                    className={`flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold border ${
                      privacy === 'public'
                        ? 'bg-[#161A2B] border-vybe-accent text-white'
                        : 'bg-[#07080D] border-white/10 text-slate-400'
                    }`}
                  >
                    <Globe className="h-3.5 w-3.5" />
                    <span>Public</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrivacy('private')}
                    className={`flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold border ${
                      privacy === 'private'
                        ? 'bg-[#161A2B] border-vybe-accent text-white'
                        : 'bg-[#07080D] border-white/10 text-slate-400'
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
                  className="w-full rounded-xl bg-[#07080D] border border-white/10 px-3 py-2 text-xs text-white focus:border-vybe-accent focus:outline-none"
                >
                  <option value="host_only">Host Only</option>
                  <option value="cohosts">Host & Co-Hosts</option>
                  <option value="everyone">Everyone</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Update Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={room.hasPassword ? '•••••• (Active)' : 'None'}
                  className="w-full rounded-xl bg-[#07080D] border border-white/10 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-vybe-accent focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center justify-between rounded-xl bg-[#07080D] border border-white/10 px-3.5 py-2.5 cursor-pointer">
                <div className="flex items-center gap-2">
                  {isLocked ? (
                    <Lock className="h-4 w-4 text-rose-400" />
                  ) : (
                    <Unlock className="h-4 w-4 text-emerald-400" />
                  )}
                  <div>
                    <div className="text-xs font-semibold text-white">Lock Room</div>
                    <div className="text-[10px] text-slate-400">
                      Prevent new participants from joining
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isLocked}
                  onChange={(e) => setIsLocked(e.target.checked)}
                  className="h-4 w-4 accent-vybe-accent rounded"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl bg-[#07080D] border border-white/10 px-3.5 py-2.5 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-amber-400" />
                  <div>
                    <div className="text-xs font-semibold text-white">
                      Waiting Room
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Host approves viewers before admission
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={waitingRoomEnabled}
                  onChange={(e) => setWaitingRoomEnabled(e.target.checked)}
                  className="h-4 w-4 accent-vybe-accent rounded"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl bg-[#07080D] border border-white/10 px-3.5 py-2.5 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-vybe-accentLight" />
                  <div>
                    <div className="text-xs font-semibold text-white">
                      Allow Guest Viewers
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Permit guests via invite link
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={allowGuests}
                  onChange={(e) => setAllowGuests(e.target.checked)}
                  className="h-4 w-4 accent-vybe-accent rounded"
                />
              </label>

              <div className="flex items-center justify-between rounded-xl bg-[#07080D] border border-white/10 px-3.5 py-2.5">
                <div>
                  <div className="text-xs font-semibold text-white">
                    Participant Limit
                  </div>
                  <div className="text-[10px] text-slate-400">Max 100 viewers</div>
                </div>
                <input
                  type="number"
                  min={2}
                  max={100}
                  value={participantLimit}
                  onChange={(e) => setParticipantLimit(Number(e.target.value) || 25)}
                  className="w-16 rounded-lg bg-[#131624] border border-white/10 px-2 py-1 text-right text-xs text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/10 pt-4">
              {isHost ? (
                <GlowButton
                  type="button"
                  variant="danger"
                  onClick={onEndRoom}
                >
                  <Power className="h-4 w-4" />
                  <span>End Watch Party</span>
                </GlowButton>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <GlowButton variant="secondary" onClick={onClose}>
                  Cancel
                </GlowButton>
                <GlowButton type="submit" disabled={saving}>
                  <Check className="h-4 w-4" />
                  <span>{saving ? 'Saving...' : 'Save Settings'}</span>
                </GlowButton>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
