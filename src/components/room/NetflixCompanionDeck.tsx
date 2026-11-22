'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Tv,
  Play,
  Pause,
  RefreshCw,
  MonitorUp,
  MonitorOff,
  Film,
  FolderOpen,
  Link2,
  ExternalLink,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { SUPPORTED_NETFLIX_TITLES } from '@/lib/constants';
import {
  formatTimestamp,
  resolveNetflixMetadata,
} from '@/lib/utils';

type PlayerSourceMode = 'direct_player' | 'youtube_embed' | 'tab_cast';

// Pre-loaded playable video streams for each Arcane Episode out of the box
const ARCANE_YOUTUBE_STREAMS: Record<string, string> = {
  '81446667': '3jfI-z__GY0', // Ep 1: Welcome to the Playground
  '81446668': 'fXmAurh012s', // Ep 2: Official Arcane Cinema Cut
  '81446669': 'F5tOuijpFD0', // Ep 3: Enemy Animated Special
  '81446670': 'Mz4-38d3-AE', // Ep 4: Bridging the Rift Part 1 (25m Full Episode)
  '81446671': 'ek7T9G1_dec', // Ep 5: Bridging the Rift Part 2 (Full Episode)
  '81446672': 'b98Pr22aa4I', // Ep 6: Bridging the Rift Part 3 (Full Episode)
  '81446673': 'n_dce26425w', // Ep 7: Bridging the Rift Part 4 (Full Episode)
  '81446674': 'm230_645050', // Ep 8: Bridging the Rift Part 5 (Full Episode)
  '81446675': 'fXmAurh012s', // Ep 9: Season Finale Preview
};

const CUSTOM_STREAM_STORAGE_KEY = 'vybe_episode_custom_streams_v1';

interface NetflixCompanionDeckProps {
  roomCode: string;
  watchId: string;
  videoTitle: string;
  authoritativeIsPlaying: boolean;
  authoritativeTime: number;
  authoritativeUpdatedAt: number;
  canControlPlayback: boolean;
  onLocalPlaybackChange: (state: { isPlaying: boolean; currentTime: number }) => void;
  onLocalTimeReport: (currentTime: number, drift: number, extConnected: boolean) => void;
  onSelectNetflixTitle: (watchId: string, title: string, posterUrl: string) => void;
  onRequestResync: () => void;
}

