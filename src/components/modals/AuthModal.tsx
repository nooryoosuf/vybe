'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  Mail,
  Lock,
  User,
  Sparkles,
  Chrome,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { useVybe } from '@/context/VybeContext';
import { GlowButton } from '@/components/ui/AceternityPrimitives';

export function AuthModal() {
  const {
    isAuthModalOpen,
    setAuthModalOpen,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    continueAsGuest,
    isSupabaseConnected,
  } = useVybe();

  const [mode, setMode] = useState<'signin' | 'signup' | 'guest'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [guestName, setGuestName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else if (mode === 'signup') {
        await signUpWithEmail(email, password, displayName);
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

  const handleGoogle = async () => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
      setAuthModalOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Google sign-in failed');
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
          className="fixed inset-0 bg-black/75 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          className="relative z-10 w-full max-w-md rounded-2xl bg-[#0D0F18] border border-white/10 p-6 shadow-vybe-lg"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-vybe-accent/20 border border-vybe-accent/40 text-vybe-accentLight">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  {mode === 'signin'
                    ? 'Sign in to VYBE'
                    : mode === 'signup'
                    ? 'Create your VYBE Account'
                    : 'Quick Guest Cinema Pass'}
                </h2>
                <p className="text-xs text-slate-400">
                  Synchronize watch parties, reactions & watchlists
                </p>
              </div>
            </div>
            <button
              onClick={() => setAuthModalOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Mode tabs */}
          <div className="mt-5 grid grid-cols-3 gap-1 rounded-xl bg-[#07080D] p-1 border border-white/5">
            {(['signin', 'signup', 'guest'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setMode(tab);
                  setErrorMsg(null);
                }}
                className={`rounded-lg py-1.5 text-xs font-semibold transition-all ${
                  mode === tab
                    ? 'bg-[#161A2B] text-white shadow-sm border border-white/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab === 'signin' ? 'Sign In' : tab === 'signup' ? 'Sign Up' : 'Guest Pass'}
              </button>
            ))}
          </div>

          {errorMsg && (
            <div className="mt-4 rounded-xl bg-rose-500/10 border border-rose-500/30 px-3.5 py-2.5 text-xs text-rose-300">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Display Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Elena Vance"
                    className="w-full rounded-xl bg-[#07080D] border border-white/10 pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-vybe-accent focus:outline-none"
                  />
                </div>
              </div>
            )}

            {mode !== 'guest' ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="elena@vybe.cinema"
                      className="w-full rounded-xl bg-[#07080D] border border-white/10 pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-vybe-accent focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl bg-[#07080D] border border-white/10 pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-vybe-accent focus:outline-none"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Choose a Display Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="e.g. Jordan (Popcorn Ready)"
                    className="w-full rounded-xl bg-[#07080D] border border-white/10 pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-vybe-accent focus:outline-none"
                  />
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  Guests can join any watch party room where the host permits guest access.
                </p>
              </div>
            )}

            <GlowButton type="submit" disabled={submitting} className="w-full mt-2">
              <span>
                {submitting
                  ? 'Authenticating...'
                  : mode === 'signin'
                  ? 'Sign In to VYBE'
                  : mode === 'signup'
                  ? 'Create Cinema Account'
                  : 'Continue as Guest'}
              </span>
              <ArrowRight className="h-4 w-4" />
            </GlowButton>
          </form>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[11px] uppercase tracking-wider text-slate-500">
              or continue with
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <GlowButton
            variant="secondary"
            onClick={handleGoogle}
            disabled={submitting}
            className="w-full"
          >
            <Chrome className="h-4 w-4 text-vybe-accentLight" />
            <span>Continue with Google</span>
          </GlowButton>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-[#07080D] border border-white/5 px-3 py-2 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>
                {isSupabaseConnected
                  ? 'Supabase Cloud Auth Active'
                  : 'Supabase + Local Realtime Auth Active'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setEmail('elena@vybe.cinema');
                setPassword('vybe4kcinema');
                setMode('signin');
              }}
              className="text-vybe-accentLight hover:underline font-medium"
            >
              Fill Demo Host
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
