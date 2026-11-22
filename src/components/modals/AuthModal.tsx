'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  Lock,
  User,
  AtSign,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { useVybe } from '@/context/VybeContext';
import { GlowButton } from '@/components/ui/AceternityPrimitives';
import { AVATAR_PRESETS } from '@/lib/constants';

export function AuthModal() {
  const {
    isAuthModalOpen,
    setAuthModalOpen,
    signInWithEmail,
    signUpWithEmail,
    continueAsGuest,
  } = useVybe();

  const [mode, setMode] = useState<'signup' | 'signin' | 'guest'>('signup');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(AVATAR_PRESETS[0]);
  const [guestName, setGuestName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleNameChange = (val: string) => {
    setDisplayName(val);
    if (!username || username === displayName.toLowerCase().replace(/[^a-z0-9_]/g, '')) {
      setUsername(val.toLowerCase().replace(/[^a-z0-9_]/g, ''));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await signUpWithEmail({
          displayName,
          username,
          password,
          avatarUrl,
        });
      } else if (mode === 'signin') {
        await signInWithEmail(identifier, password);
      } else {
        await continueAsGuest(guestName);
      }
      setAuthModalOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setAuthModalOpen(false)}
          className="fixed inset-0 bg-black/75 backdrop-blur-md"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          className="relative z-10 w-full max-w-md rounded-3xl vybe-glass p-6 shadow-vybe-lg"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-vybe-accent/20 border border-vybe-accent/40 text-vybe-accentLight">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  {mode === 'signup'
                    ? 'Create Your Account'
                    : mode === 'signin'
                    ? 'Sign In to VYBE'
                    : 'Quick Guest Pass'}
                </h2>
                <p className="text-xs text-slate-400">
                  Add friends by @username and watch together
                </p>
              </div>
            </div>
            <button
              onClick={() => setAuthModalOpen(false)}
              className="rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Mode tabs */}
          <div className="mt-5 grid grid-cols-3 gap-1 rounded-full bg-black/40 p-1 border border-white/10">
            {(['signup', 'signin', 'guest'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setMode(tab);
                  setErrorMsg(null);
                }}
                className={`rounded-full py-1.5 text-xs font-semibold transition-all ${
                  mode === tab
                    ? 'bg-vybe-accent text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab === 'signup'
                  ? 'Create Account'
                  : tab === 'signin'
                  ? 'Sign In'
                  : 'Guest'}
              </button>
            ))}
          </div>

          {errorMsg && (
            <div className="mt-4 rounded-2xl bg-rose-500/15 border border-rose-500/35 px-3.5 py-2.5 text-xs text-rose-200">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Pick Your Avatar
                  </label>
                  <div className="grid grid-cols-8 gap-1.5">
                    {AVATAR_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAvatarUrl(preset)}
                        className={`relative h-9 w-9 rounded-full overflow-hidden transition-transform ${
                          avatarUrl === preset
                            ? 'ring-2 ring-vybe-accent scale-110'
                            : 'opacity-65 hover:opacity-100'
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={preset}
                          alt="Avatar"
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Your Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="e.g. Noor"
                      className="w-full rounded-full bg-white/[0.04] border border-white/15 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-vybe-accent focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Choose a @username (for friends to add you)
                  </label>
                  <div className="relative">
                    <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-vybe-accentLight" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) =>
                        setUsername(
                          e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                        )
                      }
                      placeholder="noor"
                      className="w-full rounded-full bg-white/[0.04] border border-white/15 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-vybe-accent focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="password"
                      required
                      minLength={4}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Choose a password"
                      className="w-full rounded-full bg-white/[0.04] border border-white/15 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-vybe-accent focus:outline-none"
                    />
                  </div>
                </div>
              </>
            )}

            {mode === 'signin' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Username or Email
                  </label>
                  <div className="relative">
                    <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-vybe-accentLight" />
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="e.g. @noor"
                      className="w-full rounded-full bg-white/[0.04] border border-white/15 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-vybe-accent focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-full bg-white/[0.04] border border-white/15 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-vybe-accent focus:outline-none"
                    />
                  </div>
                </div>
              </>
            )}

            {mode === 'guest' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Your Display Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="e.g. Noor"
                    className="w-full rounded-full bg-white/[0.04] border border-white/15 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-vybe-accent focus:outline-none"
                  />
                </div>
              </div>
            )}

            <GlowButton type="submit" disabled={submitting} className="w-full mt-2">
              <span>
                {submitting
                  ? 'Please wait...'
                  : mode === 'signup'
                  ? 'Create Account'
                  : mode === 'signin'
                  ? 'Sign In'
                  : 'Continue as Guest'}
              </span>
              <ArrowRight className="h-4 w-4" />
            </GlowButton>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
