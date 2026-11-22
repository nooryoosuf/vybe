'use client';

import React, { useState } from 'react';
import {
  Plus,
  ThumbsUp,
  ThumbsDown,
  ChevronUp,
  ChevronDown,
  Trash2,
  Play,
  Youtube,
  Tv,
  ListVideo,
  Sparkles,
} from 'lucide-react';
import { PlatformType, QueueItem } from '@/types/vybe';
import { CURATED_YOUTUBE_VIDEOS, SUPPORTED_NETFLIX_TITLES } from '@/lib/constants';
import {
  extractNetflixWatchId,
  extractYouTubeId,
  fetchYouTubeMetadata,
  resolveNetflixMetadata,
} from '@/lib/utils';
import { GlowButton } from '@/components/ui/AceternityPrimitives';

interface WatchQueuePanelProps {
  roomId: string;
  queue: QueueItem[];
  currentUserId: string;
  currentUserName: string;
  canControlPlayback: boolean;
  onAddQueueItem: (item: QueueItem) => void;
  onVoteQueueItem: (itemId: string, direction: 'up' | 'down') => void;
  onMoveQueueItem: (itemId: string, dir: -1 | 1) => void;
  onRemoveQueueItem: (itemId: string) => void;
  onPlayQueueItemNow: (itemId: string) => void;
  onDirectSwitchMedia: (
    platform: PlatformType,
    videoId: string,
    title: string,
    thumbnailUrl: string
  ) => void;
}

