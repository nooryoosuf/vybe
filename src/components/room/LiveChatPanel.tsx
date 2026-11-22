'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Send,
  Smile,
  Image as ImageIcon,
  Reply,
  X,
  ArrowDown,
  Maximize2,
  Minimize2,
  VolumeX,
} from 'lucide-react';
import { ChatMessage, ReactionDefinition } from '@/types/vybe';
import { CURATED_CINEMA_GIFS, VYBE_REACTIONS } from '@/lib/constants';

const MESSAGE_REACTION_EMOJIS = ['❤️', '😂', '🔥', '👏', '🤯'];
const CHAT_QUICK_EMOJIS = ['🍿', '🎬', '🔥', '😂', '😭', '🤯', '❤️', '👏', '💀', '🥹', '👀', '✨'];

interface LiveChatPanelProps {
  messages: ChatMessage[];
  currentUserId: string;
  isChatMuted: boolean;
  isFloatingMode: boolean;
  onToggleFloatingMode: () => void;
  onSendMessage: (payload: {
    content: string;
    type: 'text' | 'gif';
    gifUrl?: string;
    replyTo?: { id: string; senderName: string; content: string } | null;
  }) => void;
  onToggleMessageReaction: (messageId: string, emoji: string) => void;
  onQuickSceneReaction: (reactionDef: ReactionDefinition) => void;
}

