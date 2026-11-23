'use client';

import React, { useEffect, useState } from 'react';
import { ExternalLink, Play, Pause, RefreshCw, Tv, CircleAlert } from 'lucide-react';
import { resolveNetflixMetadata, formatTimestamp } from '@/lib/utils';

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
}

export function NetflixCompanionDeck({
  roomCode,
  watchId,
  videoTitle,
  posterUrl,
  authoritativeIsPlaying,
  authoritativeTime,
  authoritativeBuffering,
  duration: authoritativeDuration,
  canControlPlayback,
  onPlay,
  onPause,
  onSeek,
  onRequestResync,
}: NetflixCompanionDeckProps) {
  const meta = watchId ? resolveNetflixMetadata(watchId) : null;
  const title = videoTitle || meta?.title || 'Netflix Watch Party';
  const poster = posterUrl || meta?.posterUrl;
  const duration = Math.max(authoritativeDuration || 0, 100);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    }
  }, []);

  const openNetflix = () => {
    const id = watchId || '';
    if (typeof window !== 'undefined') {
      window.open(`https://netflix.com/watch/${id}?vybeRoom=${encodeURIComponent(roomCode)}`, '_blank', 'noopener');
    }
  };

  const controlHint = !canControlPlayback ? 'Only hosts can control playback here.' : null;

  return (
    <div className="relative flex flex-col w-full lg:h-full bg-[#05060A] select-none shrink-0 lg:shrink overflow-hidden">
      {/* Main Netflix Display — title, poster & instructions */}
      <div className="relative w-full aspect-video lg:aspect-auto lg:flex-1 overflow-hidden bg-black flex flex-col items-center justify-center p-4 sm:p-8">
        {poster && (
          <img
            src={poster}
            alt={title}
            className="h-56 sm:h-64 w-auto max-w-full rounded-xl sm:rounded-2xl border border-white/10 shadow-2xl object-contain"
          />
        )}

        <h2 className="mt-4 sm:mt-5 px-4 text-xl sm:text-2xl font-bold text-white tracking-tight text-center">
          {title}
        </h2>

        <div className="mt-1.5 px-4 text-[11px] sm:text-xs text-slate-400 text-center">
          {meta ? `${meta.year} • ${meta.genre} • ${meta.durationLabel}` : 'Exclusive Netflix title'}
        </div>

        {watchId && (
          <div className="mt-1.5 px-4 font-mono text-[10px] sm:text-xs text-slate-400 text-center">
            Netflix title #{watchId}
          </div>
        )}

        {!watchId && (
          <div className="mt-1.5 px-4 font-mono text-[10px] sm:text-xs text-amber-400 text-center">
            Waiting for Netflix playback detection…
          </div>
        )}
      </div>

      {/* Netflix Access & Instructions */}
      <div className="border-t border-white/[0.08] bg-[#0D0F18] px-3 py-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Tv className="h-3.5 w-3.5 text-rose-400" />
            <span>Watch Together on Netflix</span>
          </div>
          <button
            type="button"
            onClick={openNetflix}
            className="inline-flex items-center gap-1 rounded-full bg-rose-600 hover:bg-rose-500 px-3 py-1.5 text-xs font-bold text-white transition"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Open Netflix.com</span>
          </button>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Each viewer plays the same Netflix title through their own account. The VYBE Chrome extension
          keeps play, pause, and seek in sync across the room.
        </p>

        {authoritativeBuffering && (
          <p className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
            <CircleAlert className="h-3.5 w-3.5" />
            <span>Someone is buffering — watching position will sync when playback resumes.</span>
          </p>
        )}

        {controlHint && (
          <p className="text-[11px] text-amber-300/90">{controlHint}</p>
        )}

        {isMobile && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/25 px-2.5 py-2 text-[11px] text-amber-200 leading-relaxed">
            <CircleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Mobile web: we can&rsquo;t control the Netflix mobile app. Open Netflix.com on your device
              and use the transport bar below to stay in sync.
            </span>
          </div>
        )}
      </div>

      {/* Bottom Bar: Play/Pause, Seek, Resync */}
      <div className="border-t border-white/[0.08] bg-[#0D0F18] px-3 py-2 flex items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={authoritativeIsPlaying ? onPause : onPlay}
          disabled={!canControlPlayback}
          aria-label={authoritativeIsPlaying ? 'Pause' : 'Play'}
          className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-[#E50914] hover:bg-[#f6121d] disabled:opacity-50 text-white transition shrink-0"
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