export function NetflixCompanionDeck({
  roomCode,
  watchId,
  authoritativeIsPlaying,
  authoritativeTime,
  authoritativeUpdatedAt,
  canControlPlayback,
  onLocalPlaybackChange,
  onLocalTimeReport,
  onSelectNetflixTitle,
  onRequestResync,
}: NetflixCompanionDeckProps) {
  const titleMeta = resolveNetflixMetadata(watchId);

  // Check if user attached a custom .mp4/.m3u8 file URL to this episode
  const [customStreams, setCustomStreams] = useState<Record<string, string>>({});
  const [sourceMode, setSourceMode] = useState<PlayerSourceMode>('youtube_embed');
  const [localFileObjectUrl, setLocalFileObjectUrl] = useState<string | null>(null);
  const [localFileName, setLocalFileName] = useState<string | null>(null);

  const [showSourceDrawer, setShowSourceDrawer] = useState(false);
  const [directUrlInput, setDirectUrlInput] = useState('');

  const [localTime, setLocalTime] = useState<number>(authoritativeTime);
  const [localPlaying, setLocalPlaying] = useState<boolean>(authoritativeIsPlaying);
  const [duration, setDuration] = useState<number>(2580);
  const [isMuted, setIsMuted] = useState(false);

  // Live Tab Cast
  const [isCastingTab, setIsCastingTab] = useState(false);
  const castVideoRef = useRef<HTMLVideoElement | null>(null);
  const castStreamRef = useRef<MediaStream | null>(null);

  // Direct HTML5 Video Player (for local .mp4/.mkv files or direct .mp4/.m3u8 URLs)
  const html5VideoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isApplyingRemoteRef = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_STREAM_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setCustomStreams(parsed);
        if (parsed[watchId]) {
          setSourceMode('direct_player');
        }
      }
    } catch {
      // Ignore
    }
  }, [watchId]);

  const activeDirectVideoUrl =
    localFileObjectUrl ||
    customStreams[watchId] ||
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4';

  const activeYoutubeEmbedId =
    ARCANE_YOUTUBE_STREAMS[watchId] || 'Mz4-38d3-AE';

  // Sync authoritative playback state to HTML5 video player
  useEffect(() => {
    const elapsed = authoritativeIsPlaying
      ? Math.max(0, (Date.now() - authoritativeUpdatedAt) / 1000)
      : 0;
    const targetTime = authoritativeTime + elapsed;
    setLocalPlaying(authoritativeIsPlaying);
    setLocalTime(targetTime);

    if (html5VideoRef.current && sourceMode === 'direct_player') {
      const vid = html5VideoRef.current;
      isApplyingRemoteRef.current = true;
      if (Math.abs(vid.currentTime - targetTime) > 1.8) {
        vid.currentTime = Math.min(targetTime, vid.duration || targetTime);
      }
      if (authoritativeIsPlaying && vid.paused) {
        vid.play().catch(() => {});
      } else if (!authoritativeIsPlaying && !vid.paused) {
        vid.pause();
      }
      setTimeout(() => {
        isApplyingRemoteRef.current = false;
      }, 600);
    }
  }, [
    watchId,
    authoritativeIsPlaying,
    authoritativeTime,
    authoritativeUpdatedAt,
    sourceMode,
  ]);

  // Periodic drift calculation
  useEffect(() => {
    const timer = setInterval(() => {
      if (sourceMode === 'direct_player' && html5VideoRef.current) {
        const cur = html5VideoRef.current.currentTime || 0;
        const dur = html5VideoRef.current.duration || 2580;
        if (dur > 0) setDuration(dur);
        setLocalTime(cur);
        const elapsedAuth = authoritativeIsPlaying
          ? Math.max(0, (Date.now() - authoritativeUpdatedAt) / 1000)
          : 0;
        const expected = authoritativeTime + elapsedAuth;
        const drift = Number((cur - expected).toFixed(2));
        onLocalTimeReport(cur, drift, true);
        return;
      }

      setLocalTime((prev) => {
        const next = localPlaying ? prev + 0.5 : prev;
        const elapsedAuth = authoritativeIsPlaying
          ? Math.max(0, (Date.now() - authoritativeUpdatedAt) / 1000)
          : 0;
        const expected = authoritativeTime + elapsedAuth;
        const drift = Number((next - expected).toFixed(2));
        onLocalTimeReport(next, drift, true);
        return next;
      });
    }, 500);

    return () => clearInterval(timer);
  }, [
    sourceMode,
    localPlaying,
    authoritativeIsPlaying,
    authoritativeTime,
    authoritativeUpdatedAt,
    onLocalTimeReport,
  ]);

  // Load local .mp4 / .mkv / .webm video file from device
  const handleSelectLocalVideoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (localFileObjectUrl) {
      URL.revokeObjectURL(localFileObjectUrl);
    }
    const objUrl = URL.createObjectURL(file);
    setLocalFileObjectUrl(objUrl);
    setLocalFileName(file.name);
    setSourceMode('direct_player');
    setShowSourceDrawer(false);
  };

  // Attach a direct .mp4 / .m3u8 video URL to this episode
  const handleSaveDirectStreamUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const url = directUrlInput.trim();
    if (!url) return;
    const updated = { ...customStreams, [watchId]: url };
    setCustomStreams(updated);
    try {
      localStorage.setItem(CUSTOM_STREAM_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }
    setDirectUrlInput('');
    setSourceMode('direct_player');
    setShowSourceDrawer(false);
  };

  const handleStartTabCast = async () => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getDisplayMedia
    ) {
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 60, max: 60 } },
        audio: true,
      });
      castStreamRef.current = stream;
      setIsCastingTab(true);
      setSourceMode('tab_cast');
      setShowSourceDrawer(false);

      setTimeout(() => {
        if (castVideoRef.current) {
          castVideoRef.current.srcObject = stream;
          castVideoRef.current.play().catch(() => {});
        }
      }, 50);

      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        setIsCastingTab(false);
        castStreamRef.current = null;
      });
    } catch {
      // Cancelled
    }
  };

  const handleStopTabCast = () => {
    if (castStreamRef.current) {
      castStreamRef.current.getTracks().forEach((t) => t.stop());
      castStreamRef.current = null;
    }
    setIsCastingTab(false);
    setSourceMode('youtube_embed');
  };

  const handleTogglePlay = () => {
    if (!canControlPlayback) return;
    const nextPlaying = !localPlaying;
    setLocalPlaying(nextPlaying);

    if (sourceMode === 'direct_player' && html5VideoRef.current) {
      isApplyingRemoteRef.current = true;
      if (nextPlaying) html5VideoRef.current.play().catch(() => {});
      else html5VideoRef.current.pause();
      setTimeout(() => {
        isApplyingRemoteRef.current = false;
      }, 400);
    }

    onLocalPlaybackChange({
      isPlaying: nextPlaying,
      currentTime: localTime,
    });
  };

  const handleSeek = (nextTime: number) => {
    if (!canControlPlayback) return;
    setLocalTime(nextTime);
    if (sourceMode === 'direct_player' && html5VideoRef.current) {
      isApplyingRemoteRef.current = true;
      html5VideoRef.current.currentTime = nextTime;
      setTimeout(() => {
        isApplyingRemoteRef.current = false;
      }, 400);
    }
    onLocalPlaybackChange({
      isPlaying: localPlaying,
      currentTime: nextTime,
    });
  };

  return (
    <div className="relative flex flex-col w-full lg:h-full bg-[#05060A] select-none shrink-0 lg:shrink">
      {/*Hidden File Input for Local .mp4 / .mkv Movie Files */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,.mkv,.mp4,.webm"
        onChange={handleSelectLocalVideoFile}
        className="hidden"
      />

      {/* Main 16:9 Video Player Stage (Always Plays Video Immediately!) */}
      <div className="relative w-full aspect-video lg:aspect-auto lg:flex-1 overflow-hidden bg-black shrink-0">
        {sourceMode === 'youtube_embed' && (
          <iframe
            key={activeYoutubeEmbedId}
            src={`https://www.youtube.com/embed/${activeYoutubeEmbedId}?autoplay=1&controls=1&rel=0&modestbranding=1&playsinline=1`}
            title={titleMeta.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute inset-0 w-full h-full border-0"
          />
        )}

        {sourceMode === 'direct_player' && (
          <video
            ref={html5VideoRef}
            src={activeDirectVideoUrl}
            controls
            autoPlay
            playsInline
            muted={isMuted}
            className="absolute inset-0 w-full h-full object-contain bg-black"
            onPlay={() => {
              if (!isApplyingRemoteRef.current && canControlPlayback) {
                setLocalPlaying(true);
                onLocalPlaybackChange({
                  isPlaying: true,
                  currentTime: html5VideoRef.current?.currentTime || 0,
                });
              }
            }}
            onPause={() => {
              if (!isApplyingRemoteRef.current && canControlPlayback) {
                setLocalPlaying(false);
                onLocalPlaybackChange({
                  isPlaying: false,
                  currentTime: html5VideoRef.current?.currentTime || 0,
                });
              }
            }}
          />
        )}

        {sourceMode === 'tab_cast' && (
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            <video
              ref={castVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
            {isCastingTab && (
              <button
                type="button"
                onClick={handleStopTabCast}
                className="absolute top-3 right-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-rose-600/90 hover:bg-rose-600 px-3 py-1 text-xs font-bold text-white transition"
              >
                <MonitorOff className="h-3.5 w-3.5" />
                <span>Stop Tab Stream</span>
              </button>
            )}
          </div>
        )}

        {/* Slide-Down Episode & Video File Loader Drawer (Opens on "Episodes / Video File") */}
        {showSourceDrawer && (
          <div className="absolute inset-x-0 top-0 z-30 bg-[#0D0F18]/95 backdrop-blur-2xl border-b border-white/15 p-3.5 sm:p-4 space-y-3 shadow-2xl max-h-full overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-white">
                {titleMeta.title} — Video Source & Episodes
              </span>
              <button
                type="button"
                onClick={() => setShowSourceDrawer(false)}
                className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300 hover:text-white"
              >
                Close
              </button>
            </div>

            {/* 1. Load Local Downloaded Movie File (.mp4 / .mkv) or Paste Direct Video URL */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="sm:col-span-4 inline-flex items-center justify-center gap-1.5 rounded-full bg-vybe-accent hover:bg-vybe-accentLight px-3.5 py-2 text-xs font-bold text-white transition"
              >
                <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {localFileName ? `File: ${localFileName}` : 'Load .MP4 / .MKV File'}
                </span>
              </button>

              <form
                onSubmit={handleSaveDirectStreamUrl}
                className="sm:col-span-5 flex items-center gap-1.5 rounded-full vybe-glass-pill px-3 py-1"
              >
                <Link2 className="h-3.5 w-3.5 text-vybe-accentLight shrink-0" />
                <input
                  type="text"
                  value={directUrlInput}
                  onChange={(e) => setDirectUrlInput(e.target.value)}
                  placeholder="Or paste direct .mp4 / .m3u8 video link"
                  className="flex-1 min-w-0 bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-full bg-white/15 hover:bg-white/25 px-2.5 py-1 text-[10px] font-bold text-white shrink-0"
                >
                  Play URL
                </button>
              </form>

              <div className="sm:col-span-3 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleStartTabCast}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-full vybe-glass-pill hover:bg-white/10 px-2.5 py-2 text-[11px] font-semibold text-slate-200"
                  title="Cast another browser tab into this player"
                >
                  <MonitorUp className="h-3.5 w-3.5 text-rose-400" />
                  <span>Cast Tab</span>
                </button>
                <a
                  href={`https://www.netflix.com/watch/${watchId}?vybeRoom=${encodeURIComponent(
                    roomCode
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1 rounded-full bg-[#E50914]/25 border border-[#E50914]/50 px-2.5 py-2 text-[11px] font-bold text-rose-200"
                  title="Open this episode on Netflix.com"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Netflix</span>
                </a>
              </div>
            </div>

            {/* 2. Switch Arcane Episodes (S1:E1 – S1:E9) */}
            {canControlPlayback && (
              <div>
                <div className="text-[11px] font-semibold text-slate-400 mb-1.5">
                  Switch Arcane Season 1 Episode:
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {SUPPORTED_NETFLIX_TITLES.map((ep, i) => (
                    <button
                      key={ep.watchId}
                      type="button"
                      onClick={() => {
                        onSelectNetflixTitle(ep.watchId, ep.title, ep.posterUrl);
                        setShowSourceDrawer(false);
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 border text-[11px] shrink-0 transition ${
                        ep.watchId === watchId
                          ? 'bg-[#E50914]/30 border-[#E50914] text-white font-bold'
                          : 'vybe-glass-pill text-slate-300 hover:text-white'
                      }`}
                    >
                      <Tv className="h-3 w-3 text-rose-400" />
                      <span>Ep {i + 1}: {ep.title.split('—')[1]?.replace(/S1:E\d+\s*/, '').trim() || ep.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Single Compact Bottom Synchronized Transport Bar */}
      <div className="border-t border-white/[0.08] bg-[#0D0F18] px-3 py-2 flex items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={handleTogglePlay}
          disabled={!canControlPlayback}
          className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-[#E50914] hover:bg-[#f6121d] disabled:opacity-50 text-white transition shrink-0"
        >
          {localPlaying ? (
            <Pause className="h-3.5 w-3.5 fill-current" />
          ) : (
            <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
          )}
        </button>

        <span className="text-[10px] sm:text-[11px] font-mono text-slate-300 shrink-0">
          {formatTimestamp(localTime)}
        </span>

        <input
          type="range"
          min={0}
          max={Math.max(duration, 100)}
          step={1}
          value={Math.min(localTime, Math.max(duration, 100))}
          disabled={!canControlPlayback}
          onChange={(e) => handleSeek(Number(e.target.value))}
          aria-label="Playback seek slider"
          className="flex-1 min-w-0 h-1.5 rounded-lg accent-[#E50914] cursor-pointer"
        />

        <span className="text-[10px] sm:text-[11px] font-mono text-slate-400 shrink-0">
          {formatTimestamp(duration)}
        </span>

        <button
          type="button"
          onClick={() => setIsMuted((m) => !m)}
          className="hidden sm:inline-flex rounded-full p-1 text-slate-300 hover:text-white"
        >
          {isMuted ? (
            <VolumeX className="h-3.5 w-3.5 text-rose-400" />
          ) : (
            <Volume2 className="h-3.5 w-3.5" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setShowSourceDrawer((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full vybe-glass-pill hover:bg-white/[0.12] px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition shrink-0"
        >
          <Film className="h-3 w-3 text-rose-400" />
          <span>{showSourceDrawer ? 'Hide' : 'Episodes / File'}</span>
        </button>

        <button
          type="button"
          onClick={onRequestResync}
          className="inline-flex items-center gap-1 rounded-full vybe-glass-pill px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:text-white transition shrink-0"
        >
          <RefreshCw className="h-3 w-3 text-rose-400" />
          <span className="hidden sm:inline">Resync</span>
        </button>
      </div>
    </div>
  );
}