export function LiveChatPanel({
  messages,
  currentUserId,
  isChatMuted,
  isFloatingMode,
  onToggleFloatingMode,
  onSendMessage,
  onToggleMessageReaction,
  onQuickSceneReaction,
}: LiveChatPanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [inputText, setInputText] = useState('');
  const [replyTo, setReplyTo] = useState<{
    id: string;
    senderName: string;
    content: string;
  } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevMsgCountRef = useRef(messages.length);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setUnreadCount(0);
    setIsAtBottom(true);
  };

  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      if (isAtBottom) {
        setTimeout(() => scrollToBottom('smooth'), 40);
      } else {
        setUnreadCount((c) => c + (messages.length - prevMsgCountRef.current));
      }
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length, isAtBottom]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distance < 72;
    setIsAtBottom(nearBottom);
    if (nearBottom) setUnreadCount(0);
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isChatMuted) return;
    onSendMessage({
      content: trimmed,
      type: 'text',
      replyTo,
    });
    setInputText('');
    setReplyTo(null);
    setShowEmojiPicker(false);
    setTimeout(() => scrollToBottom('smooth'), 50);
  };

  const handleSendGif = (gifTitle: string, gifUrl: string) => {
    if (isChatMuted) return;
    onSendMessage({
      content: gifTitle,
      type: 'gif',
      gifUrl,
      replyTo,
    });
    setReplyTo(null);
    setShowGifPicker(false);
    setTimeout(() => scrollToBottom('smooth'), 50);
  };

  const filteredGifs = CURATED_CINEMA_GIFS.filter((g) => {
    if (!gifQuery.trim()) return true;
    const q = gifQuery.toLowerCase();
    return (
      g.title.toLowerCase().includes(q) ||
      g.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-transparent">
      {/* Quick Scene Reaction Strip + Floating Chat Mode Toggle */}
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] bg-[#0D0F18]/90 px-3 py-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {VYBE_REACTIONS.slice(0, 7).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onQuickSceneReaction(r)}
              title={`Launch ${r.label} over video (${r.shortcut})`}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#161A2B] hover:bg-vybe-accent/30 border border-white/5 text-sm transition-transform hover:scale-110 active:scale-95"
            >
              {r.emoji}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onToggleFloatingMode}
          title={
            isFloatingMode
              ? 'Dock chat to side panel'
              : 'Float chat overlay for expanded theater video'
          }
          className="inline-flex items-center gap-1 rounded-lg bg-[#161A2B] hover:bg-[#1E243B] border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:text-white shrink-0 transition"
        >
          {isFloatingMode ? (
            <>
              <Minimize2 className="h-3 w-3 text-vybe-accentLight" />
              <span>Dock</span>
            </>
          ) : (
            <>
              <Maximize2 className="h-3 w-3 text-vybe-accentLight" />
              <span>Float</span>
            </>
          )}
        </button>
      </div>

      {/* Messages Feed */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="relative flex-1 overflow-y-auto px-3.5 py-3 space-y-3"
      >
        {messages.map((msg) => {
          if (msg.type === 'system') {
            return (
              <div
                key={msg.id}
                className="flex items-center justify-center text-center my-1.5"
              >
                <span className="rounded-full bg-white/[0.05] border border-white/[0.07] px-3 py-1 text-[11px] text-slate-400">
                  {msg.content}
                </span>
              </div>
            );
          }

          const isOwn = msg.userId === currentUserId;

          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16 }}
              className="group relative flex items-start gap-2.5 rounded-xl p-2 hover:bg-white/[0.03] transition-colors"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  msg.senderAvatar ||
                  'https://api.dicebear.com/9.x/glass/svg?seed=Vybe'
                }
                alt={msg.senderName}
                className="h-8 w-8 rounded-full object-cover shrink-0 mt-0.5 ring-1 ring-white/10"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`text-xs font-bold ${
                      isOwn ? 'text-vybe-accentLight' : 'text-white'
                    }`}
                  >
                    {msg.senderName}
                  </span>

                  {(msg.senderRole === 'host' || msg.senderRole === 'cohost') && (
                    <span className="rounded bg-vybe-accent/20 border border-vybe-accent/40 px-1.5 py-0.2 text-[9px] font-bold uppercase text-vybe-accentLight">
                      {msg.senderRole}
                    </span>
                  )}

                  <span className="text-[10px] font-mono text-slate-500">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>

                {/* Reply Quote Banner */}
                {msg.replyTo && (
                  <div className="mt-1 mb-1 rounded-lg bg-white/[0.04] border-l-2 border-vybe-accent px-2.5 py-1 text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-300">
                      @{msg.replyTo.senderName}:{' '}
                    </span>
                    <span className="line-clamp-1">{msg.replyTo.content}</span>
                  </div>
                )}

                {/* Message Content or GIF */}
                {msg.type === 'gif' && msg.gifUrl ? (
                  <div className="mt-1.5 overflow-hidden rounded-xl border border-white/10 max-w-[220px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={msg.gifUrl}
                      alt={msg.content}
                      className="w-full h-auto object-cover"
                    />
                  </div>
                ) : (
                  <p className="mt-0.5 text-xs text-slate-200 leading-relaxed break-words">
                    {msg.content}
                  </p>
                )}

                {/* Message Reaction Pills */}
                {Object.keys(msg.reactions || {}).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {Object.entries(msg.reactions).map(([emoji, userIds]) => {
                      if (!userIds || userIds.length === 0) return null;
                      const reacted = userIds.includes(currentUserId);
                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => onToggleMessageReaction(msg.id, emoji)}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] border transition ${
                            reacted
                              ? 'bg-vybe-accent/25 border-vybe-accent text-white'
                              : 'bg-[#131624] border-white/10 text-slate-300 hover:border-white/25'
                          }`}
                        >
                          <span>{emoji}</span>
                          <span className="text-[10px] font-mono">{userIds.length}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Hover Action Toolbar (Reply & Message Reactions) */}
              <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity absolute right-2 top-1.5 flex items-center gap-0.5 rounded-lg bg-[#131624] border border-white/15 px-1.5 py-0.5 shadow-md">
                {MESSAGE_REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onToggleMessageReaction(msg.id, emoji)}
                    className="hover:scale-125 transition-transform px-1 text-xs"
                    title={`React with ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setReplyTo({
                      id: msg.id,
                      senderName: msg.senderName,
                      content: msg.content,
                    })
                  }
                  className="ml-1 rounded p-1 text-slate-400 hover:text-white hover:bg-white/10"
                  title="Reply to message"
                >
                  <Reply className="h-3 w-3" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Unread Message Indicator Banner */}
      <AnimatePresence>
        {unreadCount > 0 && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            type="button"
            onClick={() => scrollToBottom('smooth')}
            className="mx-3 mb-2 flex items-center justify-center gap-1.5 rounded-xl bg-vybe-accent px-3 py-1.5 text-xs font-bold text-white shadow-vybe-accent"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            <span>
              {unreadCount} new {unreadCount === 1 ? 'message' : 'messages'}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Emoji / GIF Popovers */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mx-3 mb-2 rounded-xl bg-[#131624] border border-white/15 p-2.5 shadow-vybe-lg"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Insert Emoji
              </span>
              <button
                type="button"
                onClick={() => setShowEmojiPicker(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {CHAT_QUICK_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setInputText((prev) => `${prev}${em}`)}
                  className="rounded-lg bg-[#07080D] hover:bg-vybe-accent/25 py-1.5 text-base transition"
                >
                  {em}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {showGifPicker && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mx-3 mb-2 rounded-xl bg-[#131624] border border-white/15 p-3 shadow-vybe-lg space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-white">
                Cinema Reaction GIFs
              </span>
              <button
                type="button"
                onClick={() => setShowGifPicker(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <input
              type="text"
              value={gifQuery}
              onChange={(e) => setGifQuery(e.target.value)}
              placeholder="Search GIFs (popcorn, mindblown, fire, laugh)..."
              className="w-full rounded-lg bg-[#07080D] border border-white/10 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-vybe-accent focus:outline-none"
            />

            <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
              {filteredGifs.map((gif) => (
                <button
                  key={gif.id}
                  type="button"
                  onClick={() => handleSendGif(gif.title, gif.url)}
                  className="group relative overflow-hidden rounded-lg border border-white/10 hover:border-vybe-accent text-left"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={gif.url}
                    alt={gif.title}
                    className="h-20 w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white truncate">
                    {gif.title}
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reply Banner */}
      {replyTo && (
        <div className="mx-3 mb-1.5 flex items-center justify-between rounded-lg bg-[#161A2B] border border-vybe-accent/40 px-3 py-1.5 text-xs">
          <div className="truncate pr-2">
            <span className="text-slate-400">Replying to </span>
            <span className="font-semibold text-white">@{replyTo.senderName}</span>
          </div>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Message Composer */}
      <form
        onSubmit={handleSendText}
        className="border-t border-white/[0.08] bg-[#0D0F18] p-3"
      >
        {isChatMuted ? (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 py-2.5 px-3 text-xs text-rose-300">
            <VolumeX className="h-4 w-4" />
            <span>You have been muted in chat by the room host.</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-xl bg-[#07080D] border border-white/10 px-2.5 py-1.5 focus-within:border-vybe-accent">
            <button
              type="button"
              onClick={() => {
                setShowEmojiPicker((v) => !v);
                setShowGifPicker(false);
              }}
              className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/5 transition"
              title="Emoji picker"
            >
              <Smile className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setShowGifPicker((v) => !v);
                setShowEmojiPicker(false);
              }}
              className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/5 transition"
              title="Send a Cinema GIF"
            >
              <ImageIcon className="h-4 w-4" />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Send a message to the room..."
              className="flex-1 bg-transparent px-1.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none"
            />

            <button
              type="submit"
              disabled={!inputText.trim()}
              aria-label="Send chat message"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-vybe-accent hover:bg-vybe-accentLight disabled:opacity-40 text-white transition"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
