'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  RefreshCw,
  Film,
  MonitorUp,
  FolderOpen,
  Link2,
  Tv,
  Youtube,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { PlaybackManager } from '@/lib/playback/playback-manager';
import { SyncEngine } from '@/lib/playback/sync-engine';
import {
  NormalizedPlaybackState,
  PlaybackProviderType,
  PlayerCapabilities,
} from '@/lib/playback/types';
import { formatTimestamp } from '@/lib/utils';
import { SUPPORTED_NETFLIX_TITLES, CURATED_YOUTUBE_VIDEOS } from '@/lib/constants';

interface TheaterStageProps {
  playbackManager: PlaybackManager;
  syncEngine: SyncEngine;
  roomCode: string;
  isHost: boolean;
  canControlPlayback: boolean;
  activePlatform: 'youtube' | 'netflix';
  activeVideoId: string;
  activeVideoTitle: string;
  activeVideoThumbnail?: string;
  onRequestResync: () => void;
  onSwitchMedia: (
    platform: 'youtube' | 'netflix',
    videoId: string,
    title: string,
    thumbnailUrl: string
  ) => void;
}

export function TheaterStage({
  playbackManager,
  syncEngine,
  roomCode,
  canControlPlayback,
  activePlatform,
  activeVideoId,
  activeVideoTitle,
  activeVideoThumbnail,
  onRequestResync,
  onSwitchMedia,
}: TheaterStageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [capabilities, setCapabilities] = useState<PlayerCapabilities>(
    playbackManager.getCapabilities()
  );
  const [playbackState, setPlaybackState] = useState<NormalizedPlaybackState | null>(null);

  const [showDrawer, setShowDrawer] = useState(false);
  const [directUrlInput, setDirectUrlInput] = useState('');
  const [localFileName, setLocalFileName] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    }
  }, []);

  // Mount active provider inside container
  useEffect(() => {
    if (!containerRef.current) return;

    let targetProviderType: PlaybackProviderType =
      activePlatform === 'netflix' ? 'netflix' : 'youtube';

    playbackManager
      .switchProvider(targetProviderType, {
        container: containerRef.current,
        initialMediaId: activeVideoId,
        initialTitle: activeVideoTitle,
        initialPosterUrl: activeVideoThumbnail,
        initialPlaying: false,
      })
      .then((provider) => {
        setCapabilities(provider.getCapabilities());
        setPlaybackState(provider.getState());
      })
      .catch((err) => {
        console.error('[TheaterStage] Provider init failed:', err);
      });

    const unsubscribe = playbackManager.subscribe((event) => {
      if (event.type === 'CAPABILITIES_CHANGED') {
        setCapabilities(event.capabilities);
      } else if (event.type === 'STATE_CHANGED') {
        setPlaybackState(event.state);
      } else if (event.type === 'TIME_UPDATE') {
        setPlaybackState((prev) =>
          prev
            ? {
                ...prev,
                currentTime: event.currentTime,
                duration: event.duration || prev.duration,
              }
            : null
        );
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activePlatform, activeVideoId, activeVideoTitle, activeVideoThumbnail, playbackManager]);

  const handleTogglePlay = async () => {
    if (!canControlPlayback || !playbackState) return;
    const nextPlaying = !playbackState.isPlaying;

    if (nextPlaying) {
      await playbackManager.play('user');
    } else {
      await playbackManager.pause('user');
    }

    syncEngine.handleUserAction({
      isPlaying: nextPlaying,
      currentTime: playbackState.currentTime,
      platform: activePlatform,
      videoId: activeVideoId,
      videoTitle: activeVideoTitle,
      videoThumbnail: activeVideoThumbnail,
    });
  };

  const handleSeek = async (nextTime: number) => {
    if (!canControlPlayback || !playbackState) return;

    await playbackManager.seek(nextTime, 'user');

    syncEngine.handleUserAction({
      isPlaying: playbackState.isPlaying,
      currentTime: nextTime,
      platform: activePlatform,
      videoId: activeVideoId,
      videoTitle: activeVideoTitle,
      videoThumbnail: activeVideoThumbnail,
    });
  };

  const handleSelectLocalFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !containerRef.current) return;

    setLocalFileName(file.name);
    setShowDrawer(false);

    const provider = await playbackManager.switchProvider('local_media', {
      container: containerRef.current,
      initialMediaId: `local-${file.name}`,
      initialTitle: file.name,
      localFile: file,
      initialPlaying: true,
    });

    setCapabilities(provider.getCapabilities());
    setPlaybackState(provider.getState());

    syncEngine.handleUserAction({
      isPlaying: true,
      currentTime: 0,
      platform: 'netflix',
      videoId: `local-${Date.now()}`,
      videoTitle: file.name,
    });
  };

  const handlePlayDirectUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = directUrlInput.trim();
    if (!url || !containerRef.current) return;

    setShowDrawer(false);
    setDirectUrlInput('');

    const provider = await playbackManager.switchProvider('local_media', {
      container: containerRef.current,
      initialMediaId: url,
      initialTitle: 'Custom Stream',
      customStreamUrl: url,
      initialPlaying: true,
    });

    setCapabilities(provider.getCapabilities());
    setPlaybackState(provider.getState());

    syncEngine.handleUserAction({
      isPlaying: true,
      currentTime: 0,
      platform: 'netflix',
      videoId: url,
      videoTitle: 'Direct Stream Video',
    });
  };

  const handleTabCast = async () => {
    const active = playbackManager.getActiveProvider();
    if (active && 'startTabCast' in active) {
      const ok = await (active as any).startTabCast();
      if (ok) setShowDrawer(false);
    }
  };

  const currentTime = playbackState?.currentTime || 0;
  const duration = Math.max(playbackState?.duration || 100, 100);
  const isPlaying = Boolean(playbackState?.isPlaying);
  const isMuted = Boolean(playbackState?.isMuted);

  return (
    <div className="relative flex flex-col w-full h-full bg-[#05060A] select-none">
      {/* Hidden File Picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,.mkv,.mp4,.webm"
        onChange={handleSelectLocalFile}
        className="hidden"
      />

      {/* Main Video Stage */}
      <div className="relative w-full aspect-video lg:aspect-auto lg:flex-1 overflow-hidden bg-black flex items-center justify-center">
        <div ref={containerRef} className="w-full h-full relative" />

        {/* Collapsible Source Drawer */}
        {showDrawer && (
          <div className="absolute inset-x-0 top-0 z-30 bg-[#0D0F18]/95 backdrop-blur-2xl border-b border-white/15 p-4 sm:p-5 space-y-4 shadow-2xl max-h-full overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Media Sources & File Loader</h3>
                <p className="text-[11px] text-slate-400">
                  Select a stream option or switch episode for everyone in the room:
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDrawer(false)}
                className="rounded-full bg-white/10 hover:bg-white/20 px-3 py-1 text-xs font-semibold text-slate-200 transition"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Option 1: Load Local File */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 flex flex-col justify-between space-y-2.5">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-vybe-accentLight">
                    <FolderOpen className="h-4 w-4" />
                    <span>1. Load Downloaded Movie (.mp4 / .mkv)</span>
                  </div>
                  <p className="text-[11px] text-slate-300/80 mt-1">
                    Play a video downloaded on your device with high quality and synchronized playback.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-vybe-accent hover:bg-vybe-accentLight px-3 py-2 text-xs font-bold text-white shadow-md transition"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  <span className="truncate">
                    {localFileName ? `Active: ${localFileName}` : 'Select .MP4 / .MKV'}
                  </span>
                </button>
              </div>

              {/* Option 2: Direct Video Link */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 flex flex-col justify-between space-y-2.5">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                    <Link2 className="h-4 w-4" />
                    <span>2. Direct Stream Link</span>
                  </div>
                  <p className="text-[11px] text-slate-300/80 mt-1">
                    Paste any direct .mp4, .m3u8, or cloud video link (Dropbox, R2, CDN).
                  </p>
                </div>
                <form
                  onSubmit={handlePlayDirectUrl}
                  className="flex items-center gap-1 rounded-full vybe-glass-pill px-2.5 py-1"
                >
                  <input
                    type="text"
                    value={directUrlInput}
                    onChange={(e) => setDirectUrlInput(e.target.value)}
                    placeholder="https://.../video.mp4"
                    className="flex-1 min-w-0 bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-full bg-emerald-500 hover:bg-emerald-400 px-3 py-1 text-[11px] font-bold text-black shrink-0 transition"
                  >
                    Play
                  </button>
                </form>
              </div>

              {/* Option 3: Cast Tab / Netflix */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 flex flex-col justify-between space-y-2.5">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                    <MonitorUp className="h-4 w-4" />
                    <span>3. Cast Tab / Netflix</span>
                  </div>
                  <p className="text-[11px] text-slate-300/80 mt-1">
                    Stream video & audio directly from a browser tab running Netflix or another player.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isMobile}
                    onClick={handleTabCast}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-full bg-rose-600 hover:bg-rose-500 disabled:opacity-40 px-3 py-2 text-xs font-bold text-white transition"
                  >
                    <MonitorUp className="h-3.5 w-3.5" />
                    <span>{isMobile ? 'Desktop Only' : 'Cast Tab'}</span>
                  </button>
                  <a
                    href={`https://www.netflix.com/watch/${activeVideoId}?vybeRoom=${encodeURIComponent(
                      roomCode
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1 rounded-full bg-white/10 hover:bg-white/20 px-3 py-2 text-xs font-semibold text-slate-200 transition"
                    title="Open Netflix in new tab"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>

            {/* Arcane Episode Quick-Switcher */}
            {activePlatform === 'netflix' && canControlPlayback && (
              <div className="pt-2 border-t border-white/10">
                <div className="text-[11px] font-semibold text-slate-400 mb-1.5">
                  Switch Arcane Episode (Season 1):
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {SUPPORTED_NETFLIX_TITLES.map((ep, i) => (
                    <button
                      key={ep.watchId}
                      type="button"
                      onClick={() => {
                        onSwitchMedia('netflix', ep.watchId, ep.title, ep.posterUrl);
                        setShowDrawer(false);
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 border text-[11px] shrink-0 transition ${
                        ep.watchId === activeVideoId
                          ? 'bg-[#E50914]/30 border-[#E50914] text-white font-bold'
                          : 'vybe-glass-pill text-slate-300 hover:text-white'
                      }`}
                    >
                      <Tv className="h-3 w-3 text-rose-400" />
                      <span>
                        Ep {i + 1}: {ep.title.split('—')[1]?.replace(/S1:E\d+\s*/, '').trim() || ep.title}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Synchronized Transport Control Bar */}
      <div className="border-t border-white/[0.08] bg-[#0D0F18] px-3 py-2 flex items-center gap-2.5 shrink-0">
        {capabilities.canPlay && (
          <button
            type="button"
            onClick={handleTogglePlay}
            disabled={!canControlPlayback}
            className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-[#E50914] hover:bg-[#f6121d] disabled:opacity-50 text-white transition shrink-0"
          >
            {isPlaying ? (
              <Pause className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
            )}
          </button>
        )}

        <span className="text-[10px] sm:text-[11px] font-mono text-slate-300 shrink-0">
          {formatTimestamp(currentTime)}
        </span>

        {/* Seek Bar */}
        <input
          type="range"
          min={0}
          max={duration}
          step={1}
          value={Math.min(currentTime, duration)}
          disabled={!canControlPlayback || !capabilities.canSeek}
          onChange={(e) => handleSeek(Number(e.target.value))}
          aria-label="Playback seek slider"
          className="flex-1 min-w-0 h-1.5 rounded-lg accent-[#E50914] cursor-pointer"
        />

        <span className="text-[10px] sm:text-[11px] font-mono text-slate-400 shrink-0">
          {formatTimestamp(duration)}
        </span>

        {/* Mute Button */}
        {capabilities.canSetVolume && (
          <button
            type="button"
            onClick={() => playbackManager.setMuted(!isMuted)}
            className="hidden sm:inline-flex rounded-full p-1 text-slate-300 hover:text-white"
          >
            {isMuted ? (
              <VolumeX className="h-3.5 w-3.5 text-rose-400" />
            ) : (
              <Volume2 className="h-3.5 w-3.5" />
            )}
          </button>
        )}

        {/* Sources & Episodes Drawer Trigger */}
        <button
          type="button"
          onClick={() => setShowDrawer((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full vybe-glass-pill hover:bg-white/[0.12] px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition shrink-0"
        >
          <Film className="h-3 w-3 text-rose-400" />
          <span>{showDrawer ? 'Hide' : 'Sources / File'}</span>
        </button>

        {/* Immediate Resync */}
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
