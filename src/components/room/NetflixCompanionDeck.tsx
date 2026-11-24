'use client';

import React, { useEffect, useState } from 'react';
import {
  ExternalLink,
  Play,
  Pause,
  RefreshCw,
  Tv,
  CircleAlert,
  Copy,
  Check,
  Link2,
  Sparkles,
  Radio,
  SlidersHorizontal,
} from 'lucide-react';
import { AsciiWaveCanvas, AsciiSignalTicker } from '@/components/ui/AsciiBackdrop';
import { resolveNetflixMetadata, formatTimestamp, extractNetflixWatchId } from '@/lib/utils';
import { SUPPORTED_NETFLIX_TITLES } from '@/lib/constants';

interface NetflixCompanionDeckProps {
  roomCode: string;
  watchId: string | null;
  videoTitle: string | null;
  posterUrl?: string | null;
  authoritativeIsPlaying: boolean;
  authoritativeTime: number;
  authoritativeBuffering: boolean;
  duration?: number;
  canControlPlayback: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onRequestResync: () => void;
  onSwitchTitle?: (watchId: string, title: string, thumbnailUrl: string) => void;
}

export function NetflixCompanionDeck({
  roomCode,
  watchId,
  videoTitle,
  authoritativeIsPlaying,
  authoritativeTime,
  authoritativeBuffering,
  duration: authoritativeDuration,
  canControlPlayback,
  onPlay,
  onPause,
  onSeek,
  onRequestResync,
  onSwitchTitle,
}: NetflixCompanionDeckProps) {
  const meta = watchId ? resolveNetflixMetadata(watchId) : null;
  const hasSpecificTitle = Boolean(
    videoTitle &&
    videoTitle !== 'Netflix Watch Party' &&
    !videoTitle.startsWith('Arcane')
  );
  const displayTitle = hasSpecificTitle
    ? videoTitle!
    : meta?.title && !meta.title.startsWith('Arcane')
    ? meta.title
    : 'Netflix Watch Party';

  const duration = Math.max(authoritativeDuration || 0, 100);
  const [isMobile, setIsMobile] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    }
  }, []);

  const openNetflix = () => {
    const id = watchId && watchId !== 'netflix-active' ? watchId : '';
    const targetUrl = id
      ? `https://netflix.com/watch/${id}?vybeRoom=${encodeURIComponent(roomCode)}`
      : `https://netflix.com?vybeRoom=${encodeURIComponent(roomCode)}`;
    if (typeof window !== 'undefined') {
      window.open(targetUrl, '_blank', 'noopener');
    }
  };

  const handleCopyInvite = () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/room?code=${encodeURIComponent(roomCode)}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

  const handleLoadCustomTitle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrlInput.trim() || !onSwitchTitle) return;
    const extracted = extractNetflixWatchId(customUrlInput.trim());
    if (!extracted) return;
    const resolved = resolveNetflixMetadata(extracted);
    onSwitchTitle(extracted, resolved.title, resolved.posterUrl);
    setCustomUrlInput('');
    setShowPicker(false);
  };

  const controlHint = !canControlPlayback ? 'Only hosts can control playback here.' : null;

  return (
    <div className="relative flex flex-col w-full lg:h-full bg-[#05060A] select-none shrink-0 lg:shrink overflow-hidden">
      {/* Main Center Stage: Live Animated ASCII Wave Canvas + Interactive Instruction Deck */}
      <div className="relative w-full aspect-video lg:aspect-auto lg:flex-1 overflow-hidden bg-[#07080D] flex flex-col items-center justify-center p-3.5 sm:p-6 lg:p-8">
        {/* Real-time 60fps Interactive ASCII Wave Backdrop */}
        <AsciiWaveCanvas density={24} opacity={0.32} className="z-0" />

        {/* Floating Instruction HUD */}
        <div className="relative z-10 w-full max-w-2xl mx-auto flex flex-col items-center text-center space-y-3.5 sm:space-y-4">
          {/* Top Ticker & Status Badge */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <AsciiSignalTicker label="NETFLIX SYNC ENGINE // ACTIVE" />
            <span className="inline-flex items-center gap-1.5 rounded-full vybe-glass-pill px-3 py-1 text-[10px] sm:text-[11px] font-mono text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>ROOM: {roomCode}</span>
            </span>
          </div>

          {/* Active Title Banner */}
          <div className="space-y-1 max-w-xl">
            <h2 className="text-lg sm:text-2xl font-extrabold text-white tracking-tight">
              {displayTitle}
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed">
              {meta && hasSpecificTitle
                ? `${meta.year} • ${meta.genre} • ${meta.durationLabel}`
                : 'Watch Netflix in perfect synchronization with your friends.'}
            </p>
          </div>

          {/* Step-by-Step Watch Party Instructions */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 text-left my-1 sm:my-2">
            <div className="rounded-2xl vybe-glass p-3 sm:p-3.5 space-y-1.5 border border-white/10 hover:border-vybe-accent/50 transition">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-400">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/20 text-[10px]">
                  1
                </span>
                <span>Open Netflix</span>
              </div>
              <p className="text-[11px] text-slate-300/80 leading-relaxed">
                Click <strong>&ldquo;Launch Netflix&rdquo;</strong> to open the movie in a new tab on your account.
              </p>
            </div>

            <div className="rounded-2xl vybe-glass p-3 sm:p-3.5 space-y-1.5 border border-white/10 hover:border-vybe-accent/50 transition">
              <div className="flex items-center gap-2 text-xs font-bold text-vybe-accentLight">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-vybe-accent/20 text-[10px]">
                  2
                </span>
                <span>Auto-Sync Locks</span>
              </div>
              <p className="text-[11px] text-slate-300/80 leading-relaxed">
                The VYBE extension detects your tab and locks timestamps to Room <strong>{roomCode}</strong>.
              </p>
            </div>

            <div className="rounded-2xl vybe-glass p-3 sm:p-3.5 space-y-1.5 border border-white/10 hover:border-vybe-accent/50 transition">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-[10px]">
                  3
                </span>
                <span>Watch Together</span>
              </div>
              <p className="text-[11px] text-slate-300/80 leading-relaxed">
                Play, pause, or seek anytime — everyone stays in real-time sync with chat & reactions.
              </p>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={openNetflix}
              className="inline-flex items-center gap-2 rounded-full bg-[#E50914] hover:bg-[#f6121d] px-5 py-2.5 text-xs font-bold text-white shadow-[0_6px_20px_-4px_rgba(229,9,20,0.5)] transition"
            >
              <Tv className="h-4 w-4" />
              <span>Launch Netflix.com</span>
              <ExternalLink className="h-3.5 w-3.5 opacity-80" />
            </button>

            <button
              type="button"
              onClick={handleCopyInvite}
              className="inline-flex items-center gap-1.5 rounded-full vybe-glass-pill hover:border-white/30 px-4 py-2.5 text-xs font-semibold text-slate-200 transition"
            >
              {copiedLink ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Invite Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Invite Link</span>
                </>
              )}
            </button>

            {canControlPlayback && onSwitchTitle && (
              <button
                type="button"
                onClick={() => setShowPicker((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-full vybe-glass-pill hover:border-vybe-accent px-3.5 py-2.5 text-xs font-semibold text-slate-300 hover:text-white transition"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-vybe-accentLight" />
                <span>{showPicker ? 'Close Title' : 'Change Title'}</span>
              </button>
            )}
          </div>

          {/* Collapsible Netflix Title Chooser / Link Input */}
          {showPicker && canControlPlayback && onSwitchTitle && (
            <div className="w-full rounded-2xl vybe-glass p-3.5 space-y-2.5 border border-white/15 text-left animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <span className="flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5 text-vybe-accentLight" />
                  <span>Paste Netflix Movie Link or ID</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal">
                  Changes title for everyone in the room
                </span>
              </div>

              <form onSubmit={handleLoadCustomTitle} className="flex items-center gap-2">
                <input
                  type="text"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  placeholder="https://netflix.com/watch/80057281 or ID"
                  className="flex-1 min-w-0 rounded-full bg-white/[0.05] border border-white/15 px-3.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-vybe-accent"
                />
                <button
                  type="submit"
                  className="rounded-full bg-vybe-accent hover:bg-vybe-accentLight px-4 py-1.5 text-xs font-bold text-white transition shrink-0"
                >
                  Load Title
                </button>
              </form>

              <div className="pt-1.5 border-t border-white/10 flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
                <span className="text-slate-400 text-[10px] shrink-0 mr-1">Quick Picks:</span>
                {SUPPORTED_NETFLIX_TITLES.slice(0, 4).map((item) => (
                  <button
                    key={item.watchId}
                    type="button"
                    onClick={() => {
                      onSwitchTitle(item.watchId, item.title, item.posterUrl);
                      setShowPicker(false);
                    }}
                    className="rounded-full vybe-glass-pill hover:border-vybe-accent px-2.5 py-1 text-[10px] text-slate-300 hover:text-white shrink-0 transition"
                  >
                    {item.title.split('—')[0].trim()}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Synchronized Transport Control Bar */}
      <div className="border-t border-white/[0.08] bg-[#0D0F18] px-3 py-2 flex items-center gap-2.5 shrink-0 z-20">
        <button
          type="button"
          onClick={authoritativeIsPlaying ? onPause : onPlay}
          disabled={!canControlPlayback}
          aria-label={authoritativeIsPlaying ? 'Pause' : 'Play'}
          className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-[#E50914] hover:bg-[#f6121d] disabled:opacity-50 text-white transition shrink-0 shadow-md"
        >
          {authoritativeIsPlaying ? (
            <Pause className="h-3.5 w-3.5 fill-current" />
          ) : (
            <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
          )}
        </button>

        <span className="text-[10px] sm:text-[11px] font-mono text-slate-300 shrink-0">
          {formatTimestamp(authoritativeTime)}
        </span>

        <input
          type="range"
          min={0}
          max={duration}
          step={1}
          value={Math.min(Math.max(authoritativeTime, 0), duration)}
          disabled={!canControlPlayback}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Playback seek slider"
          className="flex-1 min-w-0 h-1.5 rounded-lg accent-[#E50914] cursor-pointer disabled:opacity-50"
        />

        <span className="text-[10px] sm:text-[11px] font-mono text-slate-400 shrink-0">
          {formatTimestamp(duration)}
        </span>

        <button
          type="button"
          onClick={onRequestResync}
          className="inline-flex items-center gap-1 rounded-full vybe-glass-pill px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:text-white transition shrink-0"
          title="Re-fetch the room's authoritative playback position"
        >
          <RefreshCw className="h-3 w-3 text-rose-400" />
          <span className="hidden sm:inline">Manual Sync</span>
        </button>
      </div>
    </div>
  );
}