export function WatchQueuePanel({
  roomId,
  queue,
  currentUserId,
  currentUserName,
  canControlPlayback,
  onAddQueueItem,
  onVoteQueueItem,
  onMoveQueueItem,
  onRemoveQueueItem,
  onPlayQueueItemNow,
  onDirectSwitchMedia,
}: WatchQueuePanelProps) {
  const [addPlatform, setAddPlatform] = useState<PlatformType>('youtube');
  const [inputUrl, setInputUrl] = useState('');
  const [selectedNetflixId, setSelectedNetflixId] = useState(
    SUPPORTED_NETFLIX_TITLES[0].watchId
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAdd = async (e?: React.FormEvent, playImmediately = false) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      if (addPlatform === 'youtube') {
        const ytId = extractYouTubeId(inputUrl);
        if (!ytId) {
          throw new Error('Paste a valid YouTube URL or 11-character video ID.');
        }
        const meta = await fetchYouTubeMetadata(ytId);

        if (playImmediately && canControlPlayback) {
          onDirectSwitchMedia('youtube', ytId, meta.title, meta.thumbnailUrl);
          setInputUrl('');
          return;
        }

        const newItem: QueueItem = {
          id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          roomId,
          platform: 'youtube',
          videoId: ytId,
          title: meta.title,
          thumbnailUrl: meta.thumbnailUrl,
          durationLabel: 'HD Sync',
          addedById: currentUserId,
          addedByName: currentUserName,
          position: queue.length,
          score: 1,
          upvoterIds: [currentUserId],
          downvoterIds: [],
          createdAt: new Date().toISOString(),
        };
        onAddQueueItem(newItem);
        setInputUrl('');
      } else {
        const nfId = extractNetflixWatchId(selectedNetflixId);
        if (!nfId) {
          throw new Error('Select a supported Netflix title.');
        }
        const nfMeta = resolveNetflixMetadata(nfId);

        if (playImmediately && canControlPlayback) {
          onDirectSwitchMedia('netflix', nfId, nfMeta.title, nfMeta.posterUrl);
          return;
        }

        const newItem: QueueItem = {
          id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          roomId,
          platform: 'netflix',
          videoId: nfId,
          title: nfMeta.title,
          thumbnailUrl: nfMeta.posterUrl,
          durationLabel: nfMeta.durationLabel,
          netflixSynopsis: nfMeta.synopsis,
          addedById: currentUserId,
          addedByName: currentUserName,
          position: queue.length,
          score: 1,
          upvoterIds: [currentUserId],
          downvoterIds: [],
          createdAt: new Date().toISOString(),
        };
        onAddQueueItem(newItem);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not add item');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Add to Queue Composer */}
      <div className="border-b border-white/[0.08] bg-[#0D0F18] p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <ListVideo className="h-3.5 w-3.5 text-vybe-accentLight" />
            <span>Add to Shared Watch Queue</span>
          </span>

          <div className="flex items-center gap-1 rounded-lg bg-[#07080D] p-0.5 border border-white/10">
            <button
              type="button"
              onClick={() => {
                setAddPlatform('youtube');
                setErrorMsg(null);
              }}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold transition ${
                addPlatform === 'youtube'
                  ? 'bg-rose-500/20 text-rose-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Youtube className="h-3 w-3" />
              <span>YouTube</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAddPlatform('netflix');
                setErrorMsg(null);
              }}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold transition ${
                addPlatform === 'netflix'
                  ? 'bg-[#E50914]/25 text-rose-200'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Tv className="h-3 w-3" />
              <span>Netflix</span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 px-2.5 py-1.5 text-[11px] text-rose-300">
            {errorMsg}
          </div>
        )}

        <form onSubmit={(e) => handleAdd(e, false)} className="space-y-2">
          {addPlatform === 'youtube' ? (
            <>
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="Paste YouTube URL or 11-char ID..."
                className="w-full rounded-xl bg-[#07080D] border border-white/10 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-vybe-accent focus:outline-none"
              />
              {/* Quick Preset Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                {CURATED_YOUTUBE_VIDEOS.map((v) => (
                  <button
                    key={v.videoId}
                    type="button"
                    onClick={() => setInputUrl(v.videoId)}
                    className="shrink-0 rounded-md bg-[#131624] hover:bg-vybe-accent/25 border border-white/10 px-2 py-1 text-[10px] text-slate-300 hover:text-white transition"
                  >
                    + {v.title.split('—')[0].trim()}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <select
                value={selectedNetflixId}
                onChange={(e) => setSelectedNetflixId(e.target.value)}
                className="w-full rounded-xl bg-[#07080D] border border-white/10 px-3 py-2 text-xs text-white focus:border-vybe-accent focus:outline-none"
              >
                {SUPPORTED_NETFLIX_TITLES.map((nf) => (
                  <option key={nf.watchId} value={nf.watchId}>
                    {nf.title} (#{nf.watchId})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 leading-snug">
                Netflix titles play through each viewer&apos;s authenticated Netflix session via the VYBE Chrome Extension.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <GlowButton
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 px-3 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{submitting ? 'Adding...' : 'Add to Queue'}</span>
            </GlowButton>

            {canControlPlayback && (
              <GlowButton
                type="button"
                variant="secondary"
                disabled={submitting}
                onClick={() => handleAdd(undefined, true)}
                className="py-2 px-3 text-xs"
              >
                <Sparkles className="h-3.5 w-3.5 text-vybe-accentLight" />
                <span>Load Now</span>
              </GlowButton>
            )}
          </div>
        </form>
      </div>

      {/* Queue List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center px-4">
            <ListVideo className="h-8 w-8 text-slate-600 mb-2" />
            <div className="text-xs font-semibold text-slate-300">
              Queue is currently empty
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Add YouTube videos or supported Netflix titles above and vote on what plays next.
            </p>
          </div>
        ) : (
          queue.map((item, idx) => {
            const upvoted = item.upvoterIds.includes(currentUserId);
            const downvoted = item.downvoterIds.includes(currentUserId);

            return (
              <div
                key={item.id}
                className="group rounded-xl bg-[#0D0F18] border border-white/10 hover:border-white/20 p-2.5 flex flex-col gap-2 transition"
              >
                <div className="flex items-start gap-2.5">
                  <div className="relative h-14 w-24 rounded-lg overflow-hidden shrink-0 bg-[#131624]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute top-1 left-1 rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-mono font-bold text-white">
                      #{idx + 1}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                          item.platform === 'youtube'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-[#E50914]/25 text-rose-200'
                        }`}
                      >
                        {item.platform}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {item.durationLabel}
                      </span>
                    </div>

                    <div className="mt-0.5 text-xs font-bold text-white line-clamp-1">
                      {item.title}
                    </div>

                    <div className="mt-0.5 text-[10px] text-slate-400">
                      Added by <span className="text-slate-200">{item.addedByName}</span>
                    </div>
                  </div>
                </div>

                {/* Controls Row: Upvote / Downvote / Reorder / Play Now / Remove */}
                <div className="flex items-center justify-between pt-1.5 border-t border-white/[0.06]">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onVoteQueueItem(item.id, 'up')}
                      aria-label="Upvote video"
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold border transition ${
                        upvoted
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                          : 'bg-[#161A2B] border-white/10 text-slate-300 hover:text-white'
                      }`}
                    >
                      <ThumbsUp className="h-3 w-3" />
                      <span>{item.upvoterIds.length}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onVoteQueueItem(item.id, 'down')}
                      aria-label="Downvote video"
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold border transition ${
                        downvoted
                          ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                          : 'bg-[#161A2B] border-white/10 text-slate-300 hover:text-white'
                      }`}
                    >
                      <ThumbsDown className="h-3 w-3" />
                      <span>{item.downvoterIds.length}</span>
                    </button>

                    <span className="text-[10px] font-mono text-slate-400 ml-1">
                      Score: {item.score > 0 ? `+${item.score}` : item.score}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {canControlPlayback && (
                      <>
                        <button
                          type="button"
                          onClick={() => onMoveQueueItem(item.id, -1)}
                          disabled={idx === 0}
                          className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30"
                          title="Move up"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onMoveQueueItem(item.id, 1)}
                          disabled={idx === queue.length - 1}
                          className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30"
                          title="Move down"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onPlayQueueItemNow(item.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-vybe-accent/20 hover:bg-vybe-accent border border-vybe-accent/40 px-2 py-1 text-[10px] font-bold text-white transition"
                          title="Play this item immediately"
                        >
                          <Play className="h-2.5 w-2.5 fill-current" />
                          <span>Play</span>
                        </button>
                      </>
                    )}

                    {(canControlPlayback || item.addedById === currentUserId) && (
                      <button
                        type="button"
                        onClick={() => onRemoveQueueItem(item.id)}
                        className="rounded-lg p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                        title="Remove from queue"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
