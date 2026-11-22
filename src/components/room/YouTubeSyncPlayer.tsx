'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Volume2, VolumeX, Play, Pause, RefreshCw } from 'lucide-react';
import { formatTimestamp } from '@/lib/utils';

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT?: {
      Player: new (
        element: HTMLElement | string,
        options: {
          videoId: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (event: { target: YTPlayerInstance }) => void;
            onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayerInstance;
      PlayerState?: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
  }
}

export interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  loadVideoById: (videoId: string, startSeconds?: number) => void;
  cueVideoById: (videoId: string, startSeconds?: number) => void;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  getVideoData?: () => { title?: string; video_id?: string };
  destroy: () => void;
}

interface YouTubeSyncPlayerProps {
  videoId: string;
  videoTitle: string;
  authoritativeIsPlaying: boolean;
  authoritativeTime: number;
  authoritativeUpdatedAt: number;
  authoritativeSeq: number;
  canControlPlayback: boolean;
  autoSyncThresholdSec: number;
  onLocalPlaybackChange: (state: { isPlaying: boolean; currentTime: number }) => void;
  onLocalTimeReport: (currentTime: number, drift: number) => void;
  onVideoEnded: () => void;
  onRequestResync: () => void;
  onVideoTitleDetected?: (title: string) => void;
}

