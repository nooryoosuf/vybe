'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Users,
  Radio,
  Shield,
  Youtube,
  Tv,
  MessageSquare,
  ListVideo,
  Mic,
  Lock,
  ArrowRight,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import {
  CinemaSpotlight,
  GlowButton,
} from '@/components/ui/AceternityPrimitives';
import { AsciiWaveCanvas } from '@/components/ui/AsciiBackdrop';
import { CreateRoomModal } from '@/components/modals/CreateRoomModal';
import { VYBE_REACTIONS } from '@/lib/constants';

interface HeroFloatingBurst {
  id: string;
  emoji: string;
  label: string;
  x: number;
  drift: number;
}

export default function LandingPage() {
  const router = useRouter();
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [heroBursts, setHeroBursts] = useState<HeroFloatingBurst[]>([]);

  const triggerHeroReaction = (emoji: string, label: string) => {
    const id = `hb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const x = 15 + Math.floor(Math.random() * 70);
    const drift = Math.floor(Math.random() * 50) - 25;
    setHeroBursts((prev) => [...prev.slice(-10), { id, emoji, label, x, drift }]);
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinCode.trim().toUpperCase();
    if (!cleaned) {
      router.push('/room?code=VYB-4K1');
      return;
    }
    router.push(`/room?code=${encodeURIComponent(cleaned)}`);
  };

  return (
    <div className="relative min-h-screen bg-[#07080D] text-slate-100 overflow-x-hidden">
      {/* Interactive 60FPS Animated ASCII Wave Field + Volumetric Spotlight */}
      <CinemaSpotlight withAscii={true} />
      <Navbar onQuickCreateRoom={() => setCreateModalOpen(true)} />

      {/* ==================================================================== */}
      {/* 1. HERO SECTION                                                      */}
      {/* ==================================================================== */}
      <section className="relative mx-auto max-w-5xl px-4 pt-12 pb-16 sm:px-6 lg:px-8 sm:pt-20 sm:pb-24">
        {/* Floating Reaction Bursts */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <AnimatePresence>
            {heroBursts.map((b) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 0, scale: 0.7 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  y: -220,
                  x: [0, b.drift, -b.drift * 0.4],
                  scale: [0.8, 1.25, 1.05],
                }}
                transition={{ duration: 2.6, ease: 'easeOut' }}
                onAnimationComplete={() =>
                  setHeroBursts((prev) => prev.filter((item) => item.id !== b.id))
                }
                style={{ left: `${b.x}%` }}
                className="absolute bottom-24 flex items-center gap-1.5 rounded-full vybe-glass-pill px-3 py-1 shadow-xl"
              >
                <span className="text-lg">{b.emoji}</span>
                <span className="text-[11px] font-medium text-white">{b.label}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mb-6 flex justify-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full vybe-glass-pill px-4 py-1.5 text-xs font-medium text-slate-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Synchronized YouTube & Netflix Watch Parties</span>
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="font-display text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl leading-[1.06]"
          >
            Watch Together.{' '}
            <span className="bg-gradient-to-r from-[#A594FF] via-[#6D5DFB] to-[#E879F9] bg-clip-text text-transparent">
              Feel Closer.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="mt-5 text-sm sm:text-lg text-slate-300/90 leading-relaxed max-w-2xl mx-auto px-2"
          >
            Late-night cinema with friends from anywhere. Stream YouTube videos and Netflix titles in real time with floating scene reactions, voice chat, live messages, and shared watch queues.
          </motion.p>

          {/* Primary & Secondary Pill CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.24 }}
            className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 max-w-md sm:max-w-none mx-auto"
          >
            <GlowButton
              variant="primary"
              onClick={() => setCreateModalOpen(true)}
              className="w-full sm:w-auto px-8 py-3.5 text-sm"
            >
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>Start a Watch Party</span>
              <ArrowRight className="h-4 w-4 shrink-0" />
            </GlowButton>

            <GlowButton
              variant="secondary"
              onClick={() => setShowJoinInput((prev) => !prev)}
              className="w-full sm:w-auto px-8 py-3.5 text-sm"
            >
              <Users className="h-4 w-4 text-vybe-accentLight shrink-0" />
              <span>Join a Room</span>
            </GlowButton>
          </motion.div>

          {/* Expandable Pill Join by Code Bar */}
          <AnimatePresence>
            {showJoinInput && (
              <motion.form
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                onSubmit={handleJoinSubmit}
                className="mx-auto max-w-md overflow-hidden"
              >
                <div className="flex items-center gap-2 rounded-full vybe-glass p-1.5">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Enter Room Code (e.g. VYB-4K1)"
                    className="flex-1 min-w-0 bg-transparent px-3.5 py-2 text-xs text-white placeholder-slate-400 focus:outline-none"
                  />
                  <GlowButton type="submit" className="py-2 px-4 text-xs shrink-0">
                    Enter
                  </GlowButton>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Interactive Reaction Pill Bar */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32 }}
            className="mt-10 inline-flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-3xl sm:rounded-full vybe-glass px-4 py-2.5"
          >
            <span className="text-xs font-medium text-slate-300 px-2">
              Try a reaction:
            </span>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {VYBE_REACTIONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => triggerHeroReaction(r.emoji, r.label)}
                  title={r.label}
                  className="flex h-8 w-8 sm:w-9 items-center justify-center rounded-full vybe-glass-pill hover:bg-vybe-accent/35 hover:border-vybe-accent text-sm sm:text-base transition-transform hover:scale-125 active:scale-95"
                >
                  {r.emoji}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 2. HOW IT WORKS                                                      */}
      {/* ==================================================================== */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:py-16 sm:px-6 lg:px-8 border-t border-white/[0.06]">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-semibold uppercase tracking-wider text-vybe-accentLight">
            Simple Setup
          </span>
          <h2 className="mt-2 font-display text-2xl sm:text-4xl font-bold text-white">
            How It Works
          </h2>
          <p className="mt-2.5 text-xs sm:text-sm text-slate-400">
            No manual countdowns. Start watching together in seconds.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {[
            {
              step: 'Step 1',
              title: 'Create a Room',
              description:
                'Paste any YouTube URL or pick a Netflix title. Customize room privacy, optional password, and playback control permissions.',
              icon: Sparkles,
            },
            {
              step: 'Step 2',
              title: 'Invite Your Friends',
              description:
                'Share a unique invite link or room code. Guests can join immediately when permitted by the host.',
              icon: Users,
            },
            {
              step: 'Step 3',
              title: 'Watch & React Together',
              description:
                'Everyone stays automatically synced to the same timestamp while floating reactions and live chat bring the room alive.',
              icon: Zap,
            },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="relative min-w-0 overflow-hidden rounded-3xl vybe-glass p-5 sm:p-6 hover:border-vybe-accent/50 transition-all"
              >
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full vybe-glass-pill text-vybe-accentLight">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="rounded-full vybe-glass-pill px-3 py-1 text-xs font-semibold text-slate-300">
                    {item.step}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
                  {item.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 3. SUPPORTED PLATFORMS                                               */}
      {/* ==================================================================== */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:py-16 sm:px-6 lg:px-8 border-t border-white/[0.06]">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-semibold uppercase tracking-wider text-vybe-accentLight">
            Streaming Integrations
          </span>
          <h2 className="mt-2 font-display text-2xl sm:text-4xl font-bold text-white">
            Supported Platforms
          </h2>
          <p className="mt-2.5 text-xs sm:text-sm text-slate-400">
            Built for instant YouTube playback and Chrome Extension Netflix synchronization.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
          {/* YouTube Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="min-w-0 overflow-hidden rounded-3xl vybe-glass p-5 sm:p-7 flex flex-col justify-between"
          >
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-rose-500/20 border border-rose-500/40 px-3.5 py-1 text-xs font-bold text-rose-200">
                  <Youtube className="h-4 w-4 shrink-0" />
                  <span>YouTube</span>
                </div>
                <span className="rounded-full vybe-glass-pill px-3 py-1 text-xs font-medium text-emerald-300">
                  No Install Needed
                </span>
              </div>

              <h3 className="mt-4 sm:mt-5 text-xl sm:text-2xl font-bold text-white">
                Instant Browser Screening
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-300/90 leading-relaxed">
                Paste any YouTube video URL. VYBE synchronizes play, pause, seek, and buffering state, and automatically advances through your shared watch queue.
              </p>

              <ul className="mt-4 sm:mt-5 space-y-2.5 text-xs text-slate-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Real-time play, pause, and seek synchronization</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Switch videos seamlessly without leaving the room</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Automatic queue progression when a video finishes</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
              <Link
                href="/dashboard"
                className="text-xs font-semibold text-vybe-accentLight hover:underline"
              >
                Browse Ready-to-Watch Movies →
              </Link>
              <GlowButton
                variant="primary"
                onClick={() => setCreateModalOpen(true)}
                className="w-full sm:w-auto py-2 px-5 text-xs"
              >
                Host YouTube Room
              </GlowButton>
            </div>
          </motion.div>

          {/* Netflix Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="min-w-0 overflow-hidden rounded-3xl vybe-glass p-5 sm:p-7 flex flex-col justify-between"
          >
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#E50914]/25 border border-[#E50914]/50 px-3.5 py-1 text-xs font-bold text-rose-200">
                  <Tv className="h-4 w-4 shrink-0" />
                  <span>Netflix</span>
                </div>
                <span className="rounded-full vybe-glass-pill px-3 py-1 text-xs font-medium text-slate-200">
                  Tab Stream & Extension
                </span>
              </div>

              <h3 className="mt-4 sm:mt-5 text-xl sm:text-2xl font-bold text-white">
                Synced Netflix Sessions
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-300/90 leading-relaxed">
                Sign into Netflix and stream your tab directly into the VYBE room, or use the Chrome Extension to keep everyone’s playback aligned to the same second.
              </p>

              <ul className="mt-4 sm:mt-5 space-y-2.5 text-xs text-slate-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Works directly with your own Netflix account</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Stream your Netflix tab directly inside the VYBE room</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Or use the Teleparty-style Chrome Extension sidebar</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
              <Link
                href="/dashboard"
                className="text-xs font-semibold text-rose-400 hover:underline"
              >
                Browse Netflix Titles →
              </Link>
              <GlowButton
                variant="secondary"
                onClick={() => router.push('/dashboard')}
                className="w-full sm:w-auto py-2 px-5 text-xs"
              >
                Open Movie Lobby
              </GlowButton>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 4. FEATURES OVERVIEW & SOCIAL WATCHING EXPERIENCE                    */}
      {/* ==================================================================== */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:py-16 sm:px-6 lg:px-8 border-t border-white/[0.06]">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-semibold uppercase tracking-wider text-vybe-accentLight">
            Features Overview
          </span>
          <h2 className="mt-2 font-display text-2xl sm:text-4xl font-bold text-white">
            Made for Watching Together
          </h2>
          <p className="mt-2.5 text-xs sm:text-sm text-slate-400">
            Keep the video front and center while making friends feel right next to you.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {[
            {
              title: 'Animated Reactions',
              description:
                'Send ❤️ 😂 😭 😱 🔥 👏 🤯 💀 🥹 over key scenes with smooth floating animations and keyboard shortcuts 1–9.',
              icon: Sparkles,
              badge: 'Real-Time',
            },
            {
              title: 'Playback Synchronization',
              description:
                'Automatic drift detection and latency compensation keep everyone watching the exact same moment.',
              icon: Radio,
              badge: 'Auto-Sync',
            },
            {
              title: 'Live Chat & GIFs',
              description:
                'Reply to messages, send reaction GIFs, react to messages, or switch to Floating Chat for more video space.',
              icon: MessageSquare,
              badge: 'Interactive',
            },
            {
              title: 'Shared Watch Queue',
              description:
                'Add YouTube videos or Netflix titles, upvote favorites to play next, reorder items, and auto-play the queue.',
              icon: ListVideo,
              badge: 'Upvoted',
            },
            {
              title: 'Voice & Camera',
              description:
                'Join with mic and camera off by default. Turn on voice or camera anytime with speaking indicators.',
              icon: Mic,
              badge: 'Optional',
            },
            {
              title: 'Privacy & Room Controls',
              description:
                'Lock rooms, add passwords, enable a waiting room, mute or remove disruptive users, and transfer host.',
              icon: Shield,
              badge: 'Host Controls',
            },
          ].map((feat, i) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="min-w-0 overflow-hidden rounded-3xl vybe-glass p-5 sm:p-6 flex flex-col justify-between hover:border-white/25 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full vybe-glass-pill text-vybe-accentLight shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-full vybe-glass-pill px-3 py-1 text-[11px] font-medium text-slate-300">
                      {feat.badge}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white">{feat.title}</h3>
                  <p className="mt-2 text-xs text-slate-300/80 leading-relaxed">
                    {feat.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Privacy & Room Controls Banner with Animated ASCII Background */}
        <div className="relative mt-12 overflow-hidden rounded-3xl vybe-glass p-6 sm:p-10">
          <AsciiWaveCanvas density={28} opacity={0.38} />
          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="max-w-xl min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full vybe-glass-pill px-3.5 py-1 text-xs font-semibold text-emerald-300 mb-3">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                <span>Privacy & Room Controls</span>
              </div>
              <h3 className="font-display text-xl sm:text-3xl font-bold text-white">
                Your Room, Your Rules
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                Keep your watch party private with room codes, optional passwords, waiting room approval, and configurable playback permissions.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row w-full lg:w-auto items-stretch sm:items-center gap-3">
              <GlowButton
                variant="secondary"
                onClick={() => router.push('/dashboard')}
                className="w-full sm:w-auto"
              >
                <span>Open Lobby</span>
              </GlowButton>
              <GlowButton
                variant="primary"
                onClick={() => setCreateModalOpen(true)}
                className="w-full sm:w-auto"
              >
                <Sparkles className="h-4 w-4 shrink-0" />
                <span>Create Private Room</span>
              </GlowButton>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 5. FOOTER                                                            */}
      {/* ==================================================================== */}
      <footer className="border-t border-white/[0.07] bg-[#05060A]/90 backdrop-blur-xl py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-vybe-accent text-white shrink-0">
              <Tv className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-bold text-white">VYBE</span>
              <p className="text-xs text-slate-400">
                Watch Together. Feel Closer.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5 text-xs text-slate-300">
            <Link
              href="/"
              className="rounded-full vybe-glass-pill px-3.5 py-1.5 hover:text-white transition"
            >
              Home
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full vybe-glass-pill px-3.5 py-1.5 hover:text-white transition"
            >
              Lobby
            </Link>
            <Link
              href="/room/VYB-4K1"
              className="rounded-full vybe-glass-pill px-3.5 py-1.5 hover:text-white transition"
            >
              YouTube Room
            </Link>
            <Link
              href="/room/NFX-808"
              className="rounded-full vybe-glass-pill px-3.5 py-1.5 hover:text-white transition"
            >
              Netflix Room
            </Link>
          </div>
        </div>
      </footer>

      <CreateRoomModal
        isOpen={isCreateModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </div>
  );
}
