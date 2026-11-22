'use client';

import React, { useEffect, useState } from 'react';
import {
  Tv,
  Chrome,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  RefreshCw,
  ShieldCheck,
  Terminal,
  Radio,
} from 'lucide-react';
import { SUPPORTED_NETFLIX_TITLES } from '@/lib/constants';
import { formatTimestamp, resolveNetflixMetadata } from '@/lib/utils';
import { GlowButton } from '@/components/ui/AceternityPrimitives';

export type ExtensionBridgeState =
  | 'connected_watching'
  | 'connected_idle'
  | 'unsupported_page'
  | 'disconnected';

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

  const [bridgeStatus, setBridgeStatus] =
    useState<ExtensionBridgeState>('connected_watching');
  const [localTime, setLocalTime] = useState<number>(authoritativeTime);
  const [localPlaying, setLocalPlaying] = useState<boolean>(authoritativeIsPlaying);
  const [showInstructions, setShowInstructions] = useState(false);
  const [lastBridgeLog, setLastBridgeLog] = useState<string>(
    `Manifest V3 Bridge ready for room ${roomCode} (Title #${watchId})`
  );

  // Listen for real Chrome Extension content-script postMessage events
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
          setLastBridgeLog(
            `Extension synced on netflix.com/watch/${data.watchId} @ ${formatTimestamp(
              data.currentTime || 0
            )}`
          );
        } else if (data.pageType === 'unsupported') {
          setBridgeStatus('unsupported_page');
          setLastBridgeLog(
            'Warning: Participant is on netflix.com/browse instead of an active /watch/* stream.'
          );
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
        setLastBridgeLog(
          `Extension emitted ${nextPlaying ? 'PLAY' : 'PAUSE/SEEK'} @ ${formatTimestamp(nextTime)}`
        );
        onLocalPlaybackChange({
          isPlaying: nextPlaying,
          currentTime: nextTime,
        });
      }
    };

    window.addEventListener('message', handleWindowMessage);
    // Announce room context to extension content bridge
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

  // Forward authoritative room sync changes to the Chrome Extension
  useEffect(() => {
    const elapsed = authoritativeIsPlaying
      ? Math.max(0, (Date.now() - authoritativeUpdatedAt) / 1000)
      : 0;
    const targetTime = authoritativeTime + elapsed;
    setLocalPlaying(authoritativeIsPlaying);
    setLocalTime(targetTime);

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
  }, [roomCode, watchId, authoritativeIsPlaying, authoritativeTime, authoritativeUpdatedAt]);

  // Periodic drift calculation & clock advancement when synced
  useEffect(() => {
    const timer = setInterval(() => {
      setLocalTime((prev) => {
        const next =
          bridgeStatus === 'connected_watching' && localPlaying ? prev + 0.5 : prev;
        const elapsedAuth = authoritativeIsPlaying
          ? Math.max(0, (Date.now() - authoritativeUpdatedAt) / 1000)
          : 0;
        const expected = authoritativeTime + elapsedAuth;
        const drift = Number((next - expected).toFixed(2));
        onLocalTimeReport(
          next,
          drift,
          bridgeStatus === 'connected_watching' || bridgeStatus === 'connected_idle'
        );
        return next;
      });
    }, 500);

    return () => clearInterval(timer);
  }, [
    bridgeStatus,
    localPlaying,
    authoritativeIsPlaying,
    authoritativeTime,
    authoritativeUpdatedAt,
    onLocalTimeReport,
  ]);

  const handleTogglePlay = () => {
    if (!canControlPlayback) return;
    const nextPlaying = !localPlaying;
    setLocalPlaying(nextPlaying);
    setLastBridgeLog(
      `Broadcasted ${nextPlaying ? 'PLAY' : 'PAUSE'} command to room & Chrome Extension @ ${formatTimestamp(
        localTime
      )}`
    );
    onLocalPlaybackChange({
      isPlaying: nextPlaying,
      currentTime: localTime,
    });
  };

  const handleSeek = (nextTime: number) => {
    if (!canControlPlayback) return;
    setLocalTime(nextTime);
    setLastBridgeLog(
      `Broadcasted SEEK to ${formatTimestamp(nextTime)} across all connected Netflix sessions`
    );
    onLocalPlaybackChange({
      isPlaying: localPlaying,
      currentTime: nextTime,
    });
  };

  return (
    <div className="relative flex flex-col justify-between w-full h-full bg-[#07080D] overflow-y-auto">
      {/* Main Backdrop & Companion Deck */}
      <div className="relative flex-1 p-5 sm:p-7 flex flex-col justify-between">
        {/* Background Poster Blur */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-25">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={titleMeta.posterUrl}
            alt={titleMeta.title}
            className="h-full w-full object-cover blur-xl scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#07080D] via-[#07080D]/80 to-[#07080D]/60" />
        </div>

        {/* Top Connection Status Bar */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#E50914]/20 border border-[#E50914]/50 px-3 py-1.5 text-xs font-bold text-rose-200">
              <Tv className="h-3.5 w-3.5" />
              <span>Netflix Extension Sync</span>
            </span>

            {bridgeStatus === 'connected_watching' && (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Extension Connected & Synced</span>
              </span>
            )}

            {bridgeStatus === 'unsupported_page' && (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 text-xs font-semibold text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Unsupported Netflix Page Detected</span>
              </span>
            )}

            {bridgeStatus === 'disconnected' && (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 px-3 py-1.5 text-xs font-semibold text-rose-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Extension Disconnected</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowInstructions((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#131624] hover:bg-[#191E32] border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 transition"
            >
              <Chrome className="h-3.5 w-3.5 text-vybe-accentLight" />
              <span>{showInstructions ? 'Hide Setup Guide' : 'Extension Setup Guide'}</span>
            </button>
          </div>
        </div>

        {/* Conditional Disconnected / Unsupported Content Graceful Error Alert */}
        {bridgeStatus === 'unsupported_page' && (
          <div className="relative z-10 mt-4 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3.5 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200 leading-relaxed">
              <strong className="font-bold block">
                Watching Unsupported Netflix Page
              </strong>
              Your Netflix tab is currently on the browse menu or a different episode. Click{' '}
              <strong>&ldquo;Open Title #{watchId} on Netflix&rdquo;</strong> below so the VYBE content script can lock onto the HTML5 video player.
            </div>
          </div>
        )}

        {bridgeStatus === 'disconnected' && (
          <div className="relative z-10 mt-4 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3.5 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-200 leading-relaxed">
              <strong className="font-bold block">
                VYBE Chrome Extension Disconnected
              </strong>
              We couldn&apos;t detect a heartbeat from the VYBE Manifest V3 Chrome Extension. Load the unpacked extension from <code className="text-white">/chrome-extension</code> or click <strong>Reconnect Bridge</strong> below.
            </div>
          </div>
        )}

        {/* Center Title Card & Launch Controls */}
        <div className="relative z-10 my-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-2 text-xs font-mono text-slate-400">
              <span>NETFLIX WATCH ID #{watchId}</span>
              <span>•</span>
              <span>{titleMeta.maturity}</span>
              <span>•</span>
              <span>{titleMeta.durationLabel}</span>
            </div>

            <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-white leading-tight">
              {titleMeta.title}
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
              {titleMeta.synopsis}
            </p>

            <div className="rounded-xl bg-[#0D0F18]/90 border border-white/10 p-3.5 flex items-start gap-2.5 text-xs text-slate-300">
              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>DRM & Account Privacy:</strong> VYBE never embeds Netflix in an iframe or bypasses DRM. Every participant streams directly from their own authenticated Netflix account while VYBE synchronizes play, pause, and seek timestamps.
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                href={`https://www.netflix.com/watch/${watchId}?vybeRoom=${encodeURIComponent(
                  roomCode
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-[#E50914] hover:bg-[#f6121d] px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg transition"
              >
                <ExternalLink className="h-4 w-4" />
                <span>Open Title #{watchId} on Netflix.com</span>
              </a>

              <GlowButton
                variant="secondary"
                onClick={onRequestResync}
                className="py-2.5 px-4 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5 text-vybe-accentLight" />
                <span>Sync My Netflix Tab</span>
              </GlowButton>
            </div>
          </div>

          {/* Extension Bridge Telemetry & Diagnostics Card */}
          <div className="lg:col-span-5 rounded-2xl bg-[#0D0F18]/95 border border-white/10 p-4 space-y-3.5 shadow-vybe-lg">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Terminal className="h-4 w-4 text-vybe-accentLight" />
                <span>Manifest V3 Extension Bridge</span>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                <Radio className="h-3 w-3 animate-pulse" />
                <span>v1.0.0 Active</span>
              </span>
            </div>

            <div className="rounded-xl bg-[#07080D] border border-white/5 p-3 font-mono text-[11px] text-slate-300 space-y-1">
              <div className="text-slate-500">// Live Extension Content-Script Bus</div>
              <div className="text-vybe-accentLight truncate">{lastBridgeLog}</div>
            </div>

            {/* Connection State Tester (to verify disconnected / unsupported content handling) */}
            <div>
              <div className="text-[11px] font-medium text-slate-400 mb-1.5">
                Extension Connection State Monitor:
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setBridgeStatus('connected_watching');
                    setLastBridgeLog(
                      `Extension locked onto netflix.com/watch/${watchId}`
                    );
                  }}
                  className={`rounded-lg py-1.5 px-2 text-[10px] font-semibold border transition ${
                    bridgeStatus === 'connected_watching'
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-[#07080D] border-white/10 text-slate-400'
                  }`}
                >
                  Synced Tab
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBridgeStatus('unsupported_page');
                    setLastBridgeLog(
                      'Content script detected netflix.com/browse (Unsupported page)'
                    );
                  }}
                  className={`rounded-lg py-1.5 px-2 text-[10px] font-semibold border transition ${
                    bridgeStatus === 'unsupported_page'
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                      : 'bg-[#07080D] border-white/10 text-slate-400'
                  }`}
                >
                  Wrong Page
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBridgeStatus('disconnected');
                    setLastBridgeLog('Extension content script disconnected');
                  }}
                  className={`rounded-lg py-1.5 px-2 text-[10px] font-semibold border transition ${
                    bridgeStatus === 'disconnected'
                      ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                      : 'bg-[#07080D] border-white/10 text-slate-400'
                  }`}
                >
                  Disconnected
                </button>
              </div>
            </div>

            {/* Quick Switch Supported Netflix Titles */}
            {canControlPlayback && (
              <div className="pt-2 border-t border-white/10">
                <div className="text-[11px] font-medium text-slate-400 mb-1.5">
                  Switch Supported Netflix Title:
                </div>
                <div className="grid grid-cols-1 gap-1.5 max-h-28 overflow-y-auto pr-1">
                  {SUPPORTED_NETFLIX_TITLES.map((item) => (
                    <button
                      key={item.watchId}
                      type="button"
                      onClick={() =>
                        onSelectNetflixTitle(item.watchId, item.title, item.posterUrl)
                      }
                      className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[11px] border transition ${
                        item.watchId === watchId
                          ? 'bg-rose-500/15 border-rose-500/40 text-white font-semibold'
                          : 'bg-[#07080D] border-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className="truncate pr-2">{item.title}</span>
                      <span className="font-mono text-[10px] text-slate-400 shrink-0">
                        #{item.watchId}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Collapsible Chrome Extension Installation Guide */}
        {showInstructions && (
          <div className="relative z-10 mt-2 rounded-2xl bg-[#131624] border border-vybe-accent/40 p-4 text-xs space-y-2">
            <div className="font-bold text-white flex items-center gap-2">
              <Chrome className="h-4 w-4 text-vybe-accentLight" />
              <span>How to Connect the VYBE Manifest V3 Chrome Extension</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-slate-300">
              <li>
                Open Chrome and navigate to <code className="text-white">chrome://extensions</code>.
              </li>
              <li>
                Enable <strong>Developer mode</strong> in the top-right corner and click{' '}
                <strong>Load unpacked</strong>.
              </li>
              <li>
                Select the <code className="text-vybe-accentLight">chrome-extension/</code> folder inside the VYBE project directory.
              </li>
              <li>
                Sign into your own Netflix account and click{' '}
                <strong>Open Title #{watchId} on Netflix.com</strong> above — the content script automatically synchronizes timestamps with room <code className="text-white">{roomCode}</code>!
              </li>
            </ol>
          </div>
        )}
      </div>

      {/* Bottom Synchronized Netflix Master Clock & Transport Controls */}
      <div className="border-t border-white/[0.08] bg-[#0D0F18] px-4 py-2.5 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-slate-300 w-12 text-right">
            {formatTimestamp(localTime)}
          </span>
          <input
            type="range"
            min={0}
            max={3120}
            step={1}
            value={Math.min(localTime, 3120)}
            disabled={!canControlPlayback}
            onChange={(e) => handleSeek(Number(e.target.value))}
            aria-label="Netflix master sync timeline"
            className="flex-1 h-1.5 rounded-lg accent-[#E50914] cursor-pointer"
          />
          <span className="text-[11px] font-mono text-slate-400 w-12">52:00</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleTogglePlay}
              disabled={!canControlPlayback}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E50914] hover:bg-[#f6121d] disabled:opacity-50 text-white transition"
            >
              {localPlaying ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="h-4 w-4 fill-current ml-0.5" />
              )}
            </button>
            <span className="text-xs font-medium text-slate-300">
              {localPlaying ? 'Netflix Extension Clock: Playing' : 'Netflix Extension Clock: Paused'}
            </span>
          </div>

          <button
            type="button"
            onClick={onRequestResync}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#161A2B] hover:bg-[#1E243B] border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 transition"
          >
            <RefreshCw className="h-3.5 w-3.5 text-rose-400" />
            <span>Broadcast Timestamp</span>
          </button>
        </div>
      </div>
    </div>
  );
}
