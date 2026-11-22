'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Tv,
  Chrome,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  RefreshCw,
  MonitorUp,
  MonitorOff,
  Film,
  Search,
  LogIn,
  Sparkles,
} from 'lucide-react';
import { SUPPORTED_NETFLIX_TITLES } from '@/lib/constants';
import {
  extractNetflixWatchId,
  formatTimestamp,
  resolveNetflixMetadata,
} from '@/lib/utils';
import { GlowButton } from '@/components/ui/AceternityPrimitives';

export type ExtensionBridgeState =
  | 'connected_watching'
  | 'connected_idle'
  | 'unsupported_page'
  | 'disconnected';

type NetflixViewingMode = 'tab_cast' | 'extension_popup' | 'preview_player';

const NETFLIX_PREVIEW_STREAMS: Record<string, string> = {
  '80057281': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
  '80100172': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
  '81040344': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  '80200575': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  '81231974': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
};

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

  const [viewingMode, setViewingMode] = useState<NetflixViewingMode>('tab_cast');
  const [bridgeStatus, setBridgeStatus] =
    useState<ExtensionBridgeState>('connected_watching');
  const [localTime, setLocalTime] = useState<number>(authoritativeTime);
  const [localPlaying, setLocalPlaying] = useState<boolean>(authoritativeIsPlaying);
  const [duration, setDuration] = useState<number>(734);
  const [showInstructions, setShowInstructions] = useState(false);
  const [customNetflixInput, setCustomNetflixInput] = useState('');

  // Live Tab Cast (WebRTC Screen/Tab Share of logged-in Netflix tab)
  const [isCastingTab, setIsCastingTab] = useState(false);
  const [castError, setCastError] = useState<string | null>(null);
  const castVideoRef = useRef<HTMLVideoElement | null>(null);
  const castStreamRef = useRef<MediaStream | null>(null);

  // Built-in HTML5 Synchronized Preview Video Player
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const isApplyingRemoteRef = useRef(false);

  // Listen for Chrome Extension content-script postMessage events
  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== 'VYBE_NETFLIX_EXTENSION') return;

      if (data.type === 'EXTENSION_HEARTBEAT') {
        if (data.pageType === 'watch' && String(data.watchId) === String(watchId)) {
          setBridgeStatus('connected_watching');
          if (typeof data.currentTime === 'number') {
            setLocalTime(data.currentTime);
          }
          if (typeof data.isPlaying === 'boolean') {
            setLocalPlaying(data.isPlaying);
          }
        } else if (data.pageType === 'unsupported') {
          setBridgeStatus('unsupported_page');
        } else {
          setBridgeStatus('connected_idle');
        }
      }

      if (data.type === 'NETFLIX_PLAYBACK_EVENT' && canControlPlayback) {
        const nextTime =
          typeof data.currentTime === 'number' ? data.currentTime : localTime;
        const nextPlaying = Boolean(data.isPlaying);
        setLocalTime(nextTime);
        setLocalPlaying(nextPlaying);
        onLocalPlaybackChange({
          isPlaying: nextPlaying,
          currentTime: nextTime,
        });
      }
    };

    window.addEventListener('message', handleWindowMessage);
    window.postMessage(
      {
        source: 'VYBE_WEB_APP',
        type: 'VYBE_ROOM_INIT',
        roomCode,
        watchId,
        isPlaying: authoritativeIsPlaying,
        currentTime: authoritativeTime,
      },
      '*'
    );

    return () => window.removeEventListener('message', handleWindowMessage);
  }, [
    roomCode,
    watchId,
    authoritativeIsPlaying,
    authoritativeTime,
    canControlPlayback,
    localTime,
    onLocalPlaybackChange,
  ]);

  // Forward authoritative room sync changes to the Chrome Extension & Preview Player
  useEffect(() => {
    const elapsed = authoritativeIsPlaying
      ? Math.max(0, (Date.now() - authoritativeUpdatedAt) / 1000)
      : 0;
    const targetTime = authoritativeTime + elapsed;
    setLocalPlaying(authoritativeIsPlaying);
    setLocalTime(targetTime);

    if (previewVideoRef.current && viewingMode === 'preview_player') {
      const vid = previewVideoRef.current;
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

    window.postMessage(
      {
        source: 'VYBE_WEB_APP',
        type: 'APPLY_REMOTE_SYNC',
        roomCode,
        watchId,
        isPlaying: authoritativeIsPlaying,
        currentTime: targetTime,
      },
      '*'
    );
  }, [
    roomCode,
    watchId,
    authoritativeIsPlaying,
    authoritativeTime,
    authoritativeUpdatedAt,
    viewingMode,
  ]);

  // Periodic drift calculation
  useEffect(() => {
    const timer = setInterval(() => {
      if (viewingMode === 'preview_player' && previewVideoRef.current) {
        const cur = previewVideoRef.current.currentTime || 0;
        const dur = previewVideoRef.current.duration || 734;
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
    viewingMode,
    localPlaying,
    authoritativeIsPlaying,
    authoritativeTime,
    authoritativeUpdatedAt,
    onLocalTimeReport,
  ]);

  // Start / Stop Live Netflix Tab Stream inside VYBE Player
  const handleStartTabCast = async () => {
    setCastError(null);
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getDisplayMedia
    ) {
      setCastError(
        'Tab sharing requires a desktop browser (Chrome, Edge, Brave, or Firefox).'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 60, max: 60 },
        },
        audio: true,
      });

      castStreamRef.current = stream;
      setIsCastingTab(true);
      setViewingMode('tab_cast');

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

      if (canControlPlayback) {
        onLocalPlaybackChange({
          isPlaying: true,
          currentTime: localTime,
        });
      }
    } catch {
      setCastError(
        'Tab cast was cancelled. Click "1. Log into Netflix" to open your movie tab first, then click "2. Stream Netflix Tab Here" and select that tab.'
      );
    }
  };

  const handleStopTabCast = () => {
    if (castStreamRef.current) {
      castStreamRef.current.getTracks().forEach((t) => t.stop());
      castStreamRef.current = null;
    }
    setIsCastingTab(false);
  };

  // Open Netflix Login & Watch Window as a companion popup
  const handleOpenNetflixWindow = () => {
    const targetUrl = `https://www.netflix.com/watch/${watchId}?vybeRoom=${encodeURIComponent(
      roomCode
    )}`;
    window.open(
      targetUrl,
      'VYBENetflixWindow',
      'width=1280,height=760,menubar=no,toolbar=no,location=yes,status=no'
    );
  };

  const handleLoadCustomNetflixUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const nfId = extractNetflixWatchId(customNetflixInput);
    if (!nfId) return;
    const meta = resolveNetflixMetadata(nfId);
    onSelectNetflixTitle(nfId, meta.title, meta.posterUrl);
    setCustomNetflixInput('');
  };

  const handleTogglePlay = () => {
    if (!canControlPlayback) return;
    const nextPlaying = !localPlaying;
    setLocalPlaying(nextPlaying);

    if (viewingMode === 'preview_player' && previewVideoRef.current) {
      isApplyingRemoteRef.current = true;
      if (nextPlaying) previewVideoRef.current.play().catch(() => {});
      else previewVideoRef.current.pause();
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
    if (viewingMode === 'preview_player' && previewVideoRef.current) {
      isApplyingRemoteRef.current = true;
      previewVideoRef.current.currentTime = nextTime;
      setTimeout(() => {
        isApplyingRemoteRef.current = false;
      }, 400);
    }
    onLocalPlaybackChange({
      isPlaying: localPlaying,
      currentTime: nextTime,
    });
  };

  const previewStreamUrl =
    NETFLIX_PREVIEW_STREAMS[watchId] || NETFLIX_PREVIEW_STREAMS['80057281'];

  return (
    <div className="relative flex flex-col justify-between w-full h-full bg-[#07080D] overflow-y-auto">
      {/* Top Mode Switcher Bar: 3 Ways to Watch Netflix Together */}
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#0D0F18]/90 backdrop-blur-xl px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setViewingMode('tab_cast')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition ${
              viewingMode === 'tab_cast'
                ? 'bg-[#E50914]/25 border-[#E50914] text-white shadow-[0_0_20px_rgba(229,9,20,0.35)]'
                : 'vybe-glass-pill text-slate-300 hover:text-white'
            }`}
          >
            <MonitorUp className="h-3.5 w-3.5 text-rose-400" />
            <span>1. In-App Netflix Tab Stream</span>
          </button>

          <button
            type="button"
            onClick={() => setViewingMode('preview_player')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition ${
              viewingMode === 'preview_player'
                ? 'bg-vybe-accent/25 border-vybe-accent text-white shadow-vybe-accent'
                : 'vybe-glass-pill text-slate-300 hover:text-white'
            }`}
          >
            <Film className="h-3.5 w-3.5 text-vybe-accentLight" />
            <span>2. Built-In Preview Player</span>
          </button>

          <button
            type="button"
            onClick={() => setViewingMode('extension_popup')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition ${
              viewingMode === 'extension_popup'
                ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200'
                : 'vybe-glass-pill text-slate-300 hover:text-white'
            }`}
          >
            <Chrome className="h-3.5 w-3.5 text-emerald-400" />
            <span>3. Teleparty Extension Sync</span>
          </button>
        </div>

        {/* Paste Any Netflix URL or Title ID */}
        {canControlPlayback && (
          <form
            onSubmit={handleLoadCustomNetflixUrl}
            className="flex items-center gap-1.5 rounded-full vybe-glass-pill px-2.5 py-1"
          >
            <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={customNetflixInput}
              onChange={(e) => setCustomNetflixInput(e.target.value)}
              placeholder="Paste netflix.com/watch/... link"
              className="w-40 sm:w-52 bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-full bg-[#E50914] hover:bg-[#f6121d] px-2.5 py-0.5 text-[11px] font-bold text-white transition"
            >
              Load
            </button>
          </form>
        )}
      </div>

      {/* ==================================================================== */}
      {/* MODE 1: IN-APP NETFLIX TAB STREAM (NO EXTENSION REQUIRED)            */}
      {/* ==================================================================== */}
      {viewingMode === 'tab_cast' && (
        <div className="relative flex-1 flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden">
          {/* Background Poster Blur */}
          {!isCastingTab && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-25">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={titleMeta.posterUrl}
                alt={titleMeta.title}
                className="h-full w-full object-cover blur-xl scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#07080D] via-[#07080D]/80 to-[#07080D]/60" />
            </div>
          )}

          {isCastingTab ? (
            <div className="relative w-full h-full flex flex-col items-center justify-center bg-black rounded-2xl overflow-hidden border border-white/10">
              <video
                ref={castVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 backdrop-blur-md px-3 py-1 text-xs font-bold text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Streaming Netflix Tab Live</span>
                </span>
                <button
                  type="button"
                  onClick={handleStopTabCast}
                  className="inline-flex items-center gap-1.5 rounded-full bg-rose-600/80 hover:bg-rose-600 px-3 py-1 text-xs font-bold text-white transition"
                >
                  <MonitorOff className="h-3.5 w-3.5" />
                  <span>Stop Stream</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="relative z-10 max-w-2xl w-full rounded-3xl vybe-glass p-6 sm:p-8 text-center space-y-5">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-[#E50914]/20 border border-[#E50914]/40 px-4 py-1.5 text-xs font-bold text-rose-200">
                <Tv className="h-4 w-4" />
                <span>Selected Title: {titleMeta.title}</span>
              </div>

              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                Host Netflix Directly Inside This Room
              </h2>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-lg mx-auto">
                Just like Discord Go Live or Kosmi: sign into Netflix in a popup tab, then click{' '}
                <strong>Stream Netflix Tab Here</strong> to project the movie and audio straight into this VYBE room for everyone—no extension install required!
              </p>

              {castError && (
                <div className="rounded-2xl bg-amber-500/15 border border-amber-500/35 px-4 py-3 text-xs text-amber-200 text-left">
                  {castError}
                </div>
              )}

              {/* 2-Step Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleOpenNetflixWindow}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#E50914] hover:bg-[#f6121d] px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-[0_8px_28px_-4px_rgba(229,9,20,0.6)] transition"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Step 1: Log In & Open Netflix Movie</span>
                </button>

                <GlowButton
                  variant="primary"
                  onClick={handleStartTabCast}
                  className="px-6 py-3 text-xs sm:text-sm"
                >
                  <MonitorUp className="h-4 w-4" />
                  <span>Step 2: Stream Netflix Tab Here</span>
                </GlowButton>
              </div>

              {/* Quick Catalog Picker */}
              {canControlPlayback && (
                <div className="pt-4 border-t border-white/10">
                  <div className="text-xs font-semibold text-slate-400 mb-2.5">
                    Or switch to another Netflix title:
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {SUPPORTED_NETFLIX_TITLES.map((item) => (
                      <button
                        key={item.watchId}
                        type="button"
                        onClick={() =>
                          onSelectNetflixTitle(
                            item.watchId,
                            item.title,
                            item.posterUrl
                          )
                        }
                        className={`rounded-full px-3.5 py-1.5 text-xs font-medium border transition ${
                          item.watchId === watchId
                            ? 'bg-[#E50914]/25 border-[#E50914] text-white font-bold'
                            : 'vybe-glass-pill text-slate-300 hover:text-white'
                        }`}
                      >
                        {item.title.split('—')[0].trim()}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODE 2: BUILT-IN SYNCHRONIZED PREVIEW / CINEMA PLAYER                */}
      {/* ==================================================================== */}
      {viewingMode === 'preview_player' && (
        <div className="relative flex-1 flex flex-col bg-black overflow-hidden">
          <video
            ref={previewVideoRef}
            src={previewStreamUrl}
            className="w-full h-full object-contain"
            playsInline
            onPlay={() => {
              if (!isApplyingRemoteRef.current && canControlPlayback) {
                setLocalPlaying(true);
                onLocalPlaybackChange({
                  isPlaying: true,
                  currentTime: previewVideoRef.current?.currentTime || 0,
                });
              }
            }}
            onPause={() => {
              if (!isApplyingRemoteRef.current && canControlPlayback) {
                setLocalPlaying(false);
                onLocalPlaybackChange({
                  isPlaying: false,
                  currentTime: previewVideoRef.current?.currentTime || 0,
                });
              }
            }}
          />
          <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-2 rounded-full vybe-glass-pill px-3.5 py-1.5">
            <Sparkles className="h-3.5 w-3.5 text-vybe-accentLight" />
            <span className="text-xs font-bold text-white">
              {titleMeta.title} (In-App Synchronized Preview)
            </span>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODE 3: TELEPARTY-STYLE CHROME EXTENSION SYNC                        */}
      {/* ==================================================================== */}
      {viewingMode === 'extension_popup' && (
        <div className="relative flex-1 p-5 sm:p-7 flex flex-col justify-between overflow-y-auto">
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {bridgeStatus === 'connected_watching' ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3.5 py-1.5 text-xs font-semibold text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Extension Connected & Synced</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3.5 py-1.5 text-xs font-semibold text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Waiting for Netflix Tab</span>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowInstructions((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-full vybe-glass-pill px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:text-white transition"
            >
              <Chrome className="h-3.5 w-3.5 text-vybe-accentLight" />
              <span>
                {showInstructions ? 'Hide Extension Guide' : 'How to Install Extension'}
              </span>
            </button>
          </div>

          <div className="relative z-10 my-6 max-w-2xl space-y-4">
            <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-white leading-tight">
              {titleMeta.title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {titleMeta.synopsis}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleOpenNetflixWindow}
                className="inline-flex items-center gap-2 rounded-full bg-[#E50914] hover:bg-[#f6121d] px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-lg transition"
              >
                <ExternalLink className="h-4 w-4" />
                <span>Launch Movie on Netflix.com with VYBE Sidebar</span>
              </button>

              <GlowButton
                variant="secondary"
                onClick={onRequestResync}
                className="py-2.5 px-5 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5 text-vybe-accentLight" />
                <span>Sync Timestamps</span>
              </GlowButton>
            </div>
          </div>

          {showInstructions && (
            <div className="relative z-10 rounded-3xl vybe-glass p-5 text-xs space-y-2">
              <div className="font-bold text-white flex items-center gap-2">
                <Chrome className="h-4 w-4 text-vybe-accentLight" />
                <span>Install the VYBE Teleparty Extension (30 Seconds)</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                <li>
                  Open Chrome and go to <code className="text-white">chrome://extensions</code>.
                </li>
                <li>
                  Turn on <strong>Developer mode</strong> (top-right) and click{' '}
                  <strong>Load unpacked</strong>.
                </li>
                <li>
                  Select the <code className="text-vybe-accentLight">chrome-extension</code> folder from this project.
                </li>
                <li>
                  Click <strong>Launch Movie on Netflix.com</strong> above — VYBE injects a live chat & floating reaction bar directly inside Netflix!
                </li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Bottom Synchronized Master Timeline & Transport Bar */}
      <div className="border-t border-white/[0.08] bg-[#0D0F18] px-4 py-2.5 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-slate-300 w-12 text-right">
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
            aria-label="Netflix master sync timeline"
            className="flex-1 h-1.5 rounded-lg accent-[#E50914] cursor-pointer"
          />
          <span className="text-[11px] font-mono text-slate-400 w-12">
            {formatTimestamp(duration)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleTogglePlay}
              disabled={!canControlPlayback}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E50914] hover:bg-[#f6121d] disabled:opacity-50 text-white transition"
            >
              {localPlaying ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="h-4 w-4 fill-current ml-0.5" />
              )}
            </button>
            <span className="text-xs font-medium text-slate-300">
              {isCastingTab
                ? 'Live Netflix Tab Stream Active'
                : localPlaying
                ? 'Room Playback: Playing'
                : 'Room Playback: Paused'}
            </span>
          </div>

          <button
            type="button"
            onClick={onRequestResync}
            className="inline-flex items-center gap-1.5 rounded-full vybe-glass-pill px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:text-white transition"
          >
            <RefreshCw className="h-3.5 w-3.5 text-rose-400" />
            <span>Resync Room</span>
          </button>
        </div>
      </div>
    </div>
  );
}
