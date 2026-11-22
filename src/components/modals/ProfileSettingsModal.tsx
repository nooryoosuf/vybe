'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  User,
  Sliders,
  Sparkles,
  Check,
  LogOut,
  Eye,
  Gauge,
} from 'lucide-react';
import { useVybe } from '@/context/VybeContext';
import { ACCENT_COLORS, AVATAR_PRESETS } from '@/lib/constants';
import { PresenceStatus } from '@/types/vybe';
import { GlowButton } from '@/components/ui/AceternityPrimitives';

export function ProfileSettingsModal() {
  const {
    user,
    isProfileModalOpen,
    setProfileModalOpen,
    updateProfile,
    updatePreferences,
    signOut,
  } = useVybe();

  const [activeTab, setActiveTab] = useState<'profile' | 'preferences'>('profile');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(AVATAR_PRESETS[0]);
  const [presenceStatus, setPresenceStatus] = useState<PresenceStatus>('online');
  const [accentColor, setAccentColor] = useState('#6D5DFB');

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setUsername(user.username);
      setBio(user.bio || '');
      setAvatarUrl(user.avatarUrl);
      setPresenceStatus(user.presenceStatus);
      setAccentColor(user.accentColor || '#6D5DFB');
    }
  }, [user, isProfileModalOpen]);

  if (!isProfileModalOpen || !user) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({
      displayName: displayName.trim() || user.displayName,
      username: username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '') || user.username,
      bio: bio.trim(),
      avatarUrl,
      presenceStatus,
      accentColor,
      isGuest: false,
    });
    setProfileModalOpen(false);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setProfileModalOpen(false)}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          className="relative z-10 w-full max-w-lg rounded-2xl bg-[#0D0F18] border border-white/10 p-6 shadow-vybe-lg max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl}
                alt={displayName}
                className="h-11 w-11 rounded-full object-cover ring-2 ring-vybe-accent/50"
              />
              <div>
                <h2 className="text-base font-bold text-white">Profile & Preferences</h2>
                <p className="text-xs text-slate-400">
                  Customize your cinema identity, presence & playback settings
                </p>
              </div>
            </div>
            <button
              onClick={() => setProfileModalOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-1.5 rounded-xl bg-[#07080D] p-1 border border-white/5">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all ${
                activeTab === 'profile'
                  ? 'bg-[#161A2B] text-white border border-white/10'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="h-3.5 w-3.5" />
              <span>Identity & Presence</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preferences')}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all ${
                activeTab === 'preferences'
                  ? 'bg-[#161A2B] text-white border border-white/10'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Playback & Accessibility</span>
            </button>
          </div>

          {activeTab === 'profile' ? (
            <form onSubmit={handleSaveProfile} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Choose Avatar
                </label>
                <div className="grid grid-cols-8 gap-2">
                  {AVATAR_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAvatarUrl(preset)}
                      className={`relative h-10 w-10 rounded-full overflow-hidden transition-transform ${
                        avatarUrl === preset
                          ? 'ring-2 ring-vybe-accent scale-110'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preset} alt="Avatar preset" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full rounded-xl bg-[#07080D] border border-white/10 px-3.5 py-2 text-sm text-white focus:border-vybe-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-xl bg-[#07080D] border border-white/10 px-3.5 py-2 text-sm text-white focus:border-vybe-accent focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Bio / Status Line
                </label>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Sci-Fi & late-night watch party host..."
                  className="w-full rounded-xl bg-[#07080D] border border-white/10 px-3.5 py-2 text-sm text-white focus:border-vybe-accent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Live Presence Status
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'online', label: 'Online', color: '#10B981' },
                        { id: 'watching', label: 'Watching', color: '#6D5DFB' },
                        { id: 'away', label: 'Away', color: '#F59E0B' },
                      ] as const
                    ).map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setPresenceStatus(st.id)}
                        className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-medium border transition-all ${
                          presenceStatus === st.id
                            ? 'bg-[#161A2B] border-vybe-accent text-white'
                            : 'bg-[#07080D] border-white/10 text-slate-400'
                        }`}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: st.color }}
                        />
                        <span>{st.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Personal Aura Accent
                  </label>
                  <div className="flex items-center gap-2 pt-1">
                    {ACCENT_COLORS.map((col) => (
                      <button
                        key={col.hex}
                        type="button"
                        onClick={() => setAccentColor(col.hex)}
                        title={col.name}
                        className="relative h-7 w-7 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                        style={{ backgroundColor: col.hex }}
                      >
                        {accentColor === col.hex && (
                          <Check className="h-3.5 w-3.5 text-white" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-between border-t border-white/10">
                <GlowButton
                  variant="danger"
                  type="button"
                  onClick={async () => {
                    await signOut();
                    setProfileModalOpen(false);
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </GlowButton>

                <GlowButton type="submit">
                  <Sparkles className="h-4 w-4" />
                  <span>Save Profile</span>
                </GlowButton>
              </div>
            </form>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-[#07080D] border border-white/10 p-3.5">
                <div>
                  <div className="text-xs font-semibold text-white">
                    Reduced Motion Accessibility
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Simplify floating reaction trajectories and disable ambient motion
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={user.preferences.reducedMotion}
                  onChange={(e) =>
                    updatePreferences({ reducedMotion: e.target.checked })
                  }
                  className="h-4 w-4 accent-vybe-accent rounded"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl bg-[#07080D] border border-white/10 p-3.5">
                <div>
                  <div className="text-xs font-semibold text-white">
                    Default Floating Theater Chat
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Start watch rooms with expanded video and translucent floating chat overlay
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={user.preferences.floatingChatDefault}
                  onChange={(e) =>
                    updatePreferences({ floatingChatDefault: e.target.checked })
                  }
                  className="h-4 w-4 accent-vybe-accent rounded"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl bg-[#07080D] border border-white/10 p-3.5">
                <div className="flex items-center gap-2.5">
                  <Eye className="h-4 w-4 text-vybe-accentLight" />
                  <div>
                    <div className="text-xs font-semibold text-white">
                      Share Live Activity with Friends
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Let friends see which public watch room you are currently watching
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={user.preferences.showPresenceToFriends}
                  onChange={(e) =>
                    updatePreferences({ showPresenceToFriends: e.target.checked })
                  }
                  className="h-4 w-4 accent-vybe-accent rounded"
                />
              </div>

              <div className="rounded-xl bg-[#07080D] border border-white/10 p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-white">
                      Auto-Sync Drift Tolerance
                    </span>
                  </div>
                  <span className="text-xs font-mono text-vybe-accentLight">
                    ±{user.preferences.autoSyncThresholdSec.toFixed(1)}s
                  </span>
                </div>
                <input
                  type="range"
                  min={1.0}
                  max={5.0}
                  step={0.5}
                  value={user.preferences.autoSyncThresholdSec}
                  onChange={(e) =>
                    updatePreferences({
                      autoSyncThresholdSec: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-vybe-accent"
                />
                <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                  <span>Strict (±1.0s)</span>
                  <span>Balanced (±2.0s)</span>
                  <span>Relaxed (±5.0s)</span>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
