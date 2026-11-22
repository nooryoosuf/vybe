'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { VYBE_REACTIONS } from '@/lib/constants';
import { FloatingReactionEvent, ReactionDefinition } from '@/types/vybe';

interface FloatingReactionsLayerProps {
  reactions: FloatingReactionEvent[];
  onTriggerReaction: (reactionDef: ReactionDefinition) => void;
   onRemoveReaction: (id: string) => void;
  reducedMotion?: boolean;
  isVideoHovered: boolean;
}

const COOLDOWN_MS = 320;

export function FloatingReactionsLayer({
  reactions,
  onTriggerReaction,
  onRemoveReaction,
  reducedMotion = false,
  isVideoHovered,
}: FloatingReactionsLayerProps) {
  const [onCooldown, setOnCooldown] = useState(false);
  const lastFiredRef = useRef<number>(0);

  const handleFire = useCallback(
    (def: ReactionDefinition) => {
      const now = Date.now();
      if (now - lastFiredRef.current < COOLDOWN_MS) {
        setOnCooldown(true);
        return;
      }
      lastFiredRef.current = now;
      setOnCooldown(true);
      onTriggerReaction(def);
      setTimeout(() => {
        setOnCooldown(false);
      }, COOLDOWN_MS);
    },
    [onTriggerReaction]
  );

  // Keyboard shortcuts 1-9 when not typing inside input/textarea
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const matched = VYBE_REACTIONS.find((r) => r.shortcut === e.key);
      if (matched) {
        e.preventDefault();
        handleFire(matched);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFire]);

  // Keep max 32 visible reactions to guarantee 60 FPS
  const visibleReactions = reactions.slice(-32);

  return (
    <>
      {/* Floating Reaction Canvas Overlay */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden z-20"
        aria-live="off"
      >
        <AnimatePresence>
          {visibleReactions.map((item) => (
            <motion.div
              key={item.id}
              initial={{
                opacity: 0,
                y: 12,
                x: 0,
                scale: 0.65,
                rotate: 0,
              }}
              animate={
                reducedMotion
                  ? {
                      opacity: [0, 1, 1, 0],
                      y: -140,
                      scale: 1,
                    }
                  : {
                      opacity: [0, 1, 0.95, 0],
                      y: -340,
                      x: [0, item.driftX * 0.6, item.driftX, item.driftX * 0.8],
                      scale: [0.7, item.scale, item.scale * 1.05, 0.85],
                      rotate: [0, item.rotation * 0.5, -item.rotation * 0.4, item.rotation],
                    }
              }
              transition={{
                duration: reducedMotion ? 1.8 : item.duration,
                ease: 'easeOut',
              }}
              onAnimationComplete={() => onRemoveReaction(item.id)}
              style={{ left: `${item.startX}%` }}
              className="absolute bottom-20 flex flex-col items-center"
            >
              {/* Special Burst Ring for ❤️ 🔥 🤯 */}
              {item.isSpecial && !reducedMotion && (
                <motion.span
                  initial={{ scale: 0.4, opacity: 0.9 }}
                  animate={{ scale: 2.3, opacity: 0 }}
                  transition={{ duration: 0.75, ease: 'easeOut' }}
                  className="pointer-events-none absolute inset-0 rounded-full blur-md"
                  style={{ backgroundColor: item.glowColor }}
                />
              )}

              {/* Emoji & Sender Avatar/Name Pill */}
              <div
                className="relative flex items-center gap-1.5 rounded-full bg-[#0D0F18]/90 backdrop-blur-md border border-white/15 pl-1.5 pr-2.5 py-1 shadow-xl"
                style={{
                  boxShadow: item.isSpecial
                    ? `0 0 22px -2px ${item.glowColor}`
                    : undefined,
                }}
              >
                <span className="text-xl sm:text-2xl leading-none drop-shadow">
                  {item.emoji}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.senderAvatar}
                  alt={item.senderName}
                  className="h-4 w-4 rounded-full object-cover"
                />
                <span className="text-[10px] font-semibold text-slate-100 max-w-[80px] truncate">
                  {item.senderName.split(' ')[0]}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Hover Floating Reaction Toolbar over Video Player */}
      <AnimatePresence>
        {isVideoHovered && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.18 }}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 max-w-[95vw]"
          >
            <div className="flex items-center gap-1.5 rounded-2xl bg-[#0D0F18]/95 backdrop-blur-xl border border-white/15 px-3 py-2 shadow-vybe-lg">
              <div className="hidden sm:flex items-center gap-1 pr-2 border-r border-white/10 text-[11px] font-semibold text-vybe-accentLight">
                <Sparkles className="h-3.5 w-3.5" />
                <span>React</span>
              </div>

              <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto">
                {VYBE_REACTIONS.map((reaction) => (
                  <button
                    key={reaction.id}
                    type="button"
                    onClick={() => handleFire(reaction)}
                    title={`${reaction.label} (Shortcut: ${reaction.shortcut})`}
                    aria-label={`React with ${reaction.label}`}
                    className={`group relative flex flex-col items-center justify-center h-10 w-10 rounded-xl bg-[#161A2B]/90 hover:bg-vybe-accent/30 border border-white/10 hover:border-vybe-accent transition-all duration-150 hover:-translate-y-1 active:scale-90 ${
                      onCooldown ? 'opacity-70' : ''
                    }`}
                  >
                    <span className="text-lg leading-none">{reaction.emoji}</span>
                    <span className="text-[9px] font-mono text-slate-400 group-hover:text-white mt-0.5">
                      {reaction.shortcut}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
