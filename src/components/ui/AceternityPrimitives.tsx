'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AsciiWaveCanvas } from './AsciiBackdrop';

/**
 * Volumetric Cinema Spotlight + Interactive Animated ASCII Wave Field
 */
export function CinemaSpotlight({
  className,
  withAscii = true,
}: {
  className?: string;
  withAscii?: boolean;
}) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 h-[760px] w-full overflow-hidden',
        className
      )}
      aria-hidden="true"
    >
      {withAscii && <AsciiWaveCanvas density={24} opacity={0.62} />}
      <div className="absolute -top-44 left-1/2 -translate-x-1/2 h-[560px] w-[1080px] max-w-full bg-[radial-gradient(ellipse_at_top,rgba(109,93,251,0.26)_0%,rgba(124,58,237,0.10)_42%,transparent_75%)] blur-3xl" />
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#07080D] to-transparent" />
    </div>
  );
}

/**
 * Multi-layered Glassmorphic Surface Card
 */
export function GlassCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative rounded-3xl bg-white/[0.035] backdrop-blur-2xl border border-white/[0.11] shadow-[0_24px_64px_-16px_rgba(0,0,0,0.85),inset_0_1px_0_0_rgba(255,255,255,0.16)]',
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Aceternity-inspired Animated Tooltip Avatar Stack
 */
export interface AvatarTooltipItem {
  id: string;
  name: string;
  subtitle?: string;
  image: string;
  statusColor?: string;
}

export function AnimatedAvatarStack({
  items,
  maxVisible = 5,
}: {
  items: AvatarTooltipItem[];
  maxVisible?: number;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const visible = items.slice(0, maxVisible);
  const overflow = items.length - visible.length;

  return (
    <div className="flex items-center -space-x-2.5">
      {visible.map((item) => (
        <div
          key={item.id}
          className="relative group"
          onMouseEnter={() => setHoveredId(item.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          <AnimatePresence>
            {hoveredId === item.id && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                className="pointer-events-none absolute -top-14 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap rounded-full bg-[#131624]/90 backdrop-blur-xl border border-white/20 px-3.5 py-1.5 shadow-vybe-lg"
              >
                <div className="text-xs font-semibold text-white">{item.name}</div>
                {item.subtitle && (
                  <div className="text-[10px] font-mono text-slate-300">
                    {item.subtitle}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="relative h-9 w-9 rounded-full ring-2 ring-[#07080D] bg-[#161A2B] overflow-hidden transition-transform duration-200 group-hover:scale-110 group-hover:z-20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.image}
              alt={item.name}
              className="h-full w-full object-cover"
            />
          </div>
          {item.statusColor && (
            <span
              className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-[#07080D]"
              style={{ backgroundColor: item.statusColor }}
            />
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] backdrop-blur-md ring-2 ring-[#07080D] text-xs font-semibold text-slate-200">
          +{overflow}
        </div>
      )}
    </div>
  );
}

/**
 * Tactile Pill-Shaped Glassmorphic & Specular Button
 */
export function GlowButton({
  children,
  onClick,
  className,
  variant = 'primary',
  type = 'button',
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  type?: 'button' | 'submit';
  disabled?: boolean;
}) {
  const baseStyles =
    'relative inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold tracking-tight transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-vybe-accent disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97]';

  const variants = {
    primary:
      'bg-gradient-to-b from-[#8374FE] via-[#6D5DFB] to-[#5645E8] text-white shadow-[0_8px_28px_-4px_rgba(109,93,251,0.55),inset_0_1px_0_0_rgba(255,255,255,0.35)] hover:shadow-[0_12px_34px_-4px_rgba(124,58,237,0.75),inset_0_1px_0_0_rgba(255,255,255,0.45)] hover:brightness-110 border border-white/20',
    secondary:
      'bg-white/[0.05] hover:bg-white/[0.1] backdrop-blur-xl text-slate-100 border border-white/[0.14] hover:border-white/[0.28] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.16)]',
    ghost:
      'bg-transparent hover:bg-white/[0.07] backdrop-blur-md text-slate-300 hover:text-white border border-transparent',
    danger:
      'bg-rose-500/15 hover:bg-rose-500/25 backdrop-blur-xl text-rose-200 border border-rose-500/35 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)]',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(baseStyles, variants[variant], className)}
    >
      {children}
    </button>
  );
}
