'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Loader2,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RefreshCw,
  Link2,
  Film,
  X,
} from 'lucide-react';
import {
  extractYouTubeId,
  fetchYouTubeMetadata,
  formatTimestamp,
} from '@/lib/utils';
import { CURATED_YOUTUBE_VIDEOS } from '@/lib/constants';

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
  onSwitchYouTubeVideo?: (videoId: string, title: string, thumbnailUrl: string) => void;
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
  onSwitchYouTubeVideo,
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

  // Clean collapsible Change Video Drawer
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [switchingVideo, setSwitchingVideo] = useState(false);

  const lockRemoteGuard = (ms = 850) => {
    isApplyingRemoteRef.current = true;
    if (remoteLockTimeoutRef.current) {
      clearTimeout(remoteLockTimeoutRef.current);
    }
    remoteLockTimeoutRef.current = setTimeout(() => {
      isApplyingRemoteRef.current = false;
    }, ms);
  };

  useEffect(() => {
    let isMounted = true;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const initPlayer = () => {
      if (!isMounted || !containerRef.current || !window.YT?.Player) return;
      if (playerRef.current) return;

      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }

      const mountTarget = document.createElement('div');
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(mountTarget);
      loadedVideoIdRef.current = videoId;

      playerRef.current = new window.YT.Player(mountTarget, {
        videoId,
        playerVars: {
          autoplay: authoritativeIsPlaying ? 1 : 0,
          controls: 1,
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

            lockRemoteGuard(1000);
            const elapsed = authoritativeIsPlaying
              ? Math.max(0, (Date.now() - authoritativeUpdatedAt) / 1000)
              : 0;
            const targetTime = authoritativeTime + elapsed;
            if (targetTime > 1) {
              event.target.seekTo(targetTime, true);
            }
            if (authoritativeIsPlaying) {
              event.target.playVideo();
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
              setIsBuffering(true);
              return;
            }
            setIsBuffering(false);

            if (state === 0) {
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
              'This YouTube video restricts embedded playback. Tap "Change Video" below to paste another link or pick a film.'
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
      pollTimer = setInterval(() => {
        if (window.YT && window.YT.Player) {
          initPlayer();
        }
      }, 120);
    }

    return () => {
      isMounted = false;
      if (pollTimer) clearInterval(pollTimer);
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

  useEffect(() => {
    if (!isReady || !playerRef.current) return;
    if (loadedVideoIdRef.current !== videoId) {
      loadedVideoIdRef.current = videoId;
      setPlayerError(null);
      lockRemoteGuard(1100);
      try {
        playerRef.current.loadVideoById(videoId, Math.floor(authoritativeTime || 0));
        setLocalCurrentTime(authoritativeTime || 0);
        setLocalIsPlaying(true);
      } catch {
        // Ignore
      }
    }
  }, [videoId, isReady, authoritativeTime]);

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
        // Ignore
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
          // Ignore
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

  const handleLoadYouTubeInput = async (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);
    const ytId = extractYouTubeId(urlInput);
    if (!ytId) {
      setUrlError('Paste a valid YouTube link or 11-character video ID.');
      return;
    }
    setSwitchingVideo(true);
    try {
      const meta = await fetchYouTubeMetadata(ytId);
      if (onSwitchYouTubeVideo) {
        onSwitchYouTubeVideo(ytId, meta.title, meta.thumbnailUrl);
      }
      setUrlInput('');
      setShowMediaPicker(false);
    } finally {
      setSwitchingVideo(false);
    }
  };

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
    <div className="relative flex flex-col w-full lg:h-full bg-[#05060A] select-none shrink-0 lg:shrink">
      {/* Clean 16:9 Video Screen on Mobile, Full Stage on Desktop */}
      <div className="relative w-full aspect-video lg:aspect-auto lg:flex-1 overflow-hidden bg-black shrink-0">
        <div
          ref={containerRef}
          className="absolute inset-0 w-full h-full [&>iframe]:w-full [&>iframe]:h-full"
        />

        {/* Loading / Buffering Overlay */}
        {(!isReady || isBuffering) && !playerError && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/45 backdrop-blur-[2px] z-10">
            <Loader2 className="h-7 w-7 text-vybe-accentLight animate-spin" />
            <span className="mt-2 text-xs font-medium text-slate-300">
              {isBuffering ? 'Synchronizing buffer...' : 'Loading YouTube Player...'}
            </span>
          </div>
        )}

        {/* Error Overlay */}
        {playerError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#07080D]/95 p-4 text-center z-20 space-y-2.5">
            <p className="max-w-md text-xs text-rose-300 leading-relaxed">
              {playerError}
            </p>
            {canControlPlayback && (
              <button
                type="button"
                onClick={() => setShowMediaPicker(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-vybe-accent px-4 py-1.5 text-xs font-bold text-white"
              >
                <Film className="h-3.5 w-3.5" />
                <span>Choose Another Video</span>
              </button>
            )}
          </div>
        )}

        {/* Slide-Over Media Picker Drawer (Only open when user taps "Change Video") */}
        {showMediaPicker && canControlPlayback && (
          <div className="absolute inset-x-0 top-0 z-30 bg-[#0D0F18]/95 backdrop-blur-2xl border-b border-white/15 p-3 sm:p-4 space-y-2.5 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">
                Load YouTube Video or Choose Film
              </span>
              <button
                type="button"
                onClick={() => setShowMediaPicker(false)}
                className="rounded-full p-1 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleLoadYouTubeInput}
              className="flex items-center gap-2 rounded-full vybe-glass-pill px-3 py-1"
            >
              <Link2 className="h-3.5 w-3.5 text-vybe-accentLight shrink-0" />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  if (urlError) setUrlError(null);
                }}
                placeholder="Paste YouTube URL (https://youtube.com/watch?v=...)"
                className="flex-1 min-w-0 bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none py-1"
              />
              <button
                type="submit"
                disabled={switchingVideo || !urlInput.trim()}
                className="rounded-full bg-vybe-accent hover:bg-vybe-accentLight disabled:opacity-40 px-3.5 py-1 text-[11px] font-bold text-white transition shrink-0"
              >
                {switchingVideo ? 'Loading...' : 'Play'}
              </button>
            </form>

            {urlError && (
              <div className="text-[11px] text-rose-300 px-2">{urlError}</div>
            )}

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {CURATED_YOUTUBE_VIDEOS.map((vid) => (
                <button
                  key={vid.videoId}
                  type="button"
                  onClick={() => {
                    if (onSwitchYouTubeVideo) {
                      onSwitchYouTubeVideo(
                        vid.videoId,
                        vid.title,
                        vid.thumbnailUrl
                      );
                    }
                    setShowMediaPicker(false);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full pl-1.5 pr-3 py-1 border text-[11px] shrink-0 transition ${
                    vid.videoId === videoId
                      ? 'bg-vybe-accent/25 border-vybe-accent text-white font-bold'
                      : 'vybe-glass-pill text-slate-300 hover:text-white'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={vid.thumbnailUrl}
                    alt={vid.title}
                    className="h-4 w-4 rounded-full object-cover"
                  />
                  <span>{vid.title.split('—')[0].trim()}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Compact Bottom Synchronized Transport Bar */}
      <div className="border-t border-white/[0.08] bg-[#0D0F18] px-3 py-2 flex flex-col gap-1.5 shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleTogglePlay}
            disabled={!canControlPlayback}
            aria-label={localIsPlaying ? 'Pause' : 'Play'}
            className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-vybe-accent hover:bg-vybe-accentLight disabled:opacity-50 text-white transition shrink-0"
          >
            {localIsPlaying ? (
              <Pause className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
            )}
          </button>

          <span className="text-[10px] sm:text-[11px] font-mono text-slate-300 shrink-0">
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
            className={`flex-1 min-w-0 h-1.5 rounded-lg accent-vybe-accent ${
              canControlPlayback ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
            }`}
          />

          <span className="text-[10px] sm:text-[11px] font-mono text-slate-400 shrink-0">
            {formatTimestamp(duration)}
          </span>

          <div className="hidden sm:flex items-center gap-1">
            <button
              type="button"
              onClick={handleToggleMute}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              className="rounded-full p-1 text-slate-300 hover:bg-white/5 hover:text-white transition"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-3.5 w-3.5 text-rose-400" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              aria-label="Volume"
              className="w-16 h-1 accent-vybe-accent"
            />
          </div>

          {canControlPlayback && (
            <button
              type="button"
              onClick={() => setShowMediaPicker((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full vybe-glass-pill hover:bg-white/[0.1] px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition shrink-0"
            >
              <Film className="h-3 w-3 text-vybe-accentLight" />
              <span className="hidden xs:inline">Change Video</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRequestResync}
            className="inline-flex items-center gap-1 rounded-full vybe-glass-pill px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:text-white transition shrink-0"
            title="Resync Player"
          >
            <RefreshCw className="h-3 w-3 text-vybe-accentLight" />
            <span className="hidden sm:inline">Resync</span>
          </button>
        </div>
      </div>
    </div>
  );
}