export function YouTubeSyncPlayer({
  videoId,
  videoTitle,
  authoritativeIsPlaying,
  authoritativeTime,
  authoritativeUpdatedAt,
  authoritativeSeq,
  canControlPlayback,
  autoSyncThresholdSec,
  onLocalPlaybackChange,
  onLocalTimeReport,
  onVideoEnded,
  onRequestResync,
  onVideoTitleDetected,
}: YouTubeSyncPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const isApplyingRemoteRef = useRef<boolean>(false);
  const remoteLockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAppliedSeqRef = useRef<number>(0);
  const loadedVideoIdRef = useRef<string>(videoId);

  const [isReady, setIsReady] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [localIsPlaying, setLocalIsPlaying] = useState(false);
  const [localCurrentTime, setLocalCurrentTime] = useState(authoritativeTime);
  const [duration, setDuration] = useState(600);
  const [volume, setVolume] = useState(85);
  const [isMuted, setIsMuted] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const lockRemoteGuard = (ms = 850) => {
    isApplyingRemoteRef.current = true;
    if (remoteLockTimeoutRef.current) {
      clearTimeout(remoteLockTimeoutRef.current);
    }
    remoteLockTimeoutRef.current = setTimeout(() => {
      isApplyingRemoteRef.current = false;
    }, ms);
  };

  // Load Official YouTube IFrame API script
  useEffect(() => {
    let isMounted = true;

    const initPlayer = () => {
      if (!isMounted || !containerRef.current || !window.YT?.Player) return;
      if (playerRef.current) return;

      const mountTarget = document.createElement('div');
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(mountTarget);

      playerRef.current = new window.YT.Player(mountTarget, {
        videoId,
        playerVars: {
          autoplay: authoritativeIsPlaying ? 1 : 0,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
          iv_load_policy: 3,
          start: Math.floor(authoritativeTime || 0),
        },
        events: {
          onReady: (event) => {
            if (!isMounted) return;
            setIsReady(true);
            setPlayerError(null);
            const dur = event.target.getDuration?.() || 600;
            if (dur > 0) setDuration(dur);

            const detectedTitle = event.target.getVideoData?.()?.title;
            if (detectedTitle && onVideoTitleDetected) {
              onVideoTitleDetected(detectedTitle);
            }

            // Apply initial authoritative state
            lockRemoteGuard(1000);
            const elapsed = authoritativeIsPlaying
              ? Math.max(0, (Date.now() - authoritativeUpdatedAt) / 1000)
              : 0;
            const targetTime = authoritativeTime + elapsed;
            event.target.seekTo(targetTime, true);
            if (authoritativeIsPlaying) {
              event.target.playVideo();
            } else {
              event.target.pauseVideo();
            }
          },
          onStateChange: (event) => {
            if (!isMounted) return;
            const state = event.data;
            const dur = event.target.getDuration?.() || 0;
            if (dur > 0) setDuration(dur);

            const detectedTitle = event.target.getVideoData?.()?.title;
            if (detectedTitle && onVideoTitleDetected) {
              onVideoTitleDetected(detectedTitle);
            }

            if (state === 3) {
              // BUFFERING
              setIsBuffering(true);
              return;
            }
            setIsBuffering(false);

            if (state === 0) {
              // ENDED
              setLocalIsPlaying(false);
              onVideoEnded();
              return;
            }

            const nowPlaying = state === 1;
            const nowPaused = state === 2;
            if (nowPlaying || nowPaused) {
              setLocalIsPlaying(nowPlaying);
              const cur = event.target.getCurrentTime?.() || 0;
              setLocalCurrentTime(cur);

              if (!isApplyingRemoteRef.current && canControlPlayback) {
                onLocalPlaybackChange({
                  isPlaying: nowPlaying,
                  currentTime: cur,
                });
              }
            }
          },
          onError: () => {
            if (!isMounted) return;
            setPlayerError(
              'This YouTube video restricts embedded playback or could not be loaded. Try switching to another YouTube URL or 4K Open Film.'
            );
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const existingScript = document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]'
      );
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        initPlayer();
      };
    }

    return () => {
      isMounted = false;
      if (remoteLockTimeoutRef.current) {
        clearTimeout(remoteLockTimeoutRef.current);
      }
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch {
          // Ignore teardown error
        }
        playerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle videoId changes without leaving the room
  useEffect(() => {
    if (!isReady || !playerRef.current) return;
    if (loadedVideoIdRef.current !== videoId) {
      loadedVideoIdRef.current = videoId;
      setPlayerError(null);
      lockRemoteGuard(1100);
      try {
        if (authoritativeIsPlaying) {
          playerRef.current.loadVideoById(videoId, Math.floor(authoritativeTime || 0));
        } else {
          playerRef.current.cueVideoById(videoId, Math.floor(authoritativeTime || 0));
        }
        setLocalCurrentTime(authoritativeTime || 0);
      } catch {
        // Fallback if player not ready
      }
    }
  }, [videoId, isReady, authoritativeIsPlaying, authoritativeTime]);

  // Apply authoritative remote playback updates (play, pause, seek, drift correction)
  useEffect(() => {
    const player = playerRef.current;
    if (!isReady || !player) return;

    const elapsed = authoritativeIsPlaying
      ? Math.max(0, (Date.now() - authoritativeUpdatedAt) / 1000)
      : 0;
    const projectedAuthoritativeTime = authoritativeTime + elapsed;

    let currentPlayerTime = localCurrentTime;
    try {
      currentPlayerTime = player.getCurrentTime?.() ?? localCurrentTime;
    } catch {
      // Ignore
    }

    const drift = Math.abs(currentPlayerTime - projectedAuthoritativeTime);
    const seqAdvanced = authoritativeSeq !== lastAppliedSeqRef.current;
    lastAppliedSeqRef.current = authoritativeSeq;

    if (seqAdvanced || drift > autoSyncThresholdSec) {
      lockRemoteGuard(900);
      try {
        if (drift > Math.min(1.5, autoSyncThresholdSec)) {
          player.seekTo(projectedAuthoritativeTime, true);
          setLocalCurrentTime(projectedAuthoritativeTime);
        }
        const playerState = player.getPlayerState?.();
        if (authoritativeIsPlaying && playerState !== 1) {
          player.playVideo();
          setLocalIsPlaying(true);
        } else if (!authoritativeIsPlaying && playerState === 1) {
          player.pauseVideo();
          setLocalIsPlaying(false);
        }
      } catch {
        // Ignore transient YT API error
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isReady,
    authoritativeIsPlaying,
    authoritativeTime,
    authoritativeUpdatedAt,
    authoritativeSeq,
    autoSyncThresholdSec,
  ]);

  // Periodic time & drift ticker (every 500ms)
  useEffect(() => {
    const timer = setInterval(() => {
      const player = playerRef.current;
      let cur = localCurrentTime;
      if (isReady && player && typeof player.getCurrentTime === 'function') {
        try {
          cur = player.getCurrentTime() || 0;
          const dur = player.getDuration?.() || 0;
          if (dur > 0) setDuration(dur);
          const pState = player.getPlayerState?.();
          if (pState === 1 || pState === 2) {
            setLocalIsPlaying(pState === 1);
          }
        } catch {
          // Fallback to simulated clock if YT iframe blocked in headless env
        }
      } else if (authoritativeIsPlaying) {
        const elapsed = Math.max(0, (Date.now() - authoritativeUpdatedAt) / 1000);
        cur = authoritativeTime + elapsed;
      }

      setLocalCurrentTime(cur);
      const elapsedAuth = authoritativeIsPlaying
        ? Math.max(0, (Date.now() - authoritativeUpdatedAt) / 1000)
        : 0;
      const expected = authoritativeTime + elapsedAuth;
      const drift = Number((cur - expected).toFixed(2));
      onLocalTimeReport(cur, drift);
    }, 500);

    return () => clearInterval(timer);
  }, [
    isReady,
    localCurrentTime,
    authoritativeIsPlaying,
    authoritativeTime,
    authoritativeUpdatedAt,
    onLocalTimeReport,
  ]);

  const handleTogglePlay = () => {
    if (!canControlPlayback) {
      onRequestResync();
      return;
    }
    const nextPlaying = !localIsPlaying;
    setLocalIsPlaying(nextPlaying);
    const player = playerRef.current;
    let cur = localCurrentTime;
    if (isReady && player) {
      try {
        cur = player.getCurrentTime() || localCurrentTime;
        lockRemoteGuard(600);
        if (nextPlaying) {
          player.playVideo();
        } else {
          player.pauseVideo();
        }
      } catch {
        // Ignore
      }
    }
    onLocalPlaybackChange({
      isPlaying: nextPlaying,
      currentTime: cur,
    });
  };

  const handleSeek = (nextTime: number) => {
    if (!canControlPlayback) return;
    setLocalCurrentTime(nextTime);
    const player = playerRef.current;
    if (isReady && player) {
      try {
        lockRemoteGuard(700);
        player.seekTo(nextTime, true);
      } catch {
        // Ignore
      }
    }
    onLocalPlaybackChange({
      isPlaying: localIsPlaying,
      currentTime: nextTime,
    });
  };

  const handleToggleMute = () => {
    const player = playerRef.current;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (isReady && player) {
      try {
        if (nextMuted) player.mute();
        else player.unMute();
      } catch {
        // Ignore
      }
    }
  };

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    setIsMuted(val === 0);
    const player = playerRef.current;
    if (isReady && player) {
      try {
        player.setVolume(val);
        if (val > 0 && player.isMuted()) player.unMute();
      } catch {
        // Ignore
      }
    }
  };

  return (
    <div className="relative flex flex-col w-full h-full bg-[#05060A] select-none">
      {/* Main 16:9 / Flexible Video Stage */}
      <div className="relative flex-1 w-full min-h-[260px] sm:min-h-[380px] overflow-hidden bg-black">
        <div
          ref={containerRef}
          className="absolute inset-0 w-full h-full [&>iframe]:w-full [&>iframe]:h-full"
        />

        {/* Loading / Buffering Overlay */}
        {(!isReady || isBuffering) && !playerError && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-[2px] z-10">
            <Loader2 className="h-9 w-9 text-vybe-accentLight animate-spin" />
            <span className="mt-2 text-xs font-medium text-slate-300">
              {isBuffering ? 'Synchronizing buffer...' : 'Loading YouTube 4K IFrame Player...'}
            </span>
          </div>
        )}

        {/* Error Overlay */}
        {playerError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#07080D]/95 p-6 text-center z-20">
            <p className="max-w-md text-xs sm:text-sm text-rose-300 leading-relaxed">
              {playerError}
            </p>
          </div>
        )}

        {/* Top-left subtle title watermark */}
        <div className="pointer-events-none absolute top-3 left-3 z-10 flex items-center gap-2 rounded-xl bg-[#07080D]/80 backdrop-blur-md border border-white/10 px-3 py-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-xs font-semibold text-white truncate max-w-[240px] sm:max-w-md">
            {videoTitle}
          </span>
        </div>
      </div>

      {/* Bottom Synchronized Transport Bar */}
      <div className="border-t border-white/[0.08] bg-[#0D0F18] px-4 py-2.5 flex flex-col gap-2">
        {/* Interactive Seek Scrubber */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-slate-300 w-11 text-right">
            {formatTimestamp(localCurrentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(duration, 1)}
            step={1}
            value={Math.min(localCurrentTime, Math.max(duration, 1))}
            disabled={!canControlPlayback}
            onChange={(e) => handleSeek(Number(e.target.value))}
            aria-label="Playback seek slider"
            className={`flex-1 h-1.5 rounded-lg accent-vybe-accent ${
              canControlPlayback ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
            }`}
          />
          <span className="text-[11px] font-mono text-slate-400 w-11">
            {formatTimestamp(duration)}
          </span>
        </div>

        {/* Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleTogglePlay}
              disabled={!canControlPlayback}
              aria-label={localIsPlaying ? 'Pause' : 'Play'}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-vybe-accent hover:bg-vybe-accentLight disabled:opacity-50 text-white transition"
            >
              {localIsPlaying ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="h-4 w-4 fill-current ml-0.5" />
              )}
            </button>

            {/* Volume */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleToggleMute}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                className="rounded-lg p-1.5 text-slate-300 hover:bg-white/5 hover:text-white transition"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4 text-rose-400" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                aria-label="Volume"
                className="w-20 h-1 accent-vybe-accent hidden sm:block"
              />
            </div>

            {!canControlPlayback && (
              <span className="text-[11px] text-slate-400 bg-white/5 rounded-lg px-2.5 py-1">
                Host controls playback
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRequestResync}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#161A2B] hover:bg-[#1E243B] border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 transition"
              title="Synchronize your player timestamp to the room's authoritative playback clock"
            >
              <RefreshCw className="h-3.5 w-3.5 text-vybe-accentLight" />
              <span>Resync Player</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
